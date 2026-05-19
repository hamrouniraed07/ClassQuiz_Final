import axios from 'axios'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import type {
  ActiveSession,
  Exam,
  Submission,
  SubmissionsResponse,
  BatchesResponse,
  StatsResponse,
} from '@/types/whatsapp'

export const AGENT_URL = import.meta.env.VITE_WHATSAPP_AGENT_URL || 'http://localhost:4000'
export const AGENT_KEY = import.meta.env.VITE_WHATSAPP_AGENT_KEY || 'change_this_secret_key'

export const agentApi = axios.create({
  baseURL: AGENT_URL,
  headers: { 'x-agent-key': AGENT_KEY },
  timeout: 8000,
})

// Session
export function useActiveSession() {
  return useQuery({
    queryKey: ['wa-session'],
    queryFn: async (): Promise<ActiveSession | null> => {
      const { data } = await agentApi.get('/session')
      return data.data
    },
    refetchInterval: 5000,
  })
}

export function useActivateSession(onSuccess?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (exam: Exam) => {
      const { data } = await agentApi.post('/session/activate', {
        examId:      exam._id,
        examTitle:   exam.title,
        examSubject: exam.subject,
        classLevel:  exam.classLevel,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-session'] })
      onSuccess?.()
    },
  })
}

export function useDeactivateSession(onSuccess?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await agentApi.delete('/session/deactivate')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-session'] })
      onSuccess?.()
    },
  })
}

// Exams
export function useActiveExams() {
  return useQuery({
    queryKey: ['exams-active'],
    queryFn: async (): Promise<Exam[]> => {
      const { data } = await api.get('/exams?status=active&limit=50')
      return data.data?.exams ?? []
    },
  })
}

// Submissions
export function useWaSubmissions(params?: { status?: string; page?: number }) {
  return useQuery({
    queryKey: ['wa-submissions', params],
    queryFn: async (): Promise<SubmissionsResponse> => {
      const { data } = await agentApi.get('/admin/submissions', {
        params: { ...params, limit: 50 },
      })
      return data.data
    },
    refetchInterval: 6000,
  })
}

export interface AssignPayload {
  submissionId: string
  examId: string
  examTitle: string
  batchId?: string
}

export function useAssignSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ submissionId, examId, examTitle, batchId }: AssignPayload) => {
      const { data } = await agentApi.patch(`/admin/submissions/${submissionId}/assign`, {
        examId,
        examTitle,
        ...(batchId ? { batchId } : {}),
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-submissions'] })
      qc.invalidateQueries({ queryKey: ['wa-batches'] })
    },
  })
}

// DELETE submission
export function useDeleteSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { data } = await agentApi.delete(`/admin/submissions/${submissionId}`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-submissions'] })
      qc.invalidateQueries({ queryKey: ['wa-stats'] })
    },
  })
}

// Batches
export function useWaBatches() {
  return useQuery({
    queryKey: ['wa-batches'],
    queryFn: async (): Promise<BatchesResponse> => {
      const { data } = await agentApi.get('/admin/batches', { params: { limit: 30 } })
      return data.data
    },
    refetchInterval: 8000,
  })
}

export function useDispatchBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data } = await agentApi.post(`/admin/batches/${batchId}/dispatch`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-batches'] })
      qc.invalidateQueries({ queryKey: ['wa-stats'] })
      qc.invalidateQueries({ queryKey: ['wa-submissions'] })
    },
  })
}

// Stats
export function useWaStats() {
  return useQuery({
    queryKey: ['wa-stats'],
    queryFn: async (): Promise<StatsResponse> => {
      const { data } = await agentApi.get('/admin/stats')
      return data.data
    },
    refetchInterval: 8000,
  })
}