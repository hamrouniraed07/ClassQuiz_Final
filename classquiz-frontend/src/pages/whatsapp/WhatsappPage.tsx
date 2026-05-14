/**
 * src/pages/whatsapp/WhatsappPage.tsx
 *
 * Page de monitoring complet du service WhatsApp Agent.
 * Affiche en temps réel :
 *   - Statut du service (online/offline)
 *   - Stats globales (total, dispatché, en queue, rejeté)
 *   - Liste des messages reçus avec statut pipeline
 *   - Liste des batches avec dispatch manuel
 *   - Détail d'un message (modal)
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, CheckCircle2, XCircle, Clock, Send,
  RefreshCw, Play, ChevronDown, ChevronRight, Phone,
  Image, Layers, Activity, Inbox, X, AlertTriangle,
  Wifi, WifiOff, RotateCw, User, Calendar, Hash
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { motion as m } from 'framer-motion'
import { StatCard, SectionCard, LoadingPage, PageHeader, EmptyState } from '@/components/shared'
import { cn } from '@/lib/utils'

// ── Config Agent API ──────────────────────────────────────────────────────────
const AGENT_URL = import.meta.env.VITE_WHATSAPP_AGENT_URL || 'http://localhost:4000'
const AGENT_KEY = import.meta.env.VITE_WHATSAPP_AGENT_KEY || 'change_this_secret_key'

const agentApi = axios.create({
  baseURL: AGENT_URL,
  headers: { 'x-agent-key': AGENT_KEY },
  timeout: 8000,
})

// ── Types ─────────────────────────────────────────────────────────────────────
interface Submission {
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
  studentExamId: string | null
  status: 'received' | 'code_extracted' | 'student_found' | 'queued' | 'dispatched' | 'failed'
  failReason: string | null
  errorDetail: string | null
  localImagePath: string | null
  imageMimeType: string
  dispatchedAt: string | null
  createdAt: string
  updatedAt: string
}

interface Batch {
  _id: string
  examId: string
  count: number
  status: 'open' | 'dispatching' | 'dispatched' | 'failed'
  classquizBatchId: string | null
  dispatchTrigger: string | null
  successCount: number
  failedCount: number
  dispatchError: string | null
  dispatchedAt: string | null
  createdAt: string
  submissionIds?: Submission[]
}

interface Stats {
  submissions: Array<{ _id: string; count: number }>
  batches: Array<{ _id: string; count: number; total: number }>
}

interface HealthData {
  status: string
  uptime: number
  mongo: string
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useAgentHealth() {
  return useQuery({
    queryKey: ['wa-health'],
    queryFn: async (): Promise<HealthData> => {
      const { data } = await agentApi.get('/health')
      return data
    },
    refetchInterval: 20000,
    retry: 1,
  })
}

function useWaStats() {
  return useQuery({
    queryKey: ['wa-stats'],
    queryFn: async (): Promise<Stats> => {
      const { data } = await agentApi.get('/admin/stats')
      return data.data
    },
    refetchInterval: 8000,
  })
}

function useWaSubmissions(params?: { status?: string; page?: number }) {
  return useQuery({
    queryKey: ['wa-submissions', params],
    queryFn: async () => {
      const { data } = await agentApi.get('/admin/submissions', { params: { ...params, limit: 20 } })
      return data.data as { submissions: Submission[]; pagination: { total: number; pages: number } }
    },
    refetchInterval: 6000,
  })
}

function useWaBatches(params?: { status?: string }) {
  return useQuery({
    queryKey: ['wa-batches', params],
    queryFn: async () => {
      const { data } = await agentApi.get('/admin/batches', { params: { ...params, limit: 20 } })
      return data.data as { batches: Batch[]; pagination: { total: number } }
    },
    refetchInterval: 8000,
  })
}

function useDispatch() {
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtPhone(p: string) {
  return p ? `+${p.slice(0,3)} ${p.slice(3,5)} ${p.slice(5,8)} ${p.slice(8)}` : '—'
}

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

// ── Status configs ────────────────────────────────────────────────────────────
const SUB_STATUS: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  received:       { label: 'Received',      color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     dot: 'bg-sky-400' },
  code_extracted: { label: 'Code Found',    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-400' },
  student_found:  { label: 'Student OK',    color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    dot: 'bg-teal-400' },
  queued:         { label: 'In Queue',      color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  dot: 'bg-violet-400 animate-pulse' },
  dispatched:     { label: 'Dispatched',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  failed:         { label: 'Failed',        color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-500' },
}

const BATCH_STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  open:        { label: 'Open',        color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  dispatching: { label: 'Dispatching', color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  dispatched:  { label: 'Dispatched',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  failed:      { label: 'Failed',      color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
}

const FAIL_REASON: Record<string, string> = {
  no_code:         '⚠️ No student code in caption',
  invalid_code:    '⚠️ Invalid code format',
  student_unknown: '❌ Student not found in ClassQuiz',
  download_failed: '🔌 Image download failed',
  dispatch_failed: '🚫 Batch dispatch failed',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentStatusBadge() {
  const { data, isError, isLoading } = useAgentHealth()

  if (isLoading) return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
      <span className="text-xs text-slate-400">Connecting…</span>
    </div>
  )

  if (isError) return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
      <WifiOff className="w-3.5 h-3.5 text-red-400" />
      <span className="text-xs text-red-400 font-semibold">Agent Offline</span>
    </div>
  )

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
      <span className="text-xs text-emerald-400 font-semibold">Agent Online</span>
      <span className="text-[10px] text-slate-500 border-l border-white/10 pl-2">
        {fmtUptime(data?.uptime ?? 0)} · {data?.mongo === 'connected' ? '🟢 DB' : '🔴 DB'}
      </span>
    </div>
  )
}

function SubBadge({ status }: { status: string }) {
  const s = SUB_STATUS[status] ?? SUB_STATUS.received
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border', s.color, s.bg, s.border)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
      {s.label}
    </span>
  )
}

function BatchBadge({ status }: { status: string }) {
  const s = BATCH_STATUS[status] ?? BATCH_STATUS.open
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', s.color, s.bg, s.border)}>
      {s.label}
    </span>
  )
}

// ── Submission Detail Modal ────────────────────────────────────────────────────
function SubmissionModal({ sub, onClose }: { sub: Submission; onClose: () => void }) {
  const s = SUB_STATUS[sub.status] ?? SUB_STATUS.received

  const steps = [
    { key: 'received',       label: 'Message received',   icon: MessageSquare },
    { key: 'code_extracted', label: 'Code extracted',     icon: Hash },
    { key: 'student_found',  label: 'Student resolved',   icon: User },
    { key: 'queued',         label: 'Added to batch',     icon: Layers },
    { key: 'dispatched',     label: 'Sent to ClassQuiz',  icon: Send },
  ]

  const ORDER = ['received','code_extracted','student_found','queued','dispatched']
  const currentIdx = sub.status === 'failed'
    ? ORDER.indexOf(sub.failReason === 'no_code' ? 'received' : 'code_extracted')
    : ORDER.indexOf(sub.status)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        className="glass-card w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center">
              <MessageSquare className="w-4.5 h-4.5 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{sub.senderName || 'Unknown sender'}</p>
              <p className="text-[10px] text-slate-500 font-mono">{fmtPhone(sub.senderPhone)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SubBadge status={sub.status} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Caption & Code */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Caption reçue</p>
              <p className="text-sm text-white font-mono">{sub.rawCaption || <span className="text-slate-600 italic">empty</span>}</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Code extrait</p>
              {sub.extractedCode
                ? <span className="text-sm font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">{sub.extractedCode}</span>
                : <span className="text-slate-600 text-xs italic">not found</span>
              }
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Étudiant</p>
              <p className="text-sm text-white">{sub.studentName || <span className="text-slate-600 italic">—</span>}</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Reçu</p>
              <p className="text-xs text-slate-300">{new Date(sub.createdAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Pipeline steps */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Pipeline</p>
            <div className="space-y-2">
              {steps.map((step, i) => {
                const done    = !sub.status.startsWith('fail') && ORDER.indexOf(sub.status) >= i
                const failed  = sub.status === 'failed' && i === currentIdx + 1
                const active  = ORDER.indexOf(sub.status) === i && sub.status !== 'failed'
                const Icon    = step.icon

                return (
                  <div key={step.key} className={cn(
                    'flex items-center gap-3 p-2.5 rounded-xl border transition-all',
                    done    ? 'bg-emerald-500/5 border-emerald-500/15' :
                    failed  ? 'bg-red-500/5 border-red-500/15' :
                    active  ? 'bg-amber-500/5 border-amber-500/15' :
                              'bg-white/[0.02] border-white/[0.04]'
                  )}>
                    <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0',
                      done ? 'bg-emerald-500/20' : failed ? 'bg-red-500/20' : active ? 'bg-amber-500/20' : 'bg-white/[0.05]'
                    )}>
                      {done
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        : failed
                        ? <XCircle className="w-3.5 h-3.5 text-red-400" />
                        : <Icon className={cn('w-3.5 h-3.5', active ? 'text-amber-400' : 'text-slate-600')} />
                      }
                    </div>
                    <span className={cn('text-xs font-medium',
                      done ? 'text-emerald-300' : failed ? 'text-red-300' : active ? 'text-amber-300' : 'text-slate-600'
                    )}>
                      {step.label}
                    </span>
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Error detail */}
          {sub.status === 'failed' && sub.failReason && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-300 mb-1">
                {FAIL_REASON[sub.failReason] || sub.failReason}
              </p>
              {sub.errorDetail && (
                <p className="text-[10px] text-red-400/70 font-mono">{sub.errorDetail}</p>
              )}
            </div>
          )}

          {/* IDs */}
          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
            <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-2">Identifiants</p>
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-slate-500">
                <span className="text-slate-600">MSG:</span> {sub.whatsappMessageId}
              </p>
              {sub.batchId && (
                <p className="text-[10px] font-mono text-slate-500">
                  <span className="text-slate-600">BATCH:</span> {sub.batchId}
                </p>
              )}
              {sub.studentExamId && (
                <p className="text-[10px] font-mono text-slate-500">
                  <span className="text-slate-600">EXAM:</span> {sub.studentExamId}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Submission Row ─────────────────────────────────────────────────────────────
function SubmissionRow({ sub, delay, onSelect }: { sub: Submission; delay: number; onSelect: (s: Submission) => void }) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      onClick={() => onSelect(sub)}
      className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors cursor-pointer"
    >
      {/* Sender */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
            <Phone className="w-3.5 h-3.5 text-green-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">{sub.senderName || 'Unknown'}</p>
            <p className="text-[10px] text-slate-500 font-mono">{fmtPhone(sub.senderPhone)}</p>
          </div>
        </div>
      </td>

      {/* Caption */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-400 font-mono">
          {sub.rawCaption
            ? sub.rawCaption.length > 20 ? sub.rawCaption.slice(0,20)+'…' : sub.rawCaption
            : <span className="text-slate-600 italic">empty</span>
          }
        </span>
      </td>

      {/* Code */}
      <td className="px-4 py-3">
        {sub.extractedCode
          ? <span className="font-mono text-xs bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/20">{sub.extractedCode}</span>
          : <span className="text-slate-600 text-xs">—</span>
        }
      </td>

      {/* Student */}
      <td className="px-4 py-3">
        <p className="text-xs text-slate-300 truncate max-w-[120px]">{sub.studentName || '—'}</p>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <SubBadge status={sub.status} />
      </td>

      {/* Time */}
      <td className="px-4 py-3">
        <span className="text-[10px] text-slate-500">{timeAgo(sub.createdAt)}</span>
      </td>

      {/* Arrow */}
      <td className="px-4 py-3">
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
      </td>
    </motion.tr>
  )
}

// ── Batch Card ─────────────────────────────────────────────────────────────────
function BatchCard({ batch, index }: { batch: Batch; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const dispatch = useDispatch()
  const s = BATCH_STATUS[batch.status] ?? BATCH_STATUS.open

  const progress = batch.status === 'dispatched' ? 100
    : batch.status === 'dispatching' ? 65
    : Math.min(90, (batch.count / 30) * 100)

  const barColor = batch.status === 'failed' ? '#ef4444'
    : batch.status === 'dispatched' ? '#10b981'
    : batch.status === 'dispatching' ? '#f59e0b'
    : '#0ea5e9'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card overflow-hidden"
    >
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.025] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Icon */}
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', s.bg, s.border, 'border')}>
          <Layers className={cn('w-4.5 h-4.5', s.color)} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-bold text-white font-mono">#{batch._id.slice(-8).toUpperCase()}</p>
            <BatchBadge status={batch.status} />
            {batch.dispatchTrigger && (
              <span className="text-[9px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded">{batch.dispatchTrigger}</span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mb-2">
            {batch.count} copies · exam {batch.examId.slice(-8)}
          </p>
          {/* Progress */}
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              style={{ background: barColor }}
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {batch.status === 'dispatched' && (
            <div className="text-right">
              <p className="text-xs font-bold text-emerald-400">{batch.successCount} ✓</p>
              {batch.failedCount > 0 && <p className="text-[10px] text-red-400">{batch.failedCount} ✗</p>}
            </div>
          )}
          <p className="text-[10px] text-slate-500">{timeAgo(batch.createdAt)}</p>

          {batch.status === 'open' && (
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={e => { e.stopPropagation(); dispatch.mutate(batch._id) }}
              disabled={dispatch.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
            >
              {dispatch.isPending ? <RotateCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Dispatch
            </motion.button>
          )}

          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </motion.div>
        </div>
      </div>

      {/* Expanded submissions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.05] p-4 bg-white/[0.015]">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Copies dans ce batch ({batch.count})
              </p>
              {batch.dispatchError && (
                <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                  <p className="text-xs text-red-400 font-mono">{batch.dispatchError}</p>
                </div>
              )}
              {batch.classquizBatchId && (
                <div className="mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                  <p className="text-[10px] text-emerald-400">
                    ✅ ClassQuiz Batch ID: <span className="font-mono">{batch.classquizBatchId}</span>
                  </p>
                </div>
              )}
              {(batch.submissionIds as unknown as Submission[])?.map(sub => (
                <div key={sub._id ?? sub} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                  <div className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-300 flex-1">{(sub as any).studentName || (sub as any)._id}</p>
                  {(sub as any).extractedCode && (
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      {(sub as any).extractedCode}
                    </span>
                  )}
                  <SubBadge status={(sub as any).status || 'queued'} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Stats Cards ────────────────────────────────────────────────────────────────
function StatsRow({ stats }: { stats: Stats }) {
  const by = Object.fromEntries(stats.submissions.map(s => [s._id, s.count]))
  const total      = stats.submissions.reduce((a, s) => a + s.count, 0)
  const dispatched = by['dispatched'] ?? 0
  const queued     = (by['queued'] ?? 0) + (by['student_found'] ?? 0)
  const failed     = by['failed'] ?? 0
  const processing = (by['received'] ?? 0) + (by['code_extracted'] ?? 0)
  const openBatches = stats.batches.find(b => b._id === 'open')?.count ?? 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Total Messages"  value={total}      icon={Inbox}         gradient="quiz"  delay={0}    subtitle={`${processing} processing`} />
      <StatCard title="Dispatched"      value={dispatched} icon={Send}          gradient="teal"  delay={0.05} subtitle="Sent to ClassQuiz" />
      <StatCard title="In Queue"        value={queued}     icon={Clock}         gradient="class" delay={0.1}  subtitle={`${openBatches} open batch${openBatches !== 1 ? 'es' : ''}`} />
      <StatCard title="Failed"          value={failed}     icon={AlertTriangle} gradient="red"   delay={0.15} subtitle="Check error details" />
    </div>
  )
}

// ── Pipeline Funnel ────────────────────────────────────────────────────────────
function PipelineFunnel({ stats }: { stats: Stats }) {
  const by = Object.fromEntries(stats.submissions.map(s => [s._id, s.count]))
  const total = stats.submissions.reduce((a, s) => a + s.count, 0) || 1

  const stages = [
    { key: 'received',       label: 'Received',      count: by['received'] ?? 0,       color: '#0ea5e9' },
    { key: 'code_extracted', label: 'Code Found',    count: by['code_extracted'] ?? 0,  color: '#f59e0b' },
    { key: 'student_found',  label: 'Student OK',    count: by['student_found'] ?? 0,   color: '#14b8a6' },
    { key: 'queued',         label: 'In Queue',      count: by['queued'] ?? 0,           color: '#8b5cf6' },
    { key: 'dispatched',     label: 'Dispatched',    count: by['dispatched'] ?? 0,       color: '#10b981' },
    { key: 'failed',         label: 'Failed',        count: by['failed'] ?? 0,           color: '#ef4444' },
  ]

  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => (
        <div key={s.key} className="flex items-center gap-3">
          <p className="text-[10px] text-slate-400 w-20 text-right flex-shrink-0 truncate">{s.label}</p>
          <div className="flex-1 h-6 bg-white/[0.04] rounded-lg overflow-hidden">
            <motion.div
              className="h-full rounded-lg flex items-center px-2.5"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(s.count > 0 ? 8 : 0, (s.count / total) * 100)}%` }}
              transition={{ delay: i * 0.07, duration: 0.6, ease: 'easeOut' }}
              style={{ background: `${s.color}20`, borderRight: `2px solid ${s.color}50` }}
            >
              {s.count > 0 && (
                <span className="text-[10px] font-bold" style={{ color: s.color }}>{s.count}</span>
              )}
            </motion.div>
          </div>
          <p className="text-[10px] font-mono text-slate-500 w-8 text-right">
            {total > 1 ? `${Math.round((s.count / total) * 100)}%` : '—'}
          </p>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

type Tab = 'messages' | 'batches'
type Filter = 'all' | 'received' | 'code_extracted' | 'student_found' | 'queued' | 'dispatched' | 'failed'

export default function WhatsappPage() {
  const [tab, setTab]               = useState<Tab>('messages')
  const [filter, setFilter]         = useState<Filter>('all')
  const [page, setPage]             = useState(1)
  const [selected, setSelected]     = useState<Submission | null>(null)
  const [batchFilter, setBatchFilter] = useState<string>('all')
  const qc                          = useQueryClient()

  const { data: stats }       = useWaStats()
  const { data: subData, isLoading: subLoading } = useWaSubmissions({
    status: filter !== 'all' ? filter : undefined,
    page,
  })
  const { data: batchData, isLoading: batchLoading } = useWaBatches({
    status: batchFilter !== 'all' ? batchFilter : undefined,
  })

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['wa-'] as any })
  }, [qc])

  // Auto-refresh toutes les 6s
  useEffect(() => {
    const id = setInterval(handleRefresh, 6000)
    return () => clearInterval(id)
  }, [handleRefresh])

  const filters: { key: Filter; label: string }[] = [
    { key: 'all',            label: 'All' },
    { key: 'received',       label: 'Received' },
    { key: 'code_extracted', label: 'Code Found' },
    { key: 'student_found',  label: 'Student OK' },
    { key: 'queued',         label: 'In Queue' },
    { key: 'dispatched',     label: 'Dispatched' },
    { key: 'failed',         label: 'Failed' },
  ]

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500/25 to-teal-500/15 flex items-center justify-center border border-green-500/20">
            <MessageSquare className="w-5.5 h-5.5 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">WhatsApp Monitor</h2>
            <p className="text-xs text-slate-400">Messages reçus des parents · Pipeline en temps réel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AgentStatusBadge />
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs text-slate-300 hover:text-white transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </motion.button>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      {stats && <StatsRow stats={stats} />}

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Funnel sidebar */}
        <div className="lg:col-span-1">
          <SectionCard title="Pipeline funnel">
            {stats
              ? <PipelineFunnel stats={stats} />
              : <p className="text-xs text-slate-500 text-center py-8">No data</p>
            }
          </SectionCard>
        </div>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06] w-fit">
            {([
              { key: 'messages', label: 'Messages', icon: Inbox },
              { key: 'batches',  label: 'Batches',  icon: Layers },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
                  tab === t.key ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {t.key === 'messages' && subData && (
                  <span className="ml-1 bg-white/10 text-slate-300 text-[9px] px-1.5 py-0.5 rounded-full">
                    {subData.pagination.total}
                  </span>
                )}
                {t.key === 'batches' && batchData && (
                  <span className="ml-1 bg-white/10 text-slate-300 text-[9px] px-1.5 py-0.5 rounded-full">
                    {batchData.pagination.total}
                  </span>
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">

            {/* ── MESSAGES TAB ────────────────────────────────────────────── */}
            {tab === 'messages' && (
              <motion.div key="messages" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <SectionCard
                  action={
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">Filter:</span>
                      <div className="flex gap-1 flex-wrap">
                        {filters.map(f => (
                          <button
                            key={f.key}
                            onClick={() => { setFilter(f.key); setPage(1) }}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all',
                              filter === f.key
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.06]'
                            )}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full table-dark">
                      <thead>
                        <tr>
                          <th>Sender</th>
                          <th>Caption</th>
                          <th>Code</th>
                          <th>Student</th>
                          <th>Status</th>
                          <th>Time</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {subLoading ? (
                          <tr><td colSpan={7} className="text-center py-10 text-xs text-slate-500">Loading…</td></tr>
                        ) : !subData?.submissions.length ? (
                          <tr><td colSpan={7} className="text-center py-10 text-xs text-slate-500">No messages yet</td></tr>
                        ) : (
                          subData.submissions.map((s, i) => (
                            <SubmissionRow key={s._id} sub={s} delay={i * 0.03} onSelect={setSelected} />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {subData && subData.pagination.pages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
                      <p className="text-xs text-slate-500">
                        {subData.pagination.total} total · page {page}/{subData.pagination.pages}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                          className="px-3 py-1 rounded-lg bg-white/[0.06] text-xs text-slate-300 disabled:opacity-40 hover:bg-white/[0.1] transition-colors">
                          ← Prev
                        </button>
                        <button onClick={() => setPage(p => Math.min(subData.pagination.pages, p+1))} disabled={page === subData.pagination.pages}
                          className="px-3 py-1 rounded-lg bg-white/[0.06] text-xs text-slate-300 disabled:opacity-40 hover:bg-white/[0.1] transition-colors">
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </SectionCard>
              </motion.div>
            )}

            {/* ── BATCHES TAB ─────────────────────────────────────────────── */}
            {tab === 'batches' && (
              <motion.div key="batches" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">

                {/* Filter row */}
                <div className="flex items-center gap-2">
                  {['all', 'open', 'dispatched', 'failed'].map(f => (
                    <button
                      key={f}
                      onClick={() => setBatchFilter(f)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize',
                        batchFilter === f ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'btn-ghost'
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {batchLoading ? (
                  <div className="glass-card p-8 text-center text-xs text-slate-500">Loading…</div>
                ) : !batchData?.batches.length ? (
                  <EmptyState icon={Layers} title="No batches yet" description="Batches are created automatically when photos arrive" />
                ) : (
                  batchData.batches.map((b, i) => <BatchCard key={b._id} batch={b} index={i} />)
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div className="flex justify-end">
        <p className="text-[10px] text-slate-700">Auto-refresh every 6s</p>
      </div>

      {/* ── Submission Detail Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && <SubmissionModal sub={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>

    </div>
  )
}
