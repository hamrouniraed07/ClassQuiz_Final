import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FileText, Upload, RefreshCw, X, CheckCircle2, Clock, Archive } from 'lucide-react'
import { useExams, useCreateExam, useReprocessExam } from '@/hooks/useApi'
import { StatusBadge, LoadingPage, EmptyState, PageHeader, SectionCard } from '@/components/shared'
import { CLASS_LEVELS, CLASS_LEVEL_LABELS, SUBJECTS, SUBJECT_META } from '@/constants/domain'
import type { ClassLevel, Subject } from '@/constants/domain'
import type { Exam } from '@/types'

function CreateExamModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<{ title: string; subject: Subject; classLevel: ClassLevel }>({
    title: '',
    subject: SUBJECTS[0],
    classLevel: '3eme',
  })
  const [correctedFiles, setCorrectedFiles] = useState<File[]>([])
  const [blankFiles, setBlankFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const correctedRef = useRef<HTMLInputElement>(null)
  const blankRef = useRef<HTMLInputElement>(null)
  const createExam = useCreateExam()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correctedFiles.length) { setError('Upload at least one corrected exam image'); return }
    setError('')
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('subject', form.subject)
    fd.append('classLevel', form.classLevel)
    correctedFiles.forEach(f => fd.append('correctedExam', f))
    blankFiles.forEach(f => fd.append('blankExam', f))
    try {
      await createExam.mutateAsync(fd)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create exam')
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Create New Exam</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Exam Title</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="input-dark" placeholder="Mid-Term Mathematics" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject</label>
              <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value as Subject })}
                className="input-dark" dir="rtl">
                {SUBJECTS.map(s => (
                  <option key={s} value={s}>{SUBJECT_META[s].emoji} {s} ({SUBJECT_META[s].en})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Class</label>
              <select value={form.classLevel} onChange={e => setForm({ ...form, classLevel: e.target.value as ClassLevel })}
                className="input-dark">
                {CLASS_LEVELS.map(cl => <option key={cl} value={cl}>{CLASS_LEVEL_LABELS[cl]}</option>)}
              </select>
            </div>
          </div>

          {/* Corrected Exam Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Corrected Exam Images <span className="text-red-400">*</span>
            </label>
            <div onClick={() => correctedRef.current?.click()}
              className={`drop-zone p-4 text-center cursor-pointer ${correctedFiles.length ? 'border-amber-500/40 bg-amber-500/[0.04]' : ''}`}>
              <Upload className="w-5 h-5 text-slate-500 mx-auto mb-1.5" />
              {correctedFiles.length
                ? <p className="text-xs text-amber-400">{correctedFiles.length} file(s) selected</p>
                : <p className="text-xs text-slate-400">Click to upload corrected exam pages</p>}
              <input ref={correctedRef} type="file" multiple accept="image/*" className="hidden"
                onChange={e => setCorrectedFiles(Array.from(e.target.files ?? []))} />
            </div>
          </div>

          {/* Blank Exam Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Blank Exam Images <span className="text-slate-500">(optional — improves OCR)</span>
            </label>
            <div onClick={() => blankRef.current?.click()}
              className="drop-zone p-4 text-center cursor-pointer">
              <Upload className="w-5 h-5 text-slate-500 mx-auto mb-1.5" />
              {blankFiles.length
                ? <p className="text-xs text-sky-400">{blankFiles.length} file(s) selected</p>
                : <p className="text-xs text-slate-400">Click to upload blank exam pages</p>}
              <input ref={blankRef} type="file" multiple accept="image/*" className="hidden"
                onChange={e => setBlankFiles(Array.from(e.target.files ?? []))} />
            </div>
          </div>

          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={createExam.isPending} className="btn-primary flex-1">
              {createExam.isPending ? 'Creating…' : 'Create & Start OCR'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function ExamCard({ exam, index }: { exam: Exam; index: number }) {
  const reprocess = useReprocessExam()
  const statusIcon = { active: CheckCircle2, processing: Clock, draft: FileText, archived: Archive }
  const StatusIcon = statusIcon[exam.status] ?? FileText
  const questionCount = Array.isArray(exam.questions) ? exam.questions.length : 0
  const subjectMeta = SUBJECT_META[exam.subject as Subject]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass-card-hover p-5 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-amber-400" />
        </div>
        <StatusBadge status={exam.status} />
      </div>
      <h3 className="text-sm font-bold text-white mb-0.5 truncate">{exam.title}</h3>
      <p className="text-xs text-slate-400 mb-3">
        {subjectMeta ? `${subjectMeta.emoji} ${subjectMeta.en}` : exam.subject} · {CLASS_LEVEL_LABELS[exam.classLevel] ?? exam.classLevel}
      </p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{questionCount} questions · {exam.totalScore ?? 0} pts</span>
        {(exam.status === 'draft' || exam.status === 'processing') && (
          <button onClick={() => reprocess.mutate(exam._id)}
            className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors">
            <RefreshCw className="w-3 h-3" /> Reprocess
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function ExamsPage() {
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const { data, isLoading } = useExams({ status: statusFilter })

  if (isLoading) return <LoadingPage />
  const exams = data?.exams ?? []

  return (
    <div className="space-y-5">
      <PageHeader title="Exams" subtitle={`${data?.pagination.total ?? 0} exams`}
        action={<button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Create Exam</button>} />

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[undefined, 'active', 'processing', 'draft', 'archived'].map(s => (
          <button key={String(s)} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${statusFilter === s ? 'bg-amber-500 text-white' : 'btn-ghost'}`}>
            {s ?? 'All'}
          </button>
        ))}
      </div>

      {exams.length === 0
        ? <EmptyState icon={FileText} title="No exams found" description="Create your first exam to get started." action={<button onClick={() => setShowModal(true)} className="btn-primary">Create Exam</button>} />
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {exams.map((exam, i) => <ExamCard key={exam._id} exam={exam} index={i} />)}
          </div>
      }

      <AnimatePresence>{showModal && <CreateExamModal onClose={() => setShowModal(false)} />}</AnimatePresence>
    </div>
  )
}