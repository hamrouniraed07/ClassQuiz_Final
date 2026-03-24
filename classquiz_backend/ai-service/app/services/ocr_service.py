"""
Gemini 2.0 Vision OCR Service
Handles both exam extraction and student answer extraction.
"""

import json
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


def _strip_json_fences(text: str) -> str:
    """Remove ```json ... ``` fences if Gemini wraps response in them."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


@retry(
    stop=stop_after_attempt(settings.ocr_max_retries),
    wait=wait_fixed(settings.ocr_retry_wait_seconds),
    retry=retry_if_exception_type((json.JSONDecodeError, KeyError, ValueError)),
    reraise=True,
)
async def extract_exam_questions(
    corrected_images: List[bytes],
    blank_images: Optional[List[bytes]] = None,
) -> ExamOCRResponse:
    """
    Extract structured questions and correct answers from corrected exam images.

    Args:
        corrected_images: List of corrected exam image bytes
        blank_images: Optional list of blank exam image bytes (improves context)

    Returns:
        ExamOCRResponse with questions and total score
    """
    logger.info("Starting exam OCR extraction", image_count=len(corrected_images))

    model = genai.GenerativeModel(settings.gemini_model)

    # Build content parts
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
            temperature=0.1,  # Low temperature for factual extraction
            max_output_tokens=4096,
        ),
    )

    raw_text = response.text
    logger.debug("Gemini exam OCR raw response", length=len(raw_text))

    clean_json = _strip_json_fences(raw_text)
    data = json.loads(clean_json)

    # Validate and return
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
    retry=retry_if_exception_type((json.JSONDecodeError, KeyError, ValueError)),
    reraise=True,
)
async def extract_student_answers(
    student_exam_image: bytes,
    questions: List[dict],
) -> AnswerOCRResponse:
    """
    Extract student's handwritten answers from their exam image.

    Args:
        student_exam_image: Student exam image bytes
        questions: List of question dicts (number, text, max_score, type)

    Returns:
        AnswerOCRResponse with extracted answers and confidence scores
    """
    logger.info("Starting student answer OCR", question_count=len(questions))

    model = genai.GenerativeModel(settings.gemini_model)

    # Format questions for the prompt
    questions_json = json.dumps(
        [{"number": q["number"], "text": q["text"], "type": q.get("type", "short_answer")}
         for q in questions],
        indent=2,
    )

    prompt = ANSWER_OCR_PROMPT_TEMPLATE.format(
        num_questions=len(questions),
        questions_json=questions_json,
    )

    img = _load_image(student_exam_image)

    response = model.generate_content(
        [prompt, img],
        generation_config=genai.GenerationConfig(
            temperature=0.05,  # Very low — we want faithful extraction, not creativity
            max_output_tokens=4096,
        ),
    )

    raw_text = response.text
    logger.debug("Gemini answer OCR raw response", length=len(raw_text))

    clean_json = _strip_json_fences(raw_text)
    data = json.loads(clean_json)

    result = AnswerOCRResponse(**data)
    logger.info(
        "Student answer OCR completed",
        answer_count=len(result.answers),
        overall_confidence=result.overall_confidence,
    )
    return result
