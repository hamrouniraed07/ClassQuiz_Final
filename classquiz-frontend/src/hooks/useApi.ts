import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type {
  Student, Exam, StudentExam, Validation, BatchUpload,
  CreateStudentDto, LoginCredentials, AuthResponse, DashboardStats,
  CSVImportResult, Question, OCRExtractionResult, ExamReportData,
} from '@/types'
import type { ClassLevel } from '@/constants/domain'

export const QK = {
  students: (p?: object) => ['students', p],
  student: (id: string) => ['student', id],
  studentPerf: (id: string) => ['student-perf', id],
  exams: (p?: object) => ['exams', p],
  exam: (id: string) => ['exam', id],
  studentExams: (p?: object) => ['student-exams', p],
  studentExam: (id: string) => ['student-exam', id],
  validations: (p?: object) => ['validations', p],
  validation: (id: string) => ['validation', id],
  validationStats: () => ['validation-stats'],
  batch: (id: string) => ['batch', id],
  examReport: (id: string) => ['exam-report', id],
  dashboard: () => ['dashboard'],
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const useLogin = () =>
  useMutation({
    mutationFn: async (creds: LoginCredentials) => {
      const { data } = await api.post<{ data: AuthResponse }>('/auth/login', creds)
      return data.data
    },
  })

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const useDashboard = () =>
  useQuery({
    queryKey: QK.dashboard(),
    queryFn: async (): Promise<DashboardStats> => {
      const [students, exams, validations, sExams] = await Promise.all([
        api.get('/students?limit=1'), api.get('/exams?limit=1'),
        api.get('/validations?status=pending&limit=1'), api.get('/student-exams?status=evaluated&limit=1'),
      ])
      return {
        totalStudents: students.data.data.pagination.total,
        totalExams: exams.data.data.pagination.total,
        pendingValidations: validations.data.data.pagination.total,
        evaluatedToday: sExams.data.data.pagination.total,
        avgScore: 72.4, passRate: 78,
      }
    },
    staleTime: 60_000,
  })

// ── Students ──────────────────────────────────────────────────────────────────
export const useStudents = (params?: { classLevel?: ClassLevel; search?: string; page?: number; limit?: number }) =>
  useQuery({ queryKey: QK.students(params), queryFn: async () => { const { data } = await api.get('/students', { params }); return data.data as { students: Student[]; pagination: any } } })

export const useStudent = (id: string) =>
  useQuery({ queryKey: QK.student(id), queryFn: async () => { const { data } = await api.get(`/students/${id}`); return data.data as { student: Student; recentExams: any[] } }, enabled: !!id })

export const useStudentPerformance = (id: string) =>
  useQuery({ queryKey: QK.studentPerf(id), queryFn: async () => { const { data } = await api.get(`/students/${id}/performance`); return data.data }, enabled: !!id })

export const useCreateStudent = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (dto: CreateStudentDto) => { const { data } = await api.post('/students', dto); return data.data as Student }, onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }) })
}
export const useUpdateStudent = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async ({ id, ...dto }: Partial<CreateStudentDto> & { id: string }) => { const { data } = await api.put(`/students/${id}`, dto); return data.data as Student }, onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }) })
}
export const useDeleteStudent = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => { await api.delete(`/students/${id}`) }, onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }) })
}
export const useImportCSV = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (file: File) => { const fd = new FormData(); fd.append('file', file); const { data } = await api.post('/students/import-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); return data.data as CSVImportResult }, onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }) })
}

// ── Exams ─────────────────────────────────────────────────────────────────────
export const useExams = (params?: { classLevel?: ClassLevel; status?: string; page?: number }) =>
  useQuery({ queryKey: QK.exams(params), queryFn: async () => { const { data } = await api.get('/exams', { params }); return data.data as { exams: Exam[]; pagination: any } } })

export const useExam = (id: string) =>
  useQuery({ queryKey: QK.exam(id), queryFn: async () => { const { data } = await api.get(`/exams/${id}`); return data.data as Exam }, enabled: !!id })

export const useCreateExam = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post('/exams', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      return data.data as Exam
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
  })
}

export const useReprocessExam = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => { await api.post(`/exams/${id}/reprocess`) }, onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: QK.exam(id) }) })
}

export const useUpdateExam = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dto }: { id: string; title?: string; subject?: string; classLevel?: string; status?: string }) => {
      const { data } = await api.put(`/exams/${id}`, dto)
      return data.data as Exam
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
  })
}

export const useDeleteExam = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/exams/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
  })
}
/**
 * POST /exams/:id/ocr — returns extracted questions WITHOUT saving to DB
 */
export const useTriggerOCR = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/exams/${id}/ocr`)
      return data.data as OCRExtractionResult
    },
  })
}

/**
 * POST /exams/:id/confirm — saves admin-validated questions to DB
 */
export const useConfirmExam = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, questions }: { id: string; questions: Question[] }) => {
      const { data } = await api.post(`/exams/${id}/confirm`, { questions })
      return data.data as Exam
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: QK.exam(vars.id) })
      qc.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}

// ── Student Exams ─────────────────────────────────────────────────────────────
export const useStudentExams = (params?: { examId?: string; studentId?: string; status?: string; page?: number; limit?: number }) =>
  useQuery({ queryKey: QK.studentExams(params), queryFn: async () => { const { data } = await api.get('/student-exams', { params }); return data.data as { studentExams: StudentExam[]; pagination: any } } })
export const useStudentExam = (id: string) =>
  useQuery({ queryKey: QK.studentExam(id), queryFn: async () => { const { data } = await api.get(`/student-exams/${id}`); return data.data as StudentExam }, enabled: !!id })
export const useUploadStudentExam = () => { const qc = useQueryClient(); return useMutation({ mutationFn: async (formData: FormData) => { const { data } = await api.post('/student-exams', formData, { headers: { 'Content-Type': 'multipart/form-data' } }); return data.data as StudentExam }, onSuccess: () => qc.invalidateQueries({ queryKey: ['student-exams'] }) }) }
export const useBatchUpload = () => { const qc = useQueryClient(); return useMutation({ mutationFn: async (formData: FormData) => { const { data } = await api.post('/student-exams/batch', formData, { headers: { 'Content-Type': 'multipart/form-data' } }); return data.data as BatchUpload }, onSuccess: () => qc.invalidateQueries({ queryKey: ['student-exams'] }) }) }
export const useEvaluateExam = () => { const qc = useQueryClient(); return useMutation({ mutationFn: async (id: string) => { await api.post(`/student-exams/${id}/evaluate`) }, onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: QK.studentExam(id) }) }) }

// ── Validations ───────────────────────────────────────────────────────────────
export const useValidations = (params?: { status?: string; examId?: string; page?: number; limit?: number }) =>
  useQuery({ queryKey: QK.validations(params), queryFn: async () => { const { data } = await api.get('/validations', { params }); return data.data as { validations: Validation[]; pagination: any } } })
export const useValidation = (id: string) =>
  useQuery({ queryKey: QK.validation(id), queryFn: async () => { const { data } = await api.get(`/validations/${id}`); return data.data as Validation }, enabled: !!id })
export const useValidationStats = () =>
  useQuery({ queryKey: QK.validationStats(), queryFn: async () => { const { data } = await api.get('/validations/stats'); return data.data as { pending: number; in_review: number; completed: number; skipped: number } }, refetchInterval: 30_000 })
export const useSubmitReview = () => { const qc = useQueryClient(); return useMutation({ mutationFn: async ({ id, corrections, notes }: { id: string; corrections: any[]; notes?: string }) => { const { data } = await api.post(`/validations/${id}/review`, { corrections, notes }); return data.data }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['validations'] }); qc.invalidateQueries({ queryKey: ['validation-stats'] }) } }) }
export const useSkipValidation = () => { const qc = useQueryClient(); return useMutation({ mutationFn: async (id: string) => { await api.post(`/validations/${id}/skip`) }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['validations'] }); qc.invalidateQueries({ queryKey: ['validation-stats'] }) } }) }

// ── Reports ───────────────────────────────────────────────────────────────────
export const useExamReport = (examId: string) =>
  useQuery({ queryKey: QK.examReport(examId), queryFn: async () => { const { data } = await api.get(`/reports/exam/${examId}`); return data.data as ExamReportData }, enabled: !!examId })
export const useGenerateReport = () => useMutation({ mutationFn: async (studentExamId: string) => { const { data } = await api.post(`/reports/generate/${studentExamId}`); return data.data } })
export const useDownloadReport = () => useMutation({ mutationFn: async (studentExamId: string) => { const res = await api.get(`/reports/download/${studentExamId}`, { responseType: 'blob' }); const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = `report_${studentExamId}.pdf`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) } })
export const usePreviewReport = () => useMutation({ mutationFn: async (studentExamId: string) => { const res = await api.get(`/reports/download/${studentExamId}`, { responseType: 'blob' }); const url = URL.createObjectURL(res.data); const opened = window.open(url, '_blank', 'noopener,noreferrer'); if (!opened) { const a = document.createElement('a'); a.href = url; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove() } setTimeout(() => URL.revokeObjectURL(url), 60_000) } })