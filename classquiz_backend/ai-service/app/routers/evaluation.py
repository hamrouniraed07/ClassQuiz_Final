
import structlog
from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.services.evaluation_service import grade_student_exam
from app.models.schemas import GradeRequest, GradeResponse

router = APIRouter(prefix="/evaluate", tags=["Evaluation"])
logger = structlog.get_logger()
settings = get_settings()


def _friendly_evaluation_error(exc: Exception) -> str:
    msg = str(exc)
    lower_msg = msg.lower()

    if (
        "connection refused" in lower_msg
        or "name or service not known" in lower_msg
        or "timed out" in lower_msg
    ):
        return "Evaluation unavailable: Ollama is unreachable. Please ensure Ollama is running at " + settings.ollama_base_url + " and retry."

    return "Evaluation processing failed. Please retry in a moment."


@router.post(
    "/grade",
    response_model=GradeResponse,
    summary="Grade student answers with Ollama",
    description=(
        "Submit student answers alongside correct answers. "
        "Returns per-question scores, mistake classification, pedagogical feedback, "
        "and overall result."
    ),
)
async def grade_exam(request: GradeRequest):
    if not request.questions:
        raise HTTPException(status_code=400, detail="Questions list cannot be empty")

    if not request.student_answers:
        raise HTTPException(status_code=400, detail="Student answers list cannot be empty")

    # Validate all questions have matching answers (warn if missing, don't fail)
    answer_numbers = {a.question_number for a in request.student_answers}
    question_numbers = {q.number for q in request.questions}
    missing = question_numbers - answer_numbers
    if missing:
        logger.warning(
            "Some questions have no student answers — will be graded as no_answer",
            student_exam_id=request.student_exam_id,
            missing_questions=sorted(missing),
        )
        # Add empty answers for missing questions
        from app.models.schemas import StudentAnswerInput
        for qnum in missing:
            q = next(q for q in request.questions if q.number == qnum)
            request.student_answers.append(
                StudentAnswerInput(
                    question_number=qnum,
                    answer_text="",
                    max_score=q.max_score,
                )
            )

    questions_dicts = [q.model_dump() for q in request.questions]
    answers_dicts = [a.model_dump() for a in request.student_answers]

    try:
        result = await grade_student_exam(
            student_exam_id=request.student_exam_id,
            questions=questions_dicts,
            student_answers=answers_dicts,
        )
        return result
    except Exception as e:
        friendly_message = _friendly_evaluation_error(e)
        logger.error(
            "Evaluation failed",
            student_exam_id=request.student_exam_id,
            error=str(e),
            friendly_error=friendly_message,
        )
        raise HTTPException(
            status_code=500,
            detail=friendly_message,
        )
