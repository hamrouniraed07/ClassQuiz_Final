import json
import structlog
from typing import List

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings
from app.prompts.prompts import EVALUATION_SYSTEM_PROMPT, build_evaluation_user_prompt
from app.models.schemas import GradeResponse, QuestionResult, MistakeType

logger = structlog.get_logger()
settings = get_settings()


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


async def _request_evaluation_completion(user_prompt: str) -> tuple[str, int]:
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": EVALUATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "options": {
            "temperature": settings.eval_temperature,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    raw_text = data.get("message", {}).get("content", "")
    token_count = int(data.get("prompt_eval_count", 0)) + int(data.get("eval_count", 0))
    return raw_text, token_count


@retry(
    stop=stop_after_attempt(settings.eval_max_retries),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((json.JSONDecodeError, KeyError, ValueError)),
    reraise=True,
)
async def grade_student_exam(
    student_exam_id: str,
    questions: List[dict],
    student_answers: List[dict],
) -> GradeResponse:
    """
    Grade all answers for a student exam using Ollama Llama3.2.

    Args:
        student_exam_id: Reference ID for the student exam
        questions: List of question dicts (number, text, correct_answer, max_score, type)
        student_answers: List of answer dicts (question_number, answer_text, max_score)

    Returns:
        GradeResponse with per-question scores, feedback, and overall result
    """
    logger.info(
        "Starting evaluation",
        student_exam_id=student_exam_id,
        question_count=len(questions),
    )

    user_prompt = build_evaluation_user_prompt(questions, student_answers)

    raw_text, token_count = await _request_evaluation_completion(user_prompt)
    logger.debug(
        "Evaluation raw response",
        ollama_model=settings.ollama_model,
        length=len(raw_text),
    )

    clean_json = _strip_json_fences(raw_text)
    data = json.loads(clean_json)

    # Build structured results
    results: List[QuestionResult] = []
    for r in data["results"]:
        # Clamp score to max_score
        q_max = next(
            (q["max_score"] for q in questions if q["number"] == r["question_number"]),
            r.get("max_score", 0),
        )
        score = min(float(r["score"]), float(q_max))

        results.append(
            QuestionResult(
                question_number=r["question_number"],
                score=round(score, 2),
                max_score=float(q_max),
                mistake_type=MistakeType(r.get("mistake_type", "no_answer")),
                feedback=r.get("feedback", ""),
                is_correct=r.get("is_correct", score == q_max),
            )
        )

    total_score = sum(r.score for r in results)
    max_possible = sum(q["max_score"] for q in questions)
    percentage = round((total_score / max_possible * 100), 2) if max_possible > 0 else 0.0

    grade_response = GradeResponse(
        student_exam_id=student_exam_id,
        results=results,
        total_score=round(total_score, 2),
        max_possible_score=round(max_possible, 2),
        percentage=percentage,
        overall_feedback=data.get("overall_feedback", ""),
    )

    logger.info(
        "Evaluation completed",
        student_exam_id=student_exam_id,
        ollama_model=settings.ollama_model,
        total_score=total_score,
        max_possible=max_possible,
        percentage=percentage,
        tokens_used=token_count,
    )

    return grade_response
