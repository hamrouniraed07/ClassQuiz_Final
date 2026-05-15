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
  status: 'received' | 'code_extracted' | 'student_found' | 'queued' | 'dispatched' | 'failed'
  failReason: string | null
  errorDetail: string | null
  createdAt: string
}

export interface Batch {
  _id: string
  examId: string
  count: number
  status: 'open' | 'dispatching' | 'dispatched' | 'failed'
  classquizBatchId: string | null
  dispatchTrigger: string | null
  successCount: number
  failedCount: number
  dispatchedAt: string | null
  createdAt: string
}
