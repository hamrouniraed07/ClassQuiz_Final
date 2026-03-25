import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FileText, RefreshCw, Search, Pencil, Trash2, X, AlertTriangle, Loader2 } from 'lucide-react'
import { useExams, useReprocessExam, useUpdateExam, useDeleteExam } from '@/hooks/useApi'
import { StatusBadge, LoadingPage, EmptyState, PageHeader } from '@/components/shared'
import { CLASS_LEVELS, CLASS_LEVEL_LABELS, SUBJECTS, SUBJECT_META } from '@/constants/domain'
import type { ClassLevel, Subject } from '@/constants/domain'
import type { Exam } from '@/types'

// ── Edit Exam Modal ───────────────────────────────────────────────────────────
function EditExamModal({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const [form, setForm] = useState({
    title: exam.title,
    subject: exam.subject as Subject,
    classLevel: exam.classLevel as ClassLevel,
  })
  const [error, setError] = useState('')
  const updateExam = useUpdateExam()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    try {
      await updateExam.mutateAsync({
        id: exam._id,
        title: form.title,
        subject: form.subject,
        classLevel: form.classLevel,
      })
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update exam')
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="glass-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Edit Exam</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Exam Title</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="input-dark" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject</label>
            <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value as Subject })}
              className="input-dark" dir="rtl">
              {SUBJECTS.map(s => <option key={s} value={s}>{s} ({SUBJECT_META[s].en})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Class Level</label>
            <select value={form.classLevel} onChange={e => setForm({ ...form, classLevel: e.target.value as ClassLevel })}
              className="input-dark">
              {CLASS_LEVELS.map(cl => <option key={cl} value={cl}>{CLASS_LEVEL_LABELS[cl]}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={updateExam.isPending} className="btn-primary flex-1">
              {updateExam.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Delete Confirmation Modal ─────────────────────────────────────────────────
function DeleteExamModal({ exam, onClose, onConfirm, isPending }: {
  exam: Exam; onClose: () => void; onConfirm: () => void; isPending: boolean
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="glass-card w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">Delete Exam?</h3>
        <p className="text-xs text-slate-400 mb-5">
          This will archive <span className="text-white font-semibold">"{exam.title}"</span>.
          {(exam.questions?.length ?? 0) > 0 && ` It has ${exam.questions!.length} questions.`}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={onConfirm} disabled={isPending}
            className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Exam Card ─────────────────────────────────────────────────────────────────
function ExamCard({ exam, index, onEdit, onDelete }: {
  exam: Exam; index: number; onEdit: () => void; onDelete: () => void
}) {
  const navigate = useNavigate()
  const reprocess = useReprocessExam()
  const questionCount = Array.isArray(exam.questions) ? exam.questions.length : 0
  const subjectMeta = SUBJECT_META[exam.subject as Subject]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass-card-hover p-5 group relative"
    >
      {/* Action buttons — top right, visible on hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-amber-500/15 text-slate-400 hover:text-amber-400 transition-colors">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-red-500/15 text-slate-400 hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <div className="cursor-pointer" onClick={() => navigate(`/exams/create`)}>
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-amber-400" />
          </div>
          <StatusBadge status={exam.status} />
        </div>
        <h3 className="text-sm font-bold text-white mb-0.5 truncate">{exam.title}</h3>
        <p className="text-xs text-slate-400 mb-3">
          {subjectMeta ? `${subjectMeta.emoji} ${subjectMeta.en}` : exam.subject} · {CLASS_LEVEL_LABELS[exam.classLevel as ClassLevel] ?? exam.classLevel}
        </p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">{questionCount} questions · {exam.totalScore ?? 0} pts</span>
          {(exam.status === 'draft' || exam.status === 'processing') && (
            <button onClick={(e) => { e.stopPropagation(); reprocess.mutate(exam._id) }}
              className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors">
              {reprocess.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Reprocess
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ExamsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [editExam, setEditExam] = useState<Exam | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null)

  const { data, isLoading } = useExams({ status: statusFilter })
  const deleteExam = useDeleteExam()

  if (isLoading) return <LoadingPage />

  const allExams = data?.exams ?? []
  const exams = search.trim()
    ? allExams.filter(e => e.title.toLowerCase().includes(search.toLowerCase()))
    : allExams

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteExam.mutateAsync(deleteTarget._id)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Exams" subtitle={`${data?.pagination.total ?? 0} exams`}
        action={
          <button onClick={() => navigate('/exams/create')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Exam
          </button>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search exams by title…"
            className="w-full bg-slate-800/60 border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-teal-500/50 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          {[undefined, 'active', 'processing', 'draft', 'archived'].map(s => (
            <button key={String(s)} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${statusFilter === s ? 'bg-amber-500 text-white' : 'btn-ghost'}`}>
              {s ?? 'All'}
            </button>
          ))}
        </div>
      </div>

      {exams.length === 0
        ? <EmptyState icon={FileText} title="No exams found"
            description={search ? `No exams matching "${search}"` : "Create your first exam to get started."}
            action={!search ? <button onClick={() => navigate('/exams/create')} className="btn-primary">Create Exam</button> : undefined} />
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {exams.map((exam, i) => (
              <ExamCard key={exam._id} exam={exam} index={i}
                onEdit={() => setEditExam(exam)}
                onDelete={() => setDeleteTarget(exam)}
              />
            ))}
          </div>
      }

      <AnimatePresence>
        {editExam && <EditExamModal exam={editExam} onClose={() => setEditExam(null)} />}
        {deleteTarget && <DeleteExamModal exam={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} isPending={deleteExam.isPending} />}
      </AnimatePresence>
    </div>
  )
}