import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Image, Send, Clock, Inbox, Layers, CheckCircle2, RotateCw,
  ChevronDown, Play, Pause, Wifi, WifiOff, Hash, User, Phone,
  BookOpen, ArrowRight, RefreshCw, Eye, LayoutGrid, X, Check,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import {
  AGENT_URL,
  AGENT_KEY,
  useActiveSession,
  useActiveExams,
  useWaSubmissions,
  useWaBatches,
  useWaStats,
  useActivateSession,
  useDeactivateSession,
  useAssignSubmission,
  useDispatchBatch,
} from '@/hooks/useWhatsapp'
import type { Submission, Batch, Exam, Tab, Filter } from '@/types/whatsapp'

//Helpers

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

function fmtPhone(p: string) {
  return p ? `+${p}` : '—'
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  received:       { label: 'Reçu',        color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20',       dot: 'bg-sky-400' },
  code_extracted: { label: 'Code OK',     color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',   dot: 'bg-amber-400' },
  student_found:  { label: 'Étudiant OK', color: 'text-teal-400',    bg: 'bg-teal-500/10 border-teal-500/20',     dot: 'bg-teal-400' },
  queued:         { label: 'En attente',  color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20', dot: 'bg-violet-400 animate-pulse' },
  dispatched:     { label: 'Dispatché',   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
  failed:         { label: 'Échec',       color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',       dot: 'bg-red-500' },
}

// CustomSelect

interface SelectOption { value: string; label: string }

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  accentColor?: string
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '— Choisir —',
  disabled = false,
  accentColor = 'border-teal-500/40',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const triggerRef  = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setStyle({ position: 'fixed', top: r.bottom + 4, left: r.left, width: r.width, zIndex: 10000 })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      // Don't close if click is inside the trigger OR inside the portal dropdown
      if (triggerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`
          w-full flex items-center justify-between gap-2
          bg-white/[0.06] border rounded-lg px-3 py-1.5 text-xs text-left
          transition-all disabled:opacity-40 disabled:cursor-not-allowed
          ${open ? `${accentColor} text-white` : 'border-white/[0.1] hover:border-white/[0.2]'}
        `}
      >
        <span className={`truncate ${selected ? 'text-white' : 'text-slate-500'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{
            ...style,
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          }}
        >
          {/* Reset / placeholder option */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors hover:bg-white/[0.06] ${!value ? 'text-teal-400' : 'text-slate-500'}`}
          >
            {placeholder}
            {!value && <Check className="w-3 h-3 flex-shrink-0" />}
          </button>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

          <div style={{ maxHeight: '12rem', overflowY: 'auto' }}>
            {options.length === 0
              ? <p className="px-3 py-2 text-[10px] text-slate-600 italic">Aucune option</p>
              : options.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 text-xs text-left
                      transition-colors hover:bg-white/[0.07]
                      ${opt.value === value ? 'text-white bg-white/[0.04]' : 'text-slate-300'}
                    `}
                  >
                    <span className="truncate pr-3">{opt.label}</span>
                    {opt.value === value && <Check className="w-3 h-3 text-teal-400 flex-shrink-0" />}
                  </button>
                ))
            }
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// SubmissionImage

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
      <button
        onClick={() => setOpen(true)}
        className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 group border border-white/[0.08] hover:border-teal-500/40 transition-all"
      >
        <img src={src} alt="copie" className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center transition-all">
          <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        </div>
      </button>

      {open && createPortal(
        <AnimatePresence>
          <motion.div key="img-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
            onClick={() => setOpen(false)}
          >
            <motion.div key="img-card"
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="relative rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
              style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center">
                    <Eye className="w-3.5 h-3.5 text-teal-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{sub.senderName || 'Inconnu'}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{fmtPhone(sub.senderPhone)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sub.extractedCode && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                      <Hash className="w-2.5 h-2.5" />{sub.extractedCode}
                    </span>
                  )}
                  <button onClick={() => setOpen(false)}
                    className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.12] transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto flex items-center justify-center p-2 min-h-0">
                <img src={src} alt="copie examen"
                  className="max-w-full max-h-full object-contain rounded-lg"
                  style={{ maxHeight: 'calc(85vh - 100px)' }}
                  onError={e => {
                    const t = e.target as HTMLImageElement
                    t.style.display = 'none'
                    if (t.parentElement)
                      t.parentElement.innerHTML = `<div style="text-align:center;padding:2rem;color:#64748b"><p style="font-size:0.75rem">Image non disponible</p></div>`
                  }}
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5 border-t border-white/[0.06] flex-shrink-0">
                {(() => {
                  const st = STATUS_META[sub.status] || STATUS_META.received
                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.bg} ${st.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  )
                })()}
                {sub.studentName && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-teal-400">
                    <User className="w-2.5 h-2.5" />{sub.studentName}
                  </span>
                )}
                <span className="text-[10px] text-slate-600 ml-auto">{timeAgo(sub.createdAt)}</span>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

// SubmissionRow

interface SubmissionRowProps {
  sub: Submission
  exams: Exam[]
  batches: Batch[]
  index: number
}

function SubmissionRow({ sub, exams, batches, index }: SubmissionRowProps) {
  const [selectedExamId, setSelectedExamId]   = useState(sub.examId ?? '')
  const [selectedBatchId, setSelectedBatchId] = useState(sub.batchId ?? '')
  const [showDropdowns, setShowDropdowns]     = useState(false)

  const assign     = useAssignSubmission()
  const st         = STATUS_META[sub.status] || STATUS_META.received
  const openBatches = batches.filter(b => b.status === 'open' && (!selectedExamId || b.examId === selectedExamId))
  const canAssign  = ['received', 'code_extracted', 'student_found', 'failed'].includes(sub.status)
  const isAssigned = Boolean(sub.examId && sub.batchId)

  const examOptions  = exams.map(e => ({ value: e._id, label: e.title }))
  const batchOptions = openBatches.map((b, i) => ({ value: b._id, label: `Batch #${i + 1} · ${b.count} copies` }))

  function handleAssign() {
    assign.mutate(
      {
        submissionId: sub._id,
        examId:    selectedExamId,
        examTitle: exams.find(e => e._id === selectedExamId)?.title ?? '',
        batchId:   selectedBatchId || undefined,
      },
      { onSuccess: () => setShowDropdowns(false) },
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="glass-card p-4 hover:border-white/[0.12] transition-all"
    >
      <div className="flex gap-3 items-start">
        <SubmissionImage sub={sub} />

        <div className="flex-1 min-w-0">
          {/* Badges + timestamp */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.bg} ${st.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                {st.label}
              </span>
              {sub.extractedCode && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                  <Hash className="w-2.5 h-2.5" />{sub.extractedCode}
                </span>
              )}
              {sub.studentName && (
                <span className="inline-flex items-center gap-1 text-[10px] text-teal-400">
                  <User className="w-2.5 h-2.5" />{sub.studentName}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-600 flex-shrink-0">{timeAgo(sub.createdAt)}</span>
          </div>

          {/* Sender */}
          <div className="flex items-center gap-1 mb-2">
            <Phone className="w-3 h-3 text-slate-600" />
            <span className="text-xs text-slate-400">{sub.senderName || 'Inconnu'} · {fmtPhone(sub.senderPhone)}</span>
          </div>

          {/* Current assignment */}
          {isAssigned && !showDropdowns && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
                <BookOpen className="w-2.5 h-2.5" />
                {exams.find(e => e._id === sub.examId)?.title ?? sub.examId}
              </div>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-400">
                <Layers className="w-2.5 h-2.5" />
                Batch #{batches.findIndex(b => b._id === sub.batchId) + 1 || '?'}
              </div>
            </div>
          )}

          {/* Assignment dropdowns */}
          <AnimatePresence>
            {showDropdowns && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 mt-2 flex-wrap">
                  {/* Exam selector */}
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Examen</label>
                    <CustomSelect
                      value={selectedExamId}
                      onChange={v => { setSelectedExamId(v); setSelectedBatchId('') }}
                      options={examOptions}
                      placeholder="— Choisir un examen —"
                      accentColor="border-teal-500/50"
                    />
                  </div>

                  {/* Batch selector */}
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Batch</label>
                    <CustomSelect
                      value={selectedBatchId}
                      onChange={setSelectedBatchId}
                      options={batchOptions}
                      placeholder="— Nouveau batch —"
                      disabled={!selectedExamId}
                      accentColor="border-violet-500/50"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-end gap-1.5">
                    <button
                      onClick={() => setShowDropdowns(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleAssign}
                      disabled={!selectedExamId || assign.isPending}
                      className="px-3 py-1.5 rounded-lg bg-teal-500/20 border border-teal-500/30 text-xs text-teal-300 font-bold hover:bg-teal-500/30 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {assign.isPending ? <RotateCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Confirmer
                    </button>
                  </div>
                </div>

                {assign.isError && (
                  <p className="text-[10px] text-red-400 mt-1">
                    {(assign.error as any)?.response?.data?.message ?? 'Erreur'}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Assign CTA */}
          {canAssign && !showDropdowns && (
            <button
              onClick={() => setShowDropdowns(true)}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-400 font-bold hover:bg-sky-500/20 transition-colors"
            >
              <LayoutGrid className="w-3 h-3" />
              {isAssigned ? 'Réassigner' : 'Assigner à un examen'}
            </button>
          )}

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

// BatchCard

interface BatchCardProps { batch: Batch; exams: Exam[]; index: number }

function BatchCard({ batch, exams, index }: BatchCardProps) {
  const dispatch = useDispatchBatch()
  const exam = exams.find(e => e._id === batch.examId)

  const statusColor: Record<string, string> = {
    open:        'text-amber-400 bg-amber-500/10 border-amber-500/20',
    dispatching: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    dispatched:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    failed:      'text-red-400 bg-red-500/10 border-red-500/20',
  }

  const progressColor = batch.status === 'dispatched' ? '#10b981' : batch.status === 'failed' ? '#ef4444' : '#8b5cf6'

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card p-4 flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-violet-400">#{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor[batch.status]}`}>{batch.status}</span>
          <span className="text-xs font-semibold text-white truncate">{exam?.title ?? batch.examId}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{batch.count} copies</span>
          {batch.status === 'dispatched' && (
            <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3 h-3" />{batch.successCount} envoyées</span>
          )}
          <span>{timeAgo(batch.createdAt)}</span>
        </div>
        <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: batch.status === 'dispatched' ? '100%' : `${Math.min(95, (batch.count / 30) * 100)}%` }}
            className="h-full rounded-full"
            style={{ background: progressColor }}
          />
        </div>
      </div>
      {batch.status === 'open' && (
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => dispatch.mutate(batch._id)}
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

// SessionModal

function SessionModal({ exams, onClose }: { exams: Exam[]; onClose: () => void }) {
  const [selectedExamId, setSelectedExamId] = useState('')
  const { data: session } = useActiveSession()

  const activate   = useActivateSession(onClose)
  const deactivate = useDeactivateSession(onClose)

  const selectedExam  = exams.find(e => e._id === selectedExamId)
  const examOptions   = exams.map(e => ({ value: e._id, label: `${e.title} · ${e.subject} · Gr.${e.classLevel}` }))

  return createPortal(
    <AnimatePresence>
      <motion.div key="session-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        style={{ zIndex: 9999 }}
        onClick={onClose}
      >
        <motion.div key="session-card"
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-900 border border-white/[0.1] rounded-2xl p-6 w-full max-w-md shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-white">Gestion de la session</h2>
            <button onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-5">Activez un examen pour recevoir les copies WhatsApp</p>

          {session?.isActive && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-400">{session.examTitle}</p>
                  <p className="text-[10px] text-slate-500">
                    {session.receivedCount} reçues · {session.indexedCount} indexées · {session.failedCount} échecs
                  </p>
                </div>
              </div>
              <button onClick={() => deactivate.mutate()} disabled={deactivate.isPending}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-bold hover:bg-red-500/20 transition-colors disabled:opacity-40">
                {deactivate.isPending ? <RotateCw className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                Désactiver
              </button>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {session?.isActive ? "Changer d'examen" : 'Choisir un examen'}
            </label>

            {/* CustomSelect remplace le <select> natif ici aussi */}
            <CustomSelect
              value={selectedExamId}
              onChange={setSelectedExamId}
              options={examOptions}
              placeholder="— Sélectionner un examen actif —"
              accentColor="border-teal-500/50"
            />

            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-slate-400 hover:text-white transition-colors">
                Annuler
              </button>
              <button
                onClick={() => selectedExam && activate.mutate(selectedExam)}
                disabled={!selectedExamId || activate.isPending}
                className="flex-1 py-2 rounded-xl bg-teal-500/20 border border-teal-500/30 text-xs text-teal-300 font-bold hover:bg-teal-500/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {activate.isPending ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Activer la réception
              </button>
            </div>

            {activate.isError && (
              <p className="text-[10px] text-red-400 text-center">
                {(activate.error as any)?.response?.data?.message ?? 'Erreur activation'}
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

// WhatsappPage

export default function WhatsappPage() {
  const [tab, setTab]                           = useState<Tab>('inbox')
  const [filter, setFilter]                     = useState<Filter>('all')
  const [showSessionModal, setShowSessionModal] = useState(false)
  const qc = useQueryClient()

  const { data: session }                              = useActiveSession()
  const { data: exams = [] }                           = useActiveExams()
  const { data: subsData,    isLoading: subsLoading }  = useWaSubmissions(filter !== 'all' ? { status: filter } : undefined)
  const { data: batchesData, isLoading: batchLoading } = useWaBatches()
  const { data: stats }                                = useWaStats()

  const subs    = subsData?.submissions  ?? []
  const batches = batchesData?.batches   ?? []

  const total       = stats?.submissions.reduce((a, s) => a + s.count, 0) ?? 0
  const queued      = stats?.submissions.find(s => s._id === 'queued')?.count     ?? 0
  const dispatched  = stats?.submissions.find(s => s._id === 'dispatched')?.count ?? 0
  const failed      = stats?.submissions.find(s => s._id === 'failed')?.count     ?? 0
  const openBatches = batches.filter(b => b.status === 'open').length
  const unassigned  = subs.filter(s => !s.examId).length

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: 'all',        label: 'Tous',       count: total },
    { key: 'received',   label: 'Nouveaux' },
    { key: 'queued',     label: 'En attente', count: queued },
    { key: 'dispatched', label: 'Dispatchés', count: dispatched },
    { key: 'failed',     label: 'Échecs',     count: failed },
  ]

  const tabs = [
    { key: 'inbox'   as Tab, label: 'Inbox',   Icon: Inbox,  badge: unassigned },
    { key: 'batches' as Tab, label: 'Batches', Icon: Layers, badge: openBatches },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">WhatsApp Inbox</h1>
          <p className="text-xs text-slate-400 mt-0.5">Assignez chaque copie reçue à un examen et un batch</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSessionModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all hover:opacity-80 cursor-pointer ${
              session?.isActive
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
            }`}
          >
            {session?.isActive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {session?.isActive ? 'Réception active' : 'Réception suspendue'}
            <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          <button onClick={() => qc.invalidateQueries()}
            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showSessionModal && <SessionModal exams={exams} onClose={() => setShowSessionModal(false)} />}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit">
        {tabs.map(({ key, label, Icon, badge }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === key ? 'bg-white/[0.08] text-white shadow' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {badge > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                tab === key ? 'bg-teal-500/20 text-teal-300' : 'bg-white/[0.06] text-slate-500'
              }`}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">

        {tab === 'inbox' && (
          <motion.div key="inbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Filters */}
            <div className="flex gap-1.5 flex-wrap">
              {filters.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    filter === f.key
                      ? 'bg-white/[0.1] border-white/[0.15] text-white'
                      : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {f.label}
                  {f.count !== undefined && f.count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-white/[0.08] text-slate-400">{f.count}</span>
                  )}
                </button>
              ))}
            </div>

            {filter === 'all' && unassigned > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-sky-500/5 border border-sky-500/15">
                <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ArrowRight className="w-3 h-3 text-sky-400" />
                </div>
                <p className="text-xs text-sky-300">
                  <span className="font-bold">{unassigned} copie(s) non assignée(s)</span> — Cliquez sur{' '}
                  <span className="mx-1 px-1.5 py-0.5 bg-sky-500/20 rounded text-sky-300 font-mono text-[10px]">Assigner à un examen</span>
                  pour chaque photo, choisissez l'examen et le batch, puis confirmez.
                </p>
              </div>
            )}

            {subsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card p-4 animate-pulse h-24" />)}
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

        {tab === 'batches' && (
          <motion.div key="batches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {openBatches > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">
                  <span className="font-bold">{openBatches} batch(s) ouvert(s)</span> · Cliquez sur{' '}
                  <span className="font-bold">Dispatcher</span> pour envoyer vers ClassQuiz et déclencher l'OCR + correction.
                </p>
              </div>
            )}
            {batchLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card p-4 animate-pulse h-20" />)}
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