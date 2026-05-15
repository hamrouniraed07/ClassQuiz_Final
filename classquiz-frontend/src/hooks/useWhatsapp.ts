import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ActiveSession, Exam, Submission, Batch } from '@/types/whatsapp'

const AGENT_URL = import.meta.env.VITE_WHATSAPP_AGENT_URL || 'http://localhost:4000'
const AGENT_KEY = import.meta.env.VITE_WHATSAPP_AGENT_KEY || 'change_this_secret_key'

const agentApi = axios.create({
  baseURL: AGENT_URL,
  headers: { 'x-agent-key': AGENT_KEY },
  timeout: 8000,
})

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

export function useActiveExams() {
  return useQuery({
    queryKey: ['exams-active'],
    queryFn: async (): Promise<Exam[]> => {
      const { data } = await api.get('/exams?status=active&limit=50')
      return data.data?.exams || []
    },
  })
}

export function useActivateSession() {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-session'] }),
  })
}

export function useDeactivateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await agentApi.delete('/session/deactivate')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-session'] }),
  })
}

export function useWaStats() {
  return useQuery({
    queryKey: ['wa-stats'],
    queryFn: async () => {
      const { data } = await agentApi.get('/admin/stats')
      return data.data as { submissions: any[]; batches: any[] }
    },
    refetchInterval: 8000,
  })
}

export function useWaSubmissions(params?: { status?: string; page?: number }) {
  return useQuery({
    queryKey: ['wa-submissions', params],
    queryFn: async () => {
      const { data } = await agentApi.get('/admin/submissions', { params: { ...params, limit: 20 } })
      return data.data as { submissions: Submission[]; pagination: any }
    },
    refetchInterval: 6000,
  })
}

export function useWaBatches() {
  return useQuery({
    queryKey: ['wa-batches'],
    queryFn: async () => {
      const { data } = await agentApi.get('/admin/batches', { params: { limit: 20 } })
      return data.data as { batches: Batch[]; pagination: any }
    },
    refetchInterval: 8000,
  })
}

export function useDispatch() {
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
