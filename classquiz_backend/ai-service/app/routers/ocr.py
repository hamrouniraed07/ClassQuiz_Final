import json
import structlog
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from app.services.ocr_service import extract_exam_questions, extract_student_answers
from app.models.schemas import ExamOCRResponse, AnswerOCRResponse

router = APIRouter(prefix="/ocr", tags=["OCR"])
logger = structlog.get_logger()

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/tiff"
}


def _friendly_ocr_error(exc: Exception) -> tuple[int, str]:
    msg = str(exc)
    lower_msg = msg.lower()

    if "429" in lower_msg or "exceeded" in lower_msg or "quota" in lower_msg or "spending cap" in lower_msg:
        return 429, "OCR unavailable: Gemini quota exceeded. Please update billing/quota for GEMINI_API_KEY and retry."

    if "api key" in lower_msg or "invalid" in lower_msg or "permission" in lower_msg:
        return 401, "OCR unavailable: GEMINI_API_KEY is invalid or unauthorized. Please update the key and retry."

    if "timed out" in lower_msg or "deadline" in lower_msg:
        return 504, "OCR timeout: Gemini took too long to respond. Please retry."

    return 500, "OCR processing failed. Please retry in a moment."


def _validate_image(file: UploadFile, field_name: str) -> None:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Invalid file type for {field_name}: {file.content_type}. "
                   f"Allowed: JPEG, PNG, WebP, TIFF",
        )


@router.post(
    "/extract-exam",
    response_model=ExamOCRResponse,
    summary="Extract questions and answers from corrected exam images",
    description=(
        "Send corrected exam image(s) and optional blank exam images. "
        "Returns structured questions with correct answers and confidence score."
    ),
)
async def extract_exam(
    corrected_images: List[UploadFile] = File(
        ..., description="Corrected exam images (required, 1–10 pages)"
    ),
    blank_images: Optional[List[UploadFile]] = File(
        None, description="Blank exam images for layout context (optional)"
    ),
):
    if not corrected_images:
        raise HTTPException(status_code=400, detail="At least one corrected exam image is required")

    if len(corrected_images) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 corrected exam images allowed")

    # Validate and read corrected images
    corrected_bytes: List[bytes] = []
    for f in corrected_images:
        _validate_image(f, "corrected_images")
        corrected_bytes.append(await f.read())

    # Validate and read blank images
    blank_bytes: Optional[List[bytes]] = None
    if blank_images:
        blank_bytes = []
        for f in blank_images:
            _validate_image(f, "blank_images")
            blank_bytes.append(await f.read())

    try:
        result = await extract_exam_questions(corrected_bytes, blank_bytes)
        return result
    except json.JSONDecodeError as e:
        logger.error("OCR JSON parsing failed", error=str(e))
        raise HTTPException(
            status_code=422,
            detail="AI model returned invalid JSON. Please retry or check image quality.",
        )
    except Exception as e:
        status_code, detail = _friendly_ocr_error(e)
        logger.error("Exam OCR extraction failed", error=str(e), status_code=status_code, detail=detail)
        raise HTTPException(status_code=status_code, detail=detail)


@router.post(
    "/extract-answers",
    response_model=AnswerOCRResponse,
    summary="Extract student answers from a completed exam image",
    description=(
        "Send a student's completed exam image and the list of questions. "
        "Returns extracted answers with per-answer confidence scores."
    ),
)
async def extract_answers(
    student_exam_image: UploadFile = File(
        ..., description="Student's completed exam image"
    ),
    questions: str = Form(
        ..., description="JSON array of question objects (number, text, max_score, type)"
    ),
    exam_id: Optional[str] = Form(None, description="Exam ID for logging/traceability"),
):
    _validate_image(student_exam_image, "student_exam_image")

    try:
        questions_list = json.loads(questions)
        if not isinstance(questions_list, list) or len(questions_list) == 0:
            raise ValueError("Questions must be a non-empty array")
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid questions JSON: {str(e)}")

    image_bytes = await student_exam_image.read()

    logger.info(
        "Processing student exam OCR",
        exam_id=exam_id,
        question_count=len(questions_list),
        image_size=len(image_bytes),
    )

    try:
        result = await extract_student_answers(image_bytes, questions_list)
        return result
    except json.JSONDecodeError as e:
        logger.error("Student OCR JSON parsing failed", error=str(e))
        raise HTTPException(
            status_code=422,
            detail="AI model returned invalid JSON. Please retry or improve image quality.",
        )
    except Exception as e:
        status_code, detail = _friendly_ocr_error(e)
        logger.error("Student answer extraction failed", error=str(e), status_code=status_code, detail=detail)
        raise HTTPException(status_code=status_code, detail=detail)
