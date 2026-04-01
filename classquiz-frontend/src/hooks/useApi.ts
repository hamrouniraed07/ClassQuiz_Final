import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '@/lib/api'
import { invalidateToken, queryFailed, queryStarted, querySucceeded } from '@/store/apiCacheSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
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

function keyToCacheKey(key: unknown): string {
  return JSON.stringify(key)
}

function keyToToken(key: unknown): string {
  if (Array.isArray(key) && typeof key[0] === 'string') {
    return key[0]
  }
  return 'query'
}

function toErrorMessage(error: any): string {
  return error?.response?.data?.message || error?.message || 'Request failed'
}

function useReduxQuery<T>(options: {
  queryKey: unknown
  queryFn: () => Promise<T>
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number
}) {
  const { queryKey, queryFn, enabled = true, staleTime = 30_000, refetchInterval } = options
  const dispatch = useAppDispatch()
  const cacheKey = useMemo(() => keyToCacheKey(queryKey), [queryKey])
  const token = useMemo(() => keyToToken(queryKey), [queryKey])
  const entry = useAppSelector((state) => state.apiCache.queries[cacheKey])
  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  const refetch = useCallback(async () => {
    if (!enabled) return undefined

    dispatch(queryStarted({ cacheKey, token }))
    try {
      const data = await queryFnRef.current()
      dispatch(querySucceeded({ cacheKey, token, data }))
      return data
    } catch (error: any) {
      dispatch(queryFailed({ cacheKey, token, error: toErrorMessage(error) }))
      throw error
    }
  }, [cacheKey, dispatch, enabled, token])

  useEffect(() => {
    if (!enabled) return
    if (entry?.status === 'loading') return

    const needsInitialFetch = !entry
    const isStale = !entry || Date.now() - entry.updatedAt >= staleTime

    if (needsInitialFetch || isStale) {
      void refetch()
    }
  }, [enabled, entry, refetch, staleTime])

  useEffect(() => {
    if (!enabled || !refetchInterval) return

    const intervalId = setInterval(() => {
      void refetch()
    }, refetchInterval)

    return () => clearInterval(intervalId)
  }, [enabled, refetch, refetchInterval])

  return {
    data: entry?.data as T | undefined,
    isLoading: enabled && (!entry || entry.status === 'loading'),
    isFetching: entry?.status === 'loading',
    error: entry?.error,
    refetch,
  }
}

function useReduxMutation<TData, TVariables = void>(options: {
  mutationFn: (variables: TVariables) => Promise<TData>
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>
}) {
  const { mutationFn, onSuccess } = options
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TData | undefined>(undefined)
  const mutationFnRef = useRef(mutationFn)
  const onSuccessRef = useRef(onSuccess)

  mutationFnRef.current = mutationFn
  onSuccessRef.current = onSuccess

  const mutateAsync = useCallback(async (variables: TVariables) => {
    setIsPending(true)
    setError(null)
    try {
      const result = await mutationFnRef.current(variables)
      setData(result)
      if (onSuccessRef.current) {
        await onSuccessRef.current(result, variables)
      }
      return result
    } catch (err: any) {
      setError(toErrorMessage(err))
      throw err
    } finally {
      setIsPending(false)
    }
  }, [])

  const mutate = useCallback((variables: TVariables) => {
    void mutateAsync(variables).catch(() => undefined)
  }, [mutateAsync])

  return { mutate, mutateAsync, isPending, error, data }
}

function useInvalidateTokens() {
  const dispatch = useAppDispatch()
  return useCallback((tokens: string[]) => {
    for (const token of tokens) {
      dispatch(invalidateToken(token))
    }
  }, [dispatch])
}

// Auth
export const useLogin = () =>
  useReduxMutation({
    mutationFn: async (creds: LoginCredentials) => {
      const { data } = await api.post<{ data: AuthResponse }>('/auth/login', creds)
      return data.data
    },
  })

// Dashboard
export const useDashboard = () =>
  useReduxQuery({
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

// Students
export const useStudents = (params?: { classLevel?: ClassLevel; search?: string; page?: number; limit?: number }) =>
  useReduxQuery({ queryKey: QK.students(params), queryFn: async () => { const { data } = await api.get('/students', { params }); return data.data as { students: Student[]; pagination: any } } })

export const useStudent = (id: string) =>
  useReduxQuery({ queryKey: QK.student(id), queryFn: async () => { const { data } = await api.get(`/students/${id}`); return data.data as { student: Student; recentExams: any[] } }, enabled: !!id })

export const useStudentPerformance = (id: string) =>
  useReduxQuery({ queryKey: QK.studentPerf(id), queryFn: async () => { const { data } = await api.get(`/students/${id}/performance`); return data.data }, enabled: !!id })

export const useCreateStudent = () => {
  const invalidate = useInvalidateTokens()
  return useReduxMutation({ mutationFn: async (dto: CreateStudentDto) => { const { data } = await api.post('/students', dto); return data.data as Student }, onSuccess: () => invalidate(['students']) })
}
export const useUpdateStudent = () => {
  const invalidate = useInvalidateTokens()
  return useReduxMutation({ mutationFn: async ({ id, ...dto }: Partial<CreateStudentDto> & { id: string }) => { const { data } = await api.put(`/students/${id}`, dto); return data.data as Student }, onSuccess: () => invalidate(['students']) })
}
export const useDeleteStudent = () => {
  const invalidate = useInvalidateTokens()
  return useReduxMutation({ mutationFn: async (id: string) => { await api.delete(`/students/${id}`) }, onSuccess: () => invalidate(['students']) })
}
export const useImportCSV = () => {
  const invalidate = useInvalidateTokens()
  return useReduxMutation({ mutationFn: async (file: File) => { const fd = new FormData(); fd.append('file', file); const { data } = await api.post('/students/import-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); return data.data as CSVImportResult }, onSuccess: () => invalidate(['students']) })
}

// Exams
export const useExams = (params?: { classLevel?: ClassLevel; status?: string; page?: number }) =>
  useReduxQuery({ queryKey: QK.exams(params), queryFn: async () => { const { data } = await api.get('/exams', { params }); return data.data as { exams: Exam[]; pagination: any } } })

export const useExam = (id: string) =>
  useReduxQuery({ queryKey: QK.exam(id), queryFn: async () => { const { data } = await api.get(`/exams/${id}`); return data.data as Exam }, enabled: !!id })

export const useCreateExam = () => {
  const invalidate = useInvalidateTokens()
  return useReduxMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post('/exams', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      return data.data as Exam
    },
    onSuccess: () => invalidate(['exams']),
  })
}

export const useReprocessExam = () => {
  const invalidate = useInvalidateTokens()
  return useReduxMutation({ mutationFn: async (id: string) => { await api.post(`/exams/${id}/reprocess`) }, onSuccess: () => invalidate(['exam']) })
}

export const useUpdateExam = () => {
  const invalidate = useInvalidateTokens()
  return useReduxMutation({
    mutationFn: async ({ id, ...dto }: { id: string; title?: string; subject?: string; classLevel?: string; status?: string }) => {
      const { data } = await api.put(`/exams/${id}`, dto)
      return data.data as Exam
    },
    onSuccess: () => invalidate(['exams']),
  })
}

export const useDeleteExam = () => {
  const invalidate = useInvalidateTokens()
  return useReduxMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/exams/${id}`)
    },
    onSuccess: () => invalidate(['exams']),
  })
}

export const useTriggerOCR = () => {
  return useReduxMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/exams/${id}/ocr`)
      return data.data as OCRExtractionResult
    },
  })
}

export const useConfirmExam = () => {
  const invalidate = useInvalidateTokens()
  return useReduxMutation({
    mutationFn: async ({ id, questions }: { id: string; questions: Question[] }) => {
      const { data } = await api.post(`/exams/${id}/confirm`, { questions })
      return data.data as Exam
    },
    onSuccess: () => {
      invalidate(['exam', 'exams'])
    },
  })
}

// Student Exams
export const useStudentExams = (params?: { examId?: string; studentId?: string; status?: string; page?: number; limit?: number }) =>
  useReduxQuery({ queryKey: QK.studentExams(params), queryFn: async () => { const { data } = await api.get('/student-exams', { params }); return data.data as { studentExams: StudentExam[]; pagination: any } } })
export const useStudentExam = (id: string) =>
  useReduxQuery({ queryKey: QK.studentExam(id), queryFn: async () => { const { data } = await api.get(`/student-exams/${id}`); return data.data as StudentExam }, enabled: !!id })
export const useUploadStudentExam = () => { const invalidate = useInvalidateTokens(); return useReduxMutation({ mutationFn: async (formData: FormData) => { const { data } = await api.post('/student-exams', formData, { headers: { 'Content-Type': 'multipart/form-data' } }); return data.data as StudentExam }, onSuccess: () => invalidate(['student-exams']) }) }
export const useBatchUpload = () => { const invalidate = useInvalidateTokens(); return useReduxMutation({ mutationFn: async (formData: FormData) => { const { data } = await api.post('/student-exams/batch', formData, { headers: { 'Content-Type': 'multipart/form-data' } }); return data.data as BatchUpload }, onSuccess: () => invalidate(['student-exams']) }) }
export const useEvaluateExam = () => { const invalidate = useInvalidateTokens(); return useReduxMutation({ mutationFn: async (id: string) => { await api.post(`/student-exams/${id}/evaluate`) }, onSuccess: () => invalidate(['student-exam']) }) }

// Validations
export const useValidations = (params?: { status?: string; examId?: string; page?: number; limit?: number }) =>
  useReduxQuery({ queryKey: QK.validations(params), queryFn: async () => { const { data } = await api.get('/validations', { params }); return data.data as { validations: Validation[]; pagination: any } } })
export const useValidation = (id: string) =>
  useReduxQuery({ queryKey: QK.validation(id), queryFn: async () => { const { data } = await api.get(`/validations/${id}`); return data.data as Validation }, enabled: !!id })
export const useValidationStats = () =>
  useReduxQuery({ queryKey: QK.validationStats(), queryFn: async () => { const { data } = await api.get('/validations/stats'); return data.data as { pending: number; in_review: number; completed: number; skipped: number } }, refetchInterval: 30_000 })
export const useSubmitReview = () => { const invalidate = useInvalidateTokens(); return useReduxMutation({ mutationFn: async ({ id, corrections, notes }: { id: string; corrections: any[]; notes?: string }) => { const { data } = await api.post(`/validations/${id}/review`, { corrections, notes }); return data.data }, onSuccess: () => { invalidate(['validations', 'validation-stats']) } }) }
export const useSkipValidation = () => { const invalidate = useInvalidateTokens(); return useReduxMutation({ mutationFn: async (id: string) => { await api.post(`/validations/${id}/skip`) }, onSuccess: () => { invalidate(['validations', 'validation-stats']) } }) }

// Reports
export const useExamReport = (examId: string) =>
  useReduxQuery({ queryKey: QK.examReport(examId), queryFn: async () => { const { data } = await api.get(`/reports/exam/${examId}`); return data.data as ExamReportData }, enabled: !!examId })
export const useGenerateReport = () => useReduxMutation({ mutationFn: async (studentExamId: string) => { const { data } = await api.post(`/reports/generate/${studentExamId}`); return data.data } })
export const useDownloadReport = () => useReduxMutation({ mutationFn: async (studentExamId: string) => { const res = await api.get(`/reports/download/${studentExamId}`, { responseType: 'blob' }); const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = `report_${studentExamId}.pdf`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) } })
export const usePreviewReport = () => useReduxMutation({ mutationFn: async (studentExamId: string) => { const res = await api.get(`/reports/download/${studentExamId}`, { responseType: 'blob' }); const url = URL.createObjectURL(res.data); const opened = window.open(url, '_blank', 'noopener,noreferrer'); if (!opened) { const a = document.createElement('a'); a.href = url; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove() } setTimeout(() => URL.revokeObjectURL(url), 60_000) } })
