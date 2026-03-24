import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, CheckCircle, AlertTriangle, Loader2,
  FileText, Sparkles, Eye, RotateCw, ChevronDown, ChevronUp
} from 'lucide-react'
import { useExam, useReprocessExam } from '@/hooks/useApi'
import { LoadingPage, PageHeader, StatusBadge } from '@/components/shared'
import { CLASS_LEVEL_LABELS, SUBJECT_META } from '@/constants/domain'
import type { Question, Exam } from '@/types'
import type { ClassLevel, Subject } from '@/constants/domain'

// ── Question Card (read-only) ─────────────────────────────────────────────────
function QuestionCard({ question, index }: { question: Question; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card p-4"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center text-xs font-bold text-amber-400">
            {question.number}
          </span>
          <span className="text-[10px] text-slate-500 capitalize">{question.type.replace('_', ' ')}</span>
          <span className="text-[10px] text-slate-500">· {question.maxScore} pts</span>
        </div>
      </div>
      <p className="text-xs text-white leading-relaxed mb-2" dir="auto">{question.text}</p>
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/10">
        <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
        <p className="text-xs text-emerald-300 font-mono" dir="auto">{question.correctAnswer}</p>
      </div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)

  const { data: exam, isLoading } = useExam(id || '')
  const reprocess = useReprocessExam()

  if (isLoading) return <LoadingPage />
  if (!exam) return <div className="p-8 text-slate-400">Exam not found</div>

  const subjectMeta = SUBJECT_META[exam.subject as Subject]
  const questions = exam.questions ?? []
  const visibleQuestions = showAll ? questions : questions.slice(0, 10)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/exams')}
          className="p-2 rounded-xl hover:bg-white/[0.07] text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">{exam.title}</h1>
          <p className="text-xs text-slate-400">
            {subjectMeta ? `${subjectMeta.emoji} ${subjectMeta.en}` : exam.subject}
            {' · '}
            {CLASS_LEVEL_LABELS[exam.classLevel as ClassLevel] ?? exam.classLevel}
            {exam.totalScore > 0 && ` · ${exam.totalScore} pts`}
          </p>
        </div>
        <StatusBadge status={exam.status} />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {(exam.status === 'draft') && (
          <button onClick={() => reprocess.mutate(exam._id)} disabled={reprocess.isPending}
            className="btn-ghost flex items-center gap-2 text-sky-400">
            <RotateCw className="w-4 h-4" /> Re-run OCR
          </button>
        )}
        {exam.status === 'processing' && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span className="text-xs text-amber-400 font-semibold">OCR Processing…</span>
          </div>
        )}
      </div>

      {/* Questions list */}
      {questions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Questions ({questions.length})</h2>
            <span className="text-[10px] text-slate-500">{exam.totalScore} total points</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleQuestions.map((q, i) => (
              <QuestionCard key={q.number} question={q} index={i} />
            ))}
          </div>

          {questions.length > 10 && (
            <button onClick={() => setShowAll(!showAll)}
              className="btn-ghost w-full flex items-center justify-center gap-1 text-xs">
              {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showAll ? 'Show less' : `Show all ${questions.length} questions`}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {questions.length === 0 && exam.status !== 'processing' && (
        <div className="glass-card p-12 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-1">No questions extracted yet</p>
          <p className="text-[10px] text-slate-500">
            This exam has no questions. Use the Create Exam flow to extract questions via OCR.
          </p>
        </div>
      )}
    </div>
  )
}