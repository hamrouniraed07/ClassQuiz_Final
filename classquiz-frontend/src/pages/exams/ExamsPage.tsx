import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, FileText, RefreshCw, CheckCircle2, Clock, Archive } from 'lucide-react'
import { useExams, useReprocessExam } from '@/hooks/useApi'
import { StatusBadge, LoadingPage, EmptyState, PageHeader } from '@/components/shared'
import { CLASS_LEVEL_LABELS, SUBJECT_META } from '@/constants/domain'
import type { ClassLevel, Subject } from '@/constants/domain'
import type { Exam } from '@/types'

function ExamCard({ exam, index }: { exam: Exam; index: number }) {
  const navigate = useNavigate()
  const reprocess = useReprocessExam()
  const questionCount = Array.isArray(exam.questions) ? exam.questions.length : 0
  const subjectMeta = SUBJECT_META[exam.subject as Subject]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass-card-hover p-5 group cursor-pointer"
      onClick={() => navigate(`/exams/create`)}
    >
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
            <RefreshCw className="w-3 h-3" /> Reprocess
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function ExamsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const { data, isLoading } = useExams({ status: statusFilter })

  if (isLoading) return <LoadingPage />
  const exams = data?.exams ?? []

  return (
    <div className="space-y-5">
      <PageHeader title="Exams" subtitle={`${data?.pagination.total ?? 0} exams`}
        action={
          <button onClick={() => navigate('/exams/create')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Exam
          </button>
        }
      />

      <div className="flex gap-2">
        {[undefined, 'active', 'processing', 'draft', 'archived'].map(s => (
          <button key={String(s)} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${statusFilter === s ? 'bg-amber-500 text-white' : 'btn-ghost'}`}>
            {s ?? 'All'}
          </button>
        ))}
      </div>

      {exams.length === 0
        ? <EmptyState icon={FileText} title="No exams found" description="Create your first exam to get started."
            action={<button onClick={() => navigate('/exams/create')} className="btn-primary">Create Exam</button>} />
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {exams.map((exam, i) => <ExamCard key={exam._id} exam={exam} index={i} />)}
          </div>
      }
    </div>
  )
}