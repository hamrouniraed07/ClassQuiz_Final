import type { ClassLevel, Subject } from '@/constants/domain'

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginCredentials { username: string; password: string }
export interface AuthResponse {
  token: string; expiresIn: string
  user: { username: string; role: string }
}

// ── Student ───────────────────────────────────────────────────────────────────
export interface Student {
  _id: string; name: string; code: string
  classLevel: ClassLevel; isActive: boolean
  createdAt: string; updatedAt: string
  examCount?: number
}
export interface CreateStudentDto { name: string; code: string; classLevel: ClassLevel }

// ── CSV Import ────────────────────────────────────────────────────────────────
export interface CSVImportResult {
  summary: { totalRows: number; successCount: number; failedCount: number }
  errors: { row: number | string; field: string; value: string; reason: string }[]
}

// ── Exam ──────────────────────────────────────────────────────────────────────
export type ExamStatus = 'draft' | 'processing' | 'active' | 'archived'
export type QuestionType = 'multiple_choice' | 'short_answer' | 'long_answer' | 'true_false' | 'fill_blank'
export interface Question {
  number: number; text: string; correctAnswer: string
  maxScore: number; type: QuestionType
  confidence?: number | null
  needsValidation?: boolean
}
export interface Exam {
  _id: string; title: string; subject: Subject; classLevel: ClassLevel
  totalScore: number; questions?: Question[]
  status: ExamStatus; ocrProcessedAt?: string
  ocrConfidence?: number | null
  ocrNotes?: string | null
  correctedExamImages: { path: string; originalName: string }[]
  blankExamImages: { path: string; originalName: string }[]
  createdAt: string
}

// ── StudentExam ───────────────────────────────────────────────────────────────
export type StudentExamStatus =
  | 'uploaded' | 'ocr_processing' | 'ocr_done' | 'validation_pending'
  | 'validated' | 'evaluating' | 'evaluated' | 'report_ready' | 'failed'
export type MistakeType =
  | 'correct' | 'partial' | 'conceptual_error' | 'calculation_error'
  | 'incomplete' | 'off_topic' | 'no_answer'
export interface Answer {
  questionNumber: number; extractedText: string; correctedText?: string
  confidenceScore?: number; score?: number; maxScore: number
  feedback?: string; mistakeType?: MistakeType; evaluatedAt?: string
}
export interface StudentExam {
  _id: string
  student: Student | string
  exam: Exam | string
  examImagePath: string
  answers: Answer[]
  status: StudentExamStatus
  totalScore?: number; maxPossibleScore?: number; percentage?: number; grade?: string
  ocrConfidenceAvg?: number; requiresValidation?: boolean
  reportPath?: string; reportGeneratedAt?: string
  processingError?: string; evaluatedAt?: string
  createdAt: string
}

// ── Validation ────────────────────────────────────────────────────────────────
export type ValidationStatus = 'pending' | 'in_review' | 'completed' | 'skipped'
export interface FlaggedAnswer {
  questionNumber: number; extractedText: string; confidenceScore: number
}
export interface Correction { questionNumber: number; correctedText: string }
export interface Validation {
  _id: string
  student: Student; exam: Exam; studentExam: StudentExam
  flaggedAnswers: FlaggedAnswer[]
  corrections: Correction[]
  status: ValidationStatus
  correctionCount: number
  reviewedBy?: string; reviewedAt?: string; notes?: string
  createdAt: string
}

// ── Batch ─────────────────────────────────────────────────────────────────────
export interface BatchUpload {
  _id: string; exam: string
  items: { studentId: string; imagePath: string; status: string; error?: string }[]
  totalCount: number; successCount: number; failedCount: number; pendingCount: number
  status: string; createdAt: string
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalStudents: number; totalExams: number
  pendingValidations: number; evaluatedToday: number
  avgScore: number; passRate: number
}