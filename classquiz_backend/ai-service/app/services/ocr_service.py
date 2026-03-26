"""
Gemini Vision OCR Service
Handles both exam extraction and student answer extraction.
"""

import json
import re
import base64
import structlog
from pathlib import Path
from typing import List, Optional

import google.generativeai as genai
from PIL import Image
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type

from app.config import get_settings
from app.prompts.prompts import EXAM_OCR_PROMPT, ANSWER_OCR_PROMPT_TEMPLATE
from app.models.schemas import ExamOCRResponse, AnswerOCRResponse

logger = structlog.get_logger()
settings = get_settings()

# Initialize Gemini
genai.configure(api_key=settings.gemini_api_key)


def _load_image(image_bytes: bytes) -> Image.Image:
    """Load image from bytes, convert to RGB."""
    from io import BytesIO
    img = Image.open(BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return img


def _extract_json(text: str) -> str:
    """
    Robustly extract valid JSON from Gemini response.
    Handles all known quirks:
    - Markdown ```json fences
    - Leading/trailing whitespace and newlines
    - Missing opening/closing braces
    - Gemini 2.5 "thinking" prefix before JSON
    - Truncated responses
    """
    if not text or not text.strip():
        raise ValueError("Empty response from Gemini")

    text = text.strip()

    # 1. Remove markdown code fences
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # 2. Try direct parse first (fast path)
    try:
        return json.dumps(json.loads(text))  # roundtrip validates
    except json.JSONDecodeError:
        pass

    # 3. Find JSON object using regex — look for { ... }
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        candidate = match.group(0)
        try:
            return json.dumps(json.loads(candidate))
        except json.JSONDecodeError:
            pass

    # 4. If text contains JSON keys but missing braces, wrap it
    if '"answers"' in text or '"questions"' in text:
        # Find first quote that starts a key
        first_quote = text.find('"')
        if first_quote >= 0:
            wrapped = '{' + text[first_quote:]
            # Ensure it ends with }
            if not wrapped.rstrip().endswith('}'):
                wrapped = wrapped.rstrip()
                # Try adding closing brackets
                open_braces = wrapped.count('{') - wrapped.count('}')
                open_brackets = wrapped.count('[') - wrapped.count(']')
                wrapped += ']' * max(0, open_brackets)
                wrapped += '}' * max(0, open_braces)
            try:
                return json.dumps(json.loads(wrapped))
            except json.JSONDecodeError:
                pass

    # 5. Nothing worked — raise with preview for debugging
    preview = text[:200] if len(text) > 200 else text
    raise json.JSONDecodeError(
        f"Could not extract valid JSON from Gemini response. Preview: {preview}",
        text, 0
    )


# Retry on ANY exception — Gemini can return truncated, empty, or malformed responses
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
    """
    Extract structured questions and correct answers from corrected exam images.
    """
    logger.info("Starting exam OCR extraction", image_count=len(corrected_images))

    model = genai.GenerativeModel(settings.gemini_model)

    parts = [EXAM_OCR_PROMPT]
    parts.append("\n\n## CORRECTED EXAM IMAGES:\n")
    for i, img_bytes in enumerate(corrected_images):
        img = _load_image(img_bytes)
        parts.append(f"[Corrected exam page {i + 1}]")
        parts.append(img)

    if blank_images:
        parts.append("\n\n## BLANK EXAM IMAGES (for layout reference):\n")
        for i, img_bytes in enumerate(blank_images):
            img = _load_image(img_bytes)
            parts.append(f"[Blank exam page {i + 1}]")
            parts.append(img)

    response = model.generate_content(
        parts,
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=4096,
        ),
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
    """
    Extract student's handwritten answers from their exam image.
    """
    logger.info("Starting student answer OCR", question_count=len(questions))

    model = genai.GenerativeModel(settings.gemini_model)

    questions_json = json.dumps(
        [{"number": q["number"], "text": q["text"], "type": q.get("type", "short_answer")}
         for q in questions],
        indent=2,
        ensure_ascii=False,
    )

    prompt = ANSWER_OCR_PROMPT_TEMPLATE.format(
        num_questions=len(questions),
        questions_json=questions_json,
    )

    img = _load_image(student_exam_image)

    response = model.generate_content(
        [prompt, img],
        generation_config=genai.GenerationConfig(
            temperature=0.05,
            max_output_tokens=4096,
        ),
    )

    raw_text = response.text
    logger.info("Gemini answer OCR raw response", length=len(raw_text), preview=raw_text[:300])

    clean_json = _extract_json(raw_text)
    data = json.loads(clean_json)

    result = AnswerOCRResponse(**data)
    logger.info(
        "Student answer OCR completed",
        answer_count=len(result.answers),
        overall_confidence=result.overall_confidence,
    )
    return result