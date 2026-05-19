export interface ActiveSession {
  _id: string
  examId: string
  examTitle: string | null
  examSubject: string | null
  classLevel: string | null
  activatedAt: string
  isActive: boolean
  receivedCount: number
  indexedCount: number
  failedCount: number
}

export interface Exam {
  _id: string
  title: string
  subject: string
  classLevel: string
  status: string
  totalScore: number
  createdAt: string
}

export type SubmissionStatus =
  | 'received'
  | 'code_extracted'
  | 'student_found'
  | 'queued'
  | 'dispatched'
  | 'failed'

export interface Submission {
  _id: string
  whatsappMessageId: string
  senderPhone: string
  senderName: string | null
  rawCaption: string | null
  extractedCode: string | null
  studentId: string | null
  studentName: string | null
  examId: string | null
  batchId: string | null
  status: SubmissionStatus
  failReason: string | null
  errorDetail: string | null
  localImagePath: string | null
  allImagePaths: string[] | null   // multi-pages support
  createdAt: string
}

export type BatchStatus = 'open' | 'dispatching' | 'dispatched' | 'failed'

export interface Batch {
  _id: string
  examId: string
  count: number
  status: BatchStatus
  classquizBatchId: string | null
  dispatchTrigger: string | null
  successCount: number
  failedCount: number
  dispatchedAt: string | null
  createdAt: string
}

export interface Pagination {
  total: number
  page: number
  limit: number
}

export interface SubmissionsResponse {
  submissions: Submission[]
  pagination: Pagination
}

export interface BatchesResponse {
  batches: Batch[]
  pagination: Pagination
}

export interface StatsResponse {
  submissions: Array<{ _id: string; count: number }>
  batches: Array<{ _id: string; count: number; total: number }>
}

export type Tab    = 'inbox' | 'batches'
export type Filter = 'all' | 'received' | 'queued' | 'dispatched' | 'failed'

export interface StatusMeta {
  label: string
  color: string
  bg: string
  dot: string
}