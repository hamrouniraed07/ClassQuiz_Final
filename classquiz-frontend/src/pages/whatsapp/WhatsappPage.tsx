/**
 * src/pages/whatsapp/WhatsappPage.tsx — REFONTE COMPLÈTE
 *
 * Nouveau workflow :
 *   1. Inbox : chaque photo reçue affiche l'image + code + expéditeur
 *   2. L'admin choisit l'examen (dropdown) et le batch (dropdown)
 *   3. Il confirme l'assignation → la soumission passe en "queued"
 *   4. Il peut dispatcher le batch depuis la vue Batches
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Image, Send, Clock, AlertTriangle, Inbox, Layers,
  CheckCircle2, XCircle, RefreshCw, ChevronDown, Play,
  RotateCw, Wifi, WifiOff, Hash, User, Phone, BookOpen,
  ArrowRight, Pause, Search, X, Eye, LayoutGrid
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import api from '@/lib/api'

// ── Config ────────────────────────────────────────────────────────────────────
const AGENT_URL = import.meta.env.VITE_WHATSAPP_AGENT_URL || 'http://localhost:4000'
const AGENT_KEY = import.meta.env.VITE_WHATSAPP_AGENT_KEY || 'change_this_secret_key'
const agentApi  = axios.create({ baseURL: AGENT_URL, headers: { 'x-agent-key': AGENT_KEY }, timeout: 10000 })

// ── Types ─────────────────────────────────────────────────────────────────────
interface Submission {
  _id: string
  senderPhone: string
  senderName: string | null
  rawCaption: string | null
  extractedCode: string | null
  studentId: string | null
  studentName: string | null
  examId: string | null
  batchId: string | null
  status: string
  failReason: string | null
  createdAt: string
  localImagePath: string | null
}
interface Batch {
  _id: string
  examId: string
  count: number
  status: 'open' | 'dispatching' | 'dispatched' | 'failed'
  successCount: number
  dispatchedAt: string | null
  createdAt: string
}
interface Exam { _id: string; title: string; subject: string; classLevel: string; status: string }
interface ActiveSession {
  _id: string; examId: string; examTitle: string | null; isActive: boolean
  receivedCount: number; indexedCount: number; failedCount: number
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useSession()    { return useQuery({ queryKey: ['wa-session'],    queryFn: () => agentApi.get('/session').then(r => r.data.data as ActiveSession | null), refetchInterval: 5000 }) }
function useExams()      { return useQuery({ queryKey: ['exams-active'],  queryFn: () => api.get('/exams?status=active&limit=50').then(r => r.data.data?.exams as Exam[] || []) }) }
function useSubmissions(filter: string) {
  return useQuery({
    queryKey: ['wa-subs', filter],
    queryFn: () => agentApi.get('/admin/submissions', { params: { status: filter !== 'all' ? filter : undefined, limit: 50 } }).then(r => r.data.data.submissions as Submission[]),
    refetchInterval: 6000,
  })
}
function useBatches() {
  return useQuery({
    queryKey: ['wa-batches'],
    queryFn: () => agentApi.get('/admin/batches', { params: { limit: 30 } }).then(r => r.data.data.batches as Batch[]),
    refetchInterval: 8000,
  })
}
function useStats() {
  return useQuery({
    queryKey: ['wa-stats'],
    queryFn: () => agentApi.get('/admin/stats').then(r => r.data.data),
    refetchInterval: 8000,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}
function fmtPhone(p: string) { return p ? `+${p}` : '—' }

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  received:       { label: 'Reçu',        color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20',     dot: 'bg-sky-400' },
  code_extracted: { label: 'Code OK',     color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400' },
  student_found:  { label: 'Étudiant OK', color: 'text-teal-400',    bg: 'bg-teal-500/10 border-teal-500/20',   dot: 'bg-teal-400' },
  queued:         { label: 'En attente',  color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20', dot: 'bg-violet-400 animate-pulse' },
  dispatched:     { label: 'Dispatché',   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
  failed:         { label: 'Échec',       color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',     dot: 'bg-red-500' },
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT — Aperçu image
// ══════════════════════════════════════════════════════════════════════════════
function SubmissionImage({ sub }: { sub: Submission }) {
  const [open, setOpen] = useState(false)
  const src = `${AGENT_URL}/admin/submissions/${sub._id}/image?key=${AGENT_KEY}`
  if (!sub.localImagePath) {
    return (
      <div className="w-16 h-16 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
        <Image className="w-6 h-6 text-slate-600" />
      </div>
    )
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 group border border-white/[0.08] hover:border-teal-500/40 transition-all">
        <img src={src} alt="copie" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
          <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setOpen(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="relative max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <img src={src} alt="copie" className="w-full h-full object-contain bg-slate-900" />
              <button onClick={() => setOpen(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80">
                <X className="w-4 h-4 text-white" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT — Ligne de soumission avec assignation
// ══════════════════════════════════════════════════════════════════════════════
function SubmissionRow({ sub, exams, batches, index }: { sub: Submission; exams: Exam[]; batches: Batch[]; index: number }) {
  const qc = useQueryClient()
  const [selectedExamId, setSelectedExamId] = useState(sub.examId || '')
  const [selectedBatchId, setSelectedBatchId] = useState(sub.batchId || '')
  const [showDropdowns, setShowDropdowns] = useState(false)

  const openBatches = batches.filter(b => b.status === 'open' && (!selectedExamId || b.examId === selectedExamId))
  const st = STATUS_META[sub.status] || STATUS_META.received

  const assign = useMutation({
    mutationFn: () => agentApi.patch(`/admin/submissions/${sub._id}/assign`, {
      examId:    selectedExamId,
      examTitle: exams.find(e => e._id === selectedExamId)?.title || '',
      batchId:   selectedBatchId || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-subs'] })
      qc.invalidateQueries({ queryKey: ['wa-batches'] })
      setShowDropdowns(false)
    },
  })

  const canAssign = ['received', 'code_extracted', 'student_found', 'failed'].includes(sub.status)
  const isAssigned = sub.examId && sub.batchId

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="glass-card p-4 hover:border-white/[0.12] transition-all"
    >
      <div className="flex gap-3 items-start">
        {/* Image */}
        <SubmissionImage sub={sub} />

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Statut */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.bg} ${st.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                {st.label}
              </span>
              {/* Code étudiant */}
              {sub.extractedCode && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                  <Hash className="w-2.5 h-2.5" />
                  {sub.extractedCode}
                </span>
              )}
              {/* Étudiant */}
              {sub.studentName && (
                <span className="inline-flex items-center gap-1 text-[10px] text-teal-400">
                  <User className="w-2.5 h-2.5" />
                  {sub.studentName}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-600 flex-shrink-0">{timeAgo(sub.createdAt)}</span>
          </div>

          {/* Expéditeur */}
          <div className="flex items-center gap-1 mb-2">
            <Phone className="w-3 h-3 text-slate-600" />
            <span className="text-xs text-slate-400">{sub.senderName || 'Inconnu'} · {fmtPhone(sub.senderPhone)}</span>
          </div>

          {/* Assignation actuelle */}
          {isAssigned && !showDropdowns && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
                <BookOpen className="w-2.5 h-2.5" />
                {exams.find(e => e._id === sub.examId)?.title || sub.examId}
              </div>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-400">
                <Layers className="w-2.5 h-2.5" />
                Batch #{batches.findIndex(b => b._id === sub.batchId) + 1 || '?'}
              </div>
            </div>
          )}

          {/* Dropdowns d'assignation */}
          <AnimatePresence>
            {showDropdowns && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="flex gap-2 mt-2 flex-wrap">
                  {/* Sélecteur d'examen */}
                  <div className="relative flex-1 min-w-[160px]">
                    <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Examen</label>
                    <div className="relative">
                      <select
                        value={selectedExamId}
                        onChange={e => { setSelectedExamId(e.target.value); setSelectedBatchId('') }}
                        className="w-full appearance-none bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white pr-7 focus:outline-none focus:border-teal-500/50"
                      >
                        <option value="">— Choisir un examen —</option>
                        {exams.map(e => <option key={e._id} value={e._id}>{e.title}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Sélecteur de batch */}
                  <div className="relative flex-1 min-w-[140px]">
                    <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Batch</label>
                    <div className="relative">
                      <select
                        value={selectedBatchId}
                        onChange={e => setSelectedBatchId(e.target.value)}
                        disabled={!selectedExamId}
                        className="w-full appearance-none bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white pr-7 focus:outline-none focus:border-violet-500/50 disabled:opacity-40"
                      >
                        <option value="">— Nouveau batch —</option>
                        {openBatches.map((b, i) => <option key={b._id} value={b._id}>Batch #{i + 1} · {b.count} copies</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Boutons */}
                  <div className="flex items-end gap-1.5">
                    <button onClick={() => setShowDropdowns(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-400 hover:text-white transition-colors">
                      Annuler
                    </button>
                    <button
                      onClick={() => assign.mutate()}
                      disabled={!selectedExamId || assign.isPending}
                      className="px-3 py-1.5 rounded-lg bg-teal-500/20 border border-teal-500/30 text-xs text-teal-300 font-bold hover:bg-teal-500/30 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {assign.isPending ? <RotateCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Confirmer
                    </button>
                  </div>
                </div>
                {assign.isError && (
                  <p className="text-[10px] text-red-400 mt-1">{(assign.error as any)?.response?.data?.message || 'Erreur'}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          {canAssign && !showDropdowns && (
            <button
              onClick={() => setShowDropdowns(true)}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-400 font-bold hover:bg-sky-500/20 transition-colors"
            >
              <LayoutGrid className="w-3 h-3" />
              {isAssigned ? 'Réassigner' : 'Assigner à un examen'}
            </button>
          )}

          {/* Raison d'échec */}
          {sub.failReason && (
            <p className="mt-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
              ✗ {sub.failReason}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT — Carte batch
// ══════════════════════════════════════════════════════════════════════════════
function BatchCard({ batch, exams, index }: { batch: Batch; exams: Exam[]; index: number }) {
  const qc = useQueryClient()
  const exam = exams.find(e => e._id === batch.examId)

  const dispatch = useMutation({
    mutationFn: () => agentApi.post(`/admin/batches/${batch._id}/dispatch`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-batches'] })
      qc.invalidateQueries({ queryKey: ['wa-subs'] })
      qc.invalidateQueries({ queryKey: ['wa-stats'] })
    },
  })

  const statusColor = {
    open: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    dispatching: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    dispatched: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    failed: 'text-red-400 bg-red-500/10 border-red-500/20',
  }[batch.status]

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card p-4 flex items-center gap-4"
    >
      {/* Numéro */}
      <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-violet-400">#{index + 1}</span>
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
            {batch.status}
          </span>
          <span className="text-xs font-semibold text-white truncate">
            {exam?.title || batch.examId}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{batch.count} copies</span>
          {batch.status === 'dispatched' && <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3 h-3" />{batch.successCount} envoyées</span>}
          <span>{timeAgo(batch.createdAt)}</span>
        </div>
        {/* Barre de progression */}
        <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: batch.status === 'dispatched' ? '100%' : `${Math.min(95, (batch.count / 30) * 100)}%` }}
            className="h-full rounded-full"
            style={{ background: batch.status === 'dispatched' ? '#10b981' : batch.status === 'failed' ? '#ef4444' : '#8b5cf6' }}
          />
        </div>
      </div>

      {/* Action */}
      {batch.status === 'open' && (
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => dispatch.mutate()}
          disabled={dispatch.isPending}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {dispatch.isPending ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Dispatcher
        </motion.button>
      )}
      {batch.status === 'dispatched' && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 flex-shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" /> Envoyé
        </div>
      )}
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════════════════════════════════════════
type Tab    = 'inbox' | 'batches'
type Filter = 'all' | 'received' | 'queued' | 'dispatched' | 'failed'

export default function WhatsappPage() {
  const [tab, setTab]       = useState<Tab>('inbox')
  const [filter, setFilter] = useState<Filter>('all')
  const qc                  = useQueryClient()

  const { data: session }  = useSession()
  const { data: exams = [] } = useExams()
  const { data: subs = [], isLoading: subsLoading }   = useSubmissions(filter)
  const { data: batches = [], isLoading: batchLoading } = useBatches()
  const { data: stats }    = useStats()

  // Totaux depuis stats
  const total      = stats?.submissions.reduce((a: number, s: any) => a + s.count, 0) || 0
  const queued     = stats?.submissions.find((s: any) => s._id === 'queued')?.count || 0
  const dispatched = stats?.submissions.find((s: any) => s._id === 'dispatched')?.count || 0
  const failed     = stats?.submissions.find((s: any) => s._id === 'failed')?.count || 0
  const openBatches = batches.filter(b => b.status === 'open').length

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: 'all',        label: 'Tous',         count: total },
    { key: 'received',   label: '📥 Nouveaux' },
    { key: 'queued',     label: '⏳ En attente', count: queued },
    { key: 'dispatched', label: '✅ Dispatchés', count: dispatched },
    { key: 'failed',     label: '❌ Échecs',     count: failed },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">WhatsApp Inbox</h1>
          <p className="text-xs text-slate-400 mt-0.5">Assignez chaque copie reçue à un examen et un batch</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Session pill */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
            session?.isActive
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
          }`}>
            {session?.isActive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {session?.isActive ? `Réception active · ${session.examTitle}` : 'Réception suspendue'}
          </div>
          <button onClick={() => qc.invalidateQueries()}
            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total reçus',    value: total,      icon: Inbox,         color: 'text-sky-400',     bg: 'bg-sky-500/10' },
          { label: 'En attente',     value: queued,     icon: Clock,         color: 'text-violet-400',  bg: 'bg-violet-500/10' },
          { label: 'Dispatchés',     value: dispatched, icon: Send,          color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Batches ouverts',value: openBatches,icon: Layers,        color: 'text-amber-400',   bg: 'bg-amber-500/10' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass-card p-4">
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit">
        {([
          { key: 'inbox',   label: 'Inbox',   icon: Inbox,  badge: subs.filter(s => !s.examId).length },
          { key: 'batches', label: 'Batches', icon: Layers, badge: openBatches },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.key ? 'bg-white/[0.08] text-white shadow' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.badge > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                tab === t.key ? 'bg-teal-500/20 text-teal-300' : 'bg-white/[0.06] text-slate-500'
              }`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Inbox ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {tab === 'inbox' && (
          <motion.div key="inbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

            {/* Filtres */}
            <div className="flex gap-1.5 flex-wrap">
              {filters.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    filter === f.key
                      ? 'bg-white/[0.1] border-white/[0.15] text-white'
                      : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300'
                  }`}>
                  {f.label}
                  {f.count !== undefined && f.count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-white/[0.08] text-slate-400">{f.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Aide contextuelle */}
            {filter === 'all' && subs.some(s => !s.examId) && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-sky-500/5 border border-sky-500/15">
                <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ArrowRight className="w-3 h-3 text-sky-400" />
                </div>
                <p className="text-xs text-sky-300">
                  <span className="font-bold">{subs.filter(s => !s.examId).length} copie(s) non assignée(s)</span> — Cliquez sur
                  <span className="mx-1 px-1.5 py-0.5 bg-sky-500/20 rounded text-sky-300 font-mono text-[10px]">Assigner à un examen</span>
                  pour chaque photo, choisissez l'examen et le batch, puis confirmez.
                </p>
              </div>
            )}

            {/* Liste */}
            {subsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="glass-card p-4 animate-pulse h-24" />
                ))}
              </div>
            ) : subs.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <Inbox className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  {session?.isActive ? 'Aucune soumission pour ce filtre' : '⏸ Activez un examen pour recevoir des photos'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {subs.map((sub, i) => (
                  <SubmissionRow key={sub._id} sub={sub} exams={exams} batches={batches} index={i} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Tab: Batches ───────────────────────────────────────────────── */}
        {tab === 'batches' && (
          <motion.div key="batches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

            {openBatches > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">
                  <span className="font-bold">{openBatches} batch(s) ouvert(s)</span> · Cliquez sur <span className="font-bold">Dispatcher</span> pour envoyer vers ClassQuiz et déclencher l'OCR + correction.
                </p>
              </div>
            )}

            {batchLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="glass-card p-4 animate-pulse h-20" />)}
              </div>
            ) : batches.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <Layers className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Aucun batch — assignez d'abord des copies depuis l'Inbox</p>
              </div>
            ) : (
              <div className="space-y-3">
                {batches.map((b, i) => <BatchCard key={b._id} batch={b} exams={exams} index={i} />)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[10px] text-slate-700 text-right">Actualisation automatique toutes les 6s</p>
    </div>
  )
}