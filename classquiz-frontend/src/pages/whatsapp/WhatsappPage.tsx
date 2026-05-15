/**
 * src/pages/whatsapp/WhatsappPage.tsx — VERSION MISE À JOUR
 *
 * Nouveau feature : Sélecteur d'examen actif
 *   - L'admin choisit l'examen depuis un dropdown
 *   - Toutes les photos WhatsApp s'indexent dans cet examen
 *   - Indicateur visuel de l'examen actif dans le header
 *   - Bouton Pause pour suspendre la réception
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, CheckCircle2, XCircle, Clock, Send,
  RefreshCw, Play, ChevronDown, Phone, Layers, Activity,
  Inbox, X, AlertTriangle, Wifi, WifiOff, RotateCw,
  User, Hash, BookOpen, Pause, ChevronRight, Search,
  FlaskConical
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { StatCard, SectionCard, LoadingPage, EmptyState } from '@/components/shared'
import { cn } from '@/lib/utils'

import { useActiveSession, useActiveExams, useActivateSession, useDeactivateSession, useWaStats, useWaSubmissions, useWaBatches, useDispatch } from '@/hooks/useWhatsapp'
import type { ActiveSession, Exam, Submission, Batch } from '@/types/whatsapp'

// Hooks and types moved to dedicated files: src/hooks/useWhatsapp.ts and src/types/whatsapp.ts


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

const SUB_STATUS: Record<string, any> = {
  received:       { label: 'Received',   color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     dot: 'bg-sky-400' },
  code_extracted: { label: 'Code OK',    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-400' },
  student_found:  { label: 'Student OK', color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    dot: 'bg-teal-400' },
  queued:         { label: 'In Queue',   color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  dot: 'bg-violet-400 animate-pulse' },
  dispatched:     { label: 'Dispatched', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  failed:         { label: 'Failed',     color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-500' },
}

function SubBadge({ status }: { status: string }) {
  const s = SUB_STATUS[status] ?? SUB_STATUS.received
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border', s.color, s.bg, s.border)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAM SELECTOR PANEL — Le composant principal nouveau
// ══════════════════════════════════════════════════════════════════════════════
function ExamSelectorPanel() {
  const { data: session, isLoading: sessionLoading } = useActiveSession()
  const { data: exams = [], isLoading: examsLoading } = useActiveExams()
  const activate   = useActivateSession()
  const deactivate = useDeactivateSession()
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)

  const filtered = exams.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.subject.toLowerCase().includes(search.toLowerCase()) ||
    e.classLevel.toLowerCase().includes(search.toLowerCase())
  )

  const hasActiveSession = session?.isActive

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Examen actif</p>
            <p className="text-[10px] text-slate-500">Les photos WhatsApp s'indexent ici</p>
          </div>
        </div>
        {hasActiveSession && (
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => deactivate.mutate()}
            disabled={deactivate.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </motion.button>
        )}
      </div>

      {/* Session active affichée */}
      {hasActiveSession ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-xs font-bold text-emerald-300">Réception active</p>
              </div>
              <p className="text-sm font-bold text-white mb-0.5">{session.examTitle || session.examId}</p>
              <p className="text-[10px] text-slate-400">
                {session.examSubject} · {session.classLevel}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-white">{session.indexedCount}</p>
              <p className="text-[10px] text-slate-500">indexées</p>
            </div>
          </div>
          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
            {[
              { label: 'Reçues',  value: session.receivedCount, color: 'text-sky-400' },
              { label: 'Indexées', value: session.indexedCount,  color: 'text-emerald-400' },
              { label: 'Erreurs', value: session.failedCount,   color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={cn('text-base font-bold', s.color)}>{s.value}</p>
                <p className="text-[9px] text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4 mb-4 text-center">
          <Pause className="w-6 h-6 text-slate-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-semibold">Réception suspendue</p>
          <p className="text-[10px] text-slate-600 mt-0.5">Sélectionne un examen pour activer</p>
        </div>
      )}

      {/* Bouton ouvrir sélecteur */}
      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
      >
        <span className="text-xs text-slate-300 font-semibold">
          {open ? 'Fermer' : hasActiveSession ? 'Changer d\'examen' : 'Sélectionner un examen'}
        </span>
        <motion.div animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </motion.div>
      </motion.button>

      {/* Liste des examens */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un examen..."
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/40"
                />
              </div>

              {/* Exam list */}
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {examsLoading ? (
                  <p className="text-xs text-slate-500 text-center py-4">Chargement…</p>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">
                    Aucun examen actif trouvé
                  </p>
                ) : (
                  filtered.map(exam => (
                    <motion.button
                      key={exam._id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        activate.mutate(exam)
                        setOpen(false)
                        setSearch('')
                      }}
                      disabled={activate.isPending}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                        session?.examId === exam._id && session?.isActive
                          ? 'bg-amber-500/15 border-amber-500/30'
                          : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12]'
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                        <FlaskConical className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{exam.title}</p>
                        <p className="text-[10px] text-slate-500">{exam.subject} · {exam.classLevel}</p>
                      </div>
                      {session?.examId === exam._id && session?.isActive && (
                        <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      )}
                    </motion.button>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
            <Phone className="w-3.5 h-3.5 text-green-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">{sub.senderName || 'Unknown'}</p>
            <p className="text-[10px] text-slate-500 font-mono">{fmtPhone(sub.senderPhone)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-slate-400 font-mono">
          {sub.rawCaption || <span className="text-slate-600 italic">empty</span>}
        </span>
      </td>
      <td className="px-4 py-3">
        {sub.extractedCode
          ? <span className="font-mono text-xs bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">{sub.extractedCode}</span>
          : <span className="text-slate-600 text-xs">—</span>
        }
      </td>
      <td className="px-4 py-3">
        <p className="text-xs text-slate-300 truncate max-w-[100px]">{sub.studentName || '—'}</p>
      </td>
      <td className="px-4 py-3"><SubBadge status={sub.status} /></td>
      <td className="px-4 py-3"><span className="text-[10px] text-slate-500">{timeAgo(sub.createdAt)}</span></td>
      <td className="px-4 py-3"><ChevronRight className="w-3.5 h-3.5 text-slate-600" /></td>
    </motion.tr>
  )
}

// ── Batch Card ────────────────────────────────────────────────────────────────
function BatchCard({ batch, index }: { batch: Batch; index: number }) {
  const dispatch = useDispatch()
  const colors = {
    open:        { text: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
    dispatching: { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
    dispatched:  { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    failed:      { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  }
  const c = colors[batch.status] || colors.open

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="glass-card p-4 flex items-center gap-4"
    >
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border', c.bg, c.border)}>
        <Layers className={cn('w-4.5 h-4.5', c.text)} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-bold text-white font-mono">#{batch._id.slice(-8).toUpperCase()}</p>
          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', c.text, c.bg, c.border)}>
            {batch.status}
          </span>
          {batch.dispatchTrigger && (
            <span className="text-[9px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded">{batch.dispatchTrigger}</span>
          )}
        </div>
        <p className="text-[10px] text-slate-500">{batch.count} copies · {timeAgo(batch.createdAt)}</p>
        <div className="mt-1.5 h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${batch.status === 'dispatched' ? 100 : Math.min(90, (batch.count / 30) * 100)}%` }}
            style={{ background: batch.status === 'dispatched' ? '#10b981' : batch.status === 'failed' ? '#ef4444' : '#0ea5e9' }}
          />
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        {batch.status === 'dispatched' && (
          <p className="text-xs font-bold text-emerald-400 mb-1">{batch.successCount} ✓</p>
        )}
        {batch.status === 'open' && (
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => dispatch.mutate(batch._id)}
            disabled={dispatch.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
          >
            {dispatch.isPending ? <RotateCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Dispatch
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
type Tab = 'messages' | 'batches'
type Filter = 'all' | 'received' | 'code_extracted' | 'student_found' | 'queued' | 'dispatched' | 'failed'

export default function WhatsappPage() {
  const [tab, setTab]       = useState<Tab>('messages')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage]     = useState(1)
  const [selected, setSelected] = useState<Submission | null>(null)
  const qc = useQueryClient()

  const { data: stats }   = useWaStats()
  const { data: subData, isLoading: subLoading } = useWaSubmissions({
    status: filter !== 'all' ? filter : undefined,
    page,
  })
  const { data: batchData, isLoading: batchLoading } = useWaBatches()
  const { data: session }  = useActiveSession()

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['wa-'] as any })
    qc.invalidateQueries({ queryKey: ['wa-session'] })
  }, [qc])

  useEffect(() => {
    const id = setInterval(handleRefresh, 6000)
    return () => clearInterval(id)
  }, [handleRefresh])

  // Stats
  const by = Object.fromEntries(stats?.submissions.map(s => [s._id, s.count]) || [])
  const total      = stats?.submissions.reduce((a, s) => a + s.count, 0) || 0
  const dispatched = by['dispatched'] || 0
  const queued     = (by['queued'] || 0) + (by['student_found'] || 0)
  const failed     = by['failed'] || 0

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'received', label: 'Received' },
    { key: 'code_extracted', label: 'Code OK' }, { key: 'student_found', label: 'Student OK' },
    { key: 'queued', label: 'In Queue' }, { key: 'dispatched', label: 'Dispatched' },
    { key: 'failed', label: 'Failed' },
  ]

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500/25 to-teal-500/15 flex items-center justify-center border border-green-500/20">
            <MessageSquare className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">WhatsApp Monitor</h2>
            <p className="text-xs text-slate-400">
              {session?.isActive
                ? `📚 Examen actif : ${session.examTitle || session.examId}`
                : '⏸ Aucun examen actif — sélectionne un examen'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Indicateur online/offline */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold',
            session?.isActive
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
          )}>
            {session?.isActive
              ? <><Wifi className="w-3.5 h-3.5" /> Receiving</>
              : <><WifiOff className="w-3.5 h-3.5" /> Paused</>
            }
          </div>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Messages"  value={total}      icon={Inbox}         gradient="quiz"  delay={0}    subtitle="All time" />
        <StatCard title="Dispatched"      value={dispatched} icon={Send}          gradient="teal"  delay={0.05} subtitle="Sent to ClassQuiz" />
        <StatCard title="In Queue"        value={queued}     icon={Clock}         gradient="class" delay={0.1}  subtitle="Waiting dispatch" />
        <StatCard title="Failed"          value={failed}     icon={AlertTriangle} gradient="red"   delay={0.15} subtitle="Check errors" />
      </div>

      {/* ── Main Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Exam Selector Sidebar */}
        <div className="lg:col-span-1">
          <ExamSelectorPanel />
        </div>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06] w-fit">
            {([
              { key: 'messages', label: 'Messages', icon: Inbox,  count: subData?.pagination.total },
              { key: 'batches',  label: 'Batches',  icon: Layers, count: batchData?.pagination.total },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as Tab)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
                  tab === t.key ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {t.count !== undefined && (
                  <span className="ml-1 bg-white/10 text-slate-300 text-[9px] px-1.5 py-0.5 rounded-full">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">

            {/* Messages Tab */}
            {tab === 'messages' && (
              <motion.div key="messages" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <SectionCard
                  action={
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
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full table-dark">
                      <thead>
                        <tr>
                          <th>Sender</th><th>Caption</th><th>Code</th>
                          <th>Student</th><th>Status</th><th>Time</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {subLoading ? (
                          <tr><td colSpan={7} className="text-center py-10 text-xs text-slate-500">Loading…</td></tr>
                        ) : !subData?.submissions.length ? (
                          <tr><td colSpan={7} className="text-center py-10 text-xs text-slate-500">
                            {session?.isActive ? 'No messages yet' : '⏸ Activate an exam to start receiving photos'}
                          </td></tr>
                        ) : (
                          subData.submissions.map((s, i) => (
                            <SubmissionRow key={s._id} sub={s} delay={i * 0.03} onSelect={setSelected} />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {subData && subData.pagination.pages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
                      <p className="text-xs text-slate-500">{subData.pagination.total} total · page {page}/{subData.pagination.pages}</p>
                      <div className="flex gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                          className="px-3 py-1 rounded-lg bg-white/[0.06] text-xs text-slate-300 disabled:opacity-40 hover:bg-white/[0.1]">← Prev</button>
                        <button onClick={() => setPage(p => Math.min(subData.pagination.pages, p+1))} disabled={page === subData.pagination.pages}
                          className="px-3 py-1 rounded-lg bg-white/[0.06] text-xs text-slate-300 disabled:opacity-40 hover:bg-white/[0.1]">Next →</button>
                      </div>
                    </div>
                  )}
                </SectionCard>
              </motion.div>
            )}

            {/* Batches Tab */}
            {tab === 'batches' && (
              <motion.div key="batches" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
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

      {/* Auto-refresh */}
      <div className="flex justify-end">
        <p className="text-[10px] text-slate-700">Auto-refresh every 6s</p>
      </div>

    </div>
  )
}
