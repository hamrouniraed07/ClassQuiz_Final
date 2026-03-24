from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


# ── Shared ────────────────────────────────────────────────────────────────────

class QuestionType(str, Enum):
    multiple_choice = "multiple_choice"
    short_answer = "short_answer"
    long_answer = "long_answer"
    true_false = "true_false"
    fill_blank = "fill_blank"


class MistakeType(str, Enum):
    correct = "correct"
    partial = "partial"
    conceptual_error = "conceptual_error"
    calculation_error = "calculation_error"
    incomplete = "incomplete"
    off_topic = "off_topic"
    no_answer = "no_answer"


# ── OCR Models ────────────────────────────────────────────────────────────────

class ExtractedQuestion(BaseModel):
    number: int
    text: str
    correct_answer: str
    max_score: float
    type: QuestionType = QuestionType.short_answer


class ExamOCRResponse(BaseModel):
    questions: List[ExtractedQuestion]
    total_score: float
    confidence_score: float = Field(..., ge=0, le=100)
    page_count: int = 1
    notes: Optional[str] = None


class QuestionInput(BaseModel):
    number: int
    text: str
    correct_answer: str
    max_score: float
    type: QuestionType = QuestionType.short_answer


class ExtractedAnswer(BaseModel):
    question_number: int
    extracted_text: str
    confidence_score: float = Field(..., ge=0, le=100)


class AnswerOCRResponse(BaseModel):
    answers: List[ExtractedAnswer]
    overall_confidence: float = Field(..., ge=0, le=100)
    student_name_detected: Optional[str] = None
    exam_id_detected: Optional[str] = None


# ── Evaluation Models ─────────────────────────────────────────────────────────

class StudentAnswerInput(BaseModel):
    question_number: int
    answer_text: str
    max_score: float


class EvaluationQuestionInput(BaseModel):
    number: int
    text: str
    correct_answer: str
    max_score: float
    type: QuestionType = QuestionType.short_answer


class GradeRequest(BaseModel):
    student_exam_id: str
    questions: List[EvaluationQuestionInput]
    student_answers: List[StudentAnswerInput]


class QuestionResult(BaseModel):
    question_number: int
    score: float
    max_score: float
    mistake_type: MistakeType
    feedback: str
    is_correct: bool


class GradeResponse(BaseModel):
    student_exam_id: str
    results: List[QuestionResult]
    total_score: float
    max_possible_score: float
    percentage: float
    overall_feedback: str
