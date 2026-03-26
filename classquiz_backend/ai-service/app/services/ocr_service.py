"""
Gemini Vision OCR Service
Handles both exam extraction and student answer extraction.
"""

import json
import re
import structlog
from typing import List, Optional

import google.generativeai as genai
from google.generativeai.types import GenerationConfig
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


def _get_generation_config(temperature: float = 0.1, max_tokens: int = 8192) -> dict:
    """
    Build generation config dict.
    For gemini-2.5 models, disable thinking to prevent token budget being consumed by internal reasoning.
    """
    config = {
        "temperature": temperature,
        "max_output_tokens": max_tokens,
    }

    # Gemini 2.5 models have "thinking" enabled by default which consumes tokens
    # and can cause truncated outputs for structured JSON responses
    model_name = settings.gemini_model.lower()
    if "2.5" in model_name:
        config["thinking_config"] = {"thinking_budget": 0}

    return config


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

    gen_config = _get_generation_config(temperature=0.1, max_tokens=8192)

    response = model.generate_content(
        parts,
        generation_config=gen_config,
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

    gen_config = _get_generation_config(temperature=0.05, max_tokens=8192)

    response = model.generate_content(
        [prompt, img],
        generation_config=gen_config,
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