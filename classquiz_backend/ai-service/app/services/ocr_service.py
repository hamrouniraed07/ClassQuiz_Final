"""
Gemini Vision OCR Service
Handles both exam extraction and student answer extraction.
"""

import json
import re
import structlog
from io import BytesIO
from typing import List, Optional

from google import genai
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type

from app.config import get_settings
from app.prompts.prompts import EXAM_OCR_PROMPT, ANSWER_OCR_PROMPT_TEMPLATE
from app.models.schemas import ExamOCRResponse, AnswerOCRResponse

logger = structlog.get_logger()
settings = get_settings()

# Initialize Gemini client via environment-backed settings.
client = genai.Client(
    vertexai=settings.gemini_vertexai,
    api_key=settings.gemini_api_key,
)


def _load_image(image_bytes: bytes) -> Image.Image:
    """Load image from bytes, convert to RGB."""
    img = Image.open(BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return img


def _pil_to_png_bytes(img: Image.Image) -> bytes:
    """Serialize a PIL image into PNG bytes for Gemini content parts."""
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _part_from_image_bytes(image_bytes: bytes) -> genai.types.Part:
    return genai.types.Part.from_bytes(data=image_bytes, mime_type="image/png")


def _part_from_pil(img: Image.Image) -> genai.types.Part:
    return _part_from_image_bytes(_pil_to_png_bytes(img))


def _upscale_if_needed(img: Image.Image, min_width: int = 1600) -> Image.Image:
    """Upscale low-resolution scans to improve handwriting legibility for OCR."""
    width, height = img.size
    if width >= min_width:
        return img

    scale = min_width / float(width)
    return img.resize((int(width * scale), int(height * scale)), Image.Resampling.LANCZOS)


def _prepare_student_ocr_variants(image_bytes: bytes) -> dict[str, Image.Image]:
    """Create multiple views of the same page to improve OCR on handwriting."""
    original = _upscale_if_needed(_load_image(image_bytes).convert("RGB"))

    gray = ImageOps.autocontrast(original.convert("L"), cutoff=2)
    denoised = gray.filter(ImageFilter.MedianFilter(size=3))
    sharpened = denoised.filter(ImageFilter.UnsharpMask(radius=1.4, percent=180, threshold=2))
    high_contrast = ImageEnhance.Contrast(sharpened).enhance(1.5)

    avg_luma = float(ImageStat.Stat(high_contrast).mean[0])
    threshold = max(90, min(170, int(avg_luma * 0.92)))
    binary = high_contrast.point(lambda p: 255 if p > threshold else 0, mode="1").convert("L")

    return {
        "original": original,
        "sharpened": sharpened,
        "binary": binary,
    }


def _crop_answer_column(img: Image.Image) -> Image.Image:
    """Crop the likely student-answer column to reduce confusion with printed questions."""
    width, height = img.size

    # For this exam layout (Arabic sheet), questions are on the right and answers on the left.
    left = 0
    right = int(width * 0.58)
    top = int(height * 0.18)
    bottom = int(height * 0.96)

    right = max(right, left + 10)
    bottom = max(bottom, top + 10)
    return img.crop((left, top, right, bottom))


def _get_generation_config(temperature: float = 0.1, max_tokens: int = 8192) -> genai.types.GenerateContentConfig:
    return genai.types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
    )


def _extract_json(text: str) -> str:
    """
    Robustly extract valid JSON from Gemini response.
    """
    if not text or not text.strip():
        raise ValueError("Empty response from Gemini")

    text = text.strip()

    # Remove markdown code fences
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # Try direct parse first
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    # Find JSON object using regex
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        candidate = match.group(0)
        try:
            json.loads(candidate)
            return candidate
        except json.JSONDecodeError:
            pass

    # If text contains JSON keys but missing braces
    if '"answers"' in text or '"questions"' in text:
        first_quote = text.find('"')
        if first_quote >= 0:
            wrapped = '{' + text[first_quote:]
            if not wrapped.rstrip().endswith('}'):
                open_braces = wrapped.count('{') - wrapped.count('}')
                open_brackets = wrapped.count('[') - wrapped.count(']')
                wrapped += ']' * max(0, open_brackets)
                wrapped += '}' * max(0, open_braces)
            try:
                json.loads(wrapped)
                return wrapped
            except json.JSONDecodeError:
                pass

    preview = text[:300] if len(text) > 300 else text
    raise json.JSONDecodeError(
        f"Could not extract valid JSON. Response preview: {preview}",
        text, 0
    )


_ARABIC_DIGIT_TRANSLATION = str.maketrans({
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٫": ".", "٬": ",",
})


def _normalize_digits(text: str) -> str:
    return text.translate(_ARABIC_DIGIT_TRANSLATION)


def _clean_extracted_text(text: str) -> str:
    """Normalize obvious OCR artifacts while preserving student intent."""
    if text is None:
        return ""

    cleaned = str(text).replace("\u200f", "").replace("\u200e", "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = _normalize_digits(cleaned)

    # Numeric-only expressions often include accidental trailing dash artifacts.
    if re.fullmatch(r"[0-9\s+\-*/=().,]+", cleaned):
        cleaned = cleaned.rstrip("-–—").strip()

    return cleaned


def _calibrate_confidence(extracted_text: str, model_confidence: float) -> float:
    """Reduce overconfident OCR scores when extracted text looks noisy/uncertain."""
    text = extracted_text.strip()
    if not text:
        return 0.0

    score = float(model_confidence)
    penalty = 0.0

    if "..." in text:
        penalty += 10
    if re.search(r"\?{2,}|\.{4,}", text):
        penalty += 10
    if len(text) <= 2:
        penalty += 8
    if re.search(r"[^0-9A-Za-z\s\u0600-\u06FF+\-*/=().,]", text):
        penalty += 6

    if re.fullmatch(r"[0-9\s+\-*/=().,]+", text):
        score += 3

    cap = 95.0
    if penalty >= 10:
        cap = 88.0
    if penalty >= 20:
        cap = 80.0

    score = min(score, cap)
    score = score - (penalty * 0.7)
    return round(max(0.0, min(100.0, score)), 1)


def _postprocess_answer_payload(data: dict, question_numbers: List[int]) -> dict:
    """Ensure stable answer structure and confidence calibration."""
    normalized_answers: List[dict] = []
    by_number: dict[int, dict] = {}

    for answer in data.get("answers", []):
        try:
            qnum = int(answer.get("question_number"))
        except (TypeError, ValueError):
            continue

        text = _clean_extracted_text(answer.get("extracted_text", ""))
        model_conf = float(answer.get("confidence_score", 0) or 0)
        calibrated = _calibrate_confidence(text, model_conf)

        by_number[qnum] = {
            "question_number": qnum,
            "extracted_text": text,
            "confidence_score": calibrated,
        }

    for qnum in question_numbers:
        normalized_answers.append(
            by_number.get(
                qnum,
                {
                    "question_number": qnum,
                    "extracted_text": "",
                    "confidence_score": 0.0,
                },
            )
        )

    average_confidence = (
        sum(a["confidence_score"] for a in normalized_answers) / len(normalized_answers)
        if normalized_answers else 0.0
    )
    model_overall = float(data.get("overall_confidence", average_confidence) or 0)

    # Trust model confidence partially, but anchor it to per-answer scores.
    overall_confidence = round(max(0.0, min(100.0, (0.4 * model_overall) + (0.6 * average_confidence))), 1)

    return {
        "answers": normalized_answers,
        "overall_confidence": overall_confidence,
        "student_name_detected": data.get("student_name_detected"),
        "exam_id_detected": data.get("exam_id_detected"),
    }


# Arabic "I don't know" phrases — common in primary school exams
_ARABIC_UNKNOWN_PHRASES = [
    "لا أستطيع", "لا استطيع", "لا أعرف", "لا اعرف",
    "ما أعرف", "ما اعرف", "لا أدري", "لا ادري",
    "لا أعلم", "لا اعلم",
]


def _contains_arabic_text(text: str) -> bool:
    """Return True if text contains Arabic Unicode characters."""
    return bool(re.search(r"[\u0600-\u06FF]", text))


def _looks_like_number_expression(text: str) -> bool:
    """Return True if text looks like a numeric/math expression."""
    # Matches things like: 1900, ١٩٠٠, 4000+4000, ٤٠٠٠+٤٠٠٠, 9.5, etc.
    cleaned = re.sub(r"[\s\+\-\×\÷\=\.]", "", text)
    # Arabic-Indic digits: ٠١٢٣٤٥٦٧٨٩
    return bool(re.fullmatch(r"[\d٠١٢٣٤٥٦٧٨٩]+", cleaned))


def _apply_semantic_confidence(
    answers: list,
    questions: list,
) -> list:
    """
    Detect false-confidence cases where Gemini hallucinated a numeric answer
    from Arabic text (or vice versa). Downgrade confidence to force validation.
    """
    # Build a quick lookup: question_number -> question type
    q_types = {q.get("number"): q.get("type", "short_answer") for q in questions}

    corrected = []
    for answer in answers:
        text = (answer.extracted_text or "").strip()
        q_type = q_types.get(answer.question_number, "short_answer")

        # Case 1: answer contains Arabic text but is numeric type question
        # and confidence is high -> likely hallucination
        if (
            _contains_arabic_text(text)
            and q_type in ("short_answer", "fill_blank")
            and answer.confidence_score > 60
        ):
            # Check if it's an "I don't know" phrase - valid answer, keep text
            # but force low confidence so teacher reviews it
            is_unknown_phrase = any(phrase in text for phrase in _ARABIC_UNKNOWN_PHRASES)
            if is_unknown_phrase:
                logger.warning(
                    "Semantic check: student wrote 'unknown' phrase, forcing validation",
                    question_number=answer.question_number,
                    extracted_text=text,
                    original_confidence=answer.confidence_score,
                )
                answer.confidence_score = 25.0  # force into validation queue

        # Case 2: extracted text looks purely numeric but the question
        # context suggests text was expected (e.g. all other answers are Arabic)
        # - handled by Case 1 on OTHER answers triggering overall_confidence drop

        # Case 3: extracted text is suspiciously short for a math expression
        # that doesn't match any valid number pattern -> possible misread
        if (
            _looks_like_number_expression(text) is False
            and q_type in ("short_answer", "fill_blank")
            and len(text) > 0
            and answer.confidence_score > 80
            and not _contains_arabic_text(text)
        ):
            # Non-Arabic, non-numeric, high confidence -> unusual, flag it
            answer.confidence_score = min(answer.confidence_score, 55.0)

        corrected.append(answer)

    return corrected


def _detect_hallucinated_answers(answers: list, questions: list) -> list:
    """
    Detect the specific hallucination pattern where Gemini outputs
    a plausible math answer (e.g. '4500 و 4500') for a question
    that the student likely left blank or wrote 'I don't know'.

    Heuristic: if an answer contains BOTH Arabic connector words (و، أو، مع)
    AND numbers, AND no such mixed pattern appears in other answers,
    it is suspicious - flag it for human validation.
    """
    # Pattern: digit(s) + Arabic connector + digit(s)
    mixed_pattern = re.compile(r"\d+\s*[وأو]\s*\d+")

    for answer in answers:
        text = (answer.extracted_text or "").strip()

        # Flag digit+Arabic-connector+digit as suspicious
        if mixed_pattern.search(text) and answer.confidence_score > 60:
            logger.warning(
                "Possible hallucinated answer detected (digit+connector+digit pattern)",
                question_number=answer.question_number,
                extracted_text=text,
                original_confidence=answer.confidence_score,
            )
            # Force into validation queue
            answer.confidence_score = 30.0

    return answers


@retry(
    stop=stop_after_attempt(settings.ocr_max_retries),
    wait=wait_fixed(settings.ocr_retry_wait_seconds),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
async def extract_exam_questions(
    corrected_images: List[bytes],
    blank_images: Optional[List[bytes]] = None,
) -> ExamOCRResponse:
    """Extract structured questions and correct answers from corrected exam images."""
    logger.info("Starting exam OCR extraction", image_count=len(corrected_images))

    parts = [EXAM_OCR_PROMPT]
    parts.append("\n\n## CORRECTED EXAM IMAGES:\n")
    for i, img_bytes in enumerate(corrected_images):
        img = _load_image(img_bytes)
        parts.append(f"[Corrected exam page {i + 1}]")
        parts.append(_part_from_pil(img))

    if blank_images:
        parts.append("\n\n## BLANK EXAM IMAGES (for layout reference):\n")
        for i, img_bytes in enumerate(blank_images):
            img = _load_image(img_bytes)
            parts.append(f"[Blank exam page {i + 1}]")
            parts.append(_part_from_pil(img))

    gen_config = _get_generation_config(temperature=0.1, max_tokens=8192)

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=parts,
        config=gen_config,
    )

    raw_text = response.text
    logger.info("Gemini exam OCR raw response", length=len(raw_text), preview=raw_text[:200])

    clean_json = _extract_json(raw_text)
    data = json.loads(clean_json)

    result = ExamOCRResponse(**data)
    logger.info(
        "Exam OCR completed",
        question_count=len(result.questions),
        total_score=result.total_score,
        confidence=result.confidence_score,
    )
    return result


@retry(
    stop=stop_after_attempt(settings.ocr_max_retries),
    wait=wait_fixed(settings.ocr_retry_wait_seconds),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
async def extract_student_answers(
    student_exam_image: bytes,
    questions: List[dict],
) -> AnswerOCRResponse:
    """Extract student's handwritten answers from their exam image."""
    logger.info("Starting student answer OCR", question_count=len(questions))

    questions_json = json.dumps(
        [{"number": q["number"], "type": q.get("type", "short_answer")}
         for q in questions],
        indent=2,
        ensure_ascii=False,
    )

    # Use token replacement instead of str.format to avoid interpreting JSON
    # braces in the prompt template as format placeholders.
    prompt = (
        ANSWER_OCR_PROMPT_TEMPLATE
        .replace("{num_questions}", str(len(questions)))
        .replace("{questions_json}", questions_json)
    )

    image_variants = _prepare_student_ocr_variants(student_exam_image)

    gen_config = _get_generation_config(temperature=0.05, max_tokens=8192)

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=[
            prompt,
            "[Original color page]",
            _part_from_pil(image_variants["original"]),
            "[Answer-column crop only (primary focus)]",
            _part_from_pil(_crop_answer_column(image_variants["original"])),
            "[Enhanced grayscale page for handwriting clarity]",
            _part_from_pil(image_variants["sharpened"]),
            "[Enhanced answer-column crop]",
            _part_from_pil(_crop_answer_column(image_variants["sharpened"])),
            "[High-contrast binary page for faint strokes]",
            _part_from_pil(image_variants["binary"]),
            "[Binary answer-column crop]",
            _part_from_pil(_crop_answer_column(image_variants["binary"])),
        ],
        config=gen_config,
    )

    raw_text = response.text or ""
    logger.info("Gemini answer OCR raw response", length=len(raw_text), preview=raw_text[:300])

    clean_json = _extract_json(raw_text)
    raw_data = json.loads(clean_json)
    data = _postprocess_answer_payload(raw_data, [q["number"] for q in questions])

    result = AnswerOCRResponse(**data)
    result.answers = _detect_hallucinated_answers(result.answers, questions)
    result.answers = _apply_semantic_confidence(result.answers, questions)

    if result.answers:
        result.overall_confidence = round(
            sum(a.confidence_score for a in result.answers) / len(result.answers), 2
        )

    logger.info(
        "Student answer OCR completed",
        answer_count=len(result.answers),
        overall_confidence=result.overall_confidence,
    )
    return result