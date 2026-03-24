import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Play, CheckCircle, AlertTriangle, Loader2, Eye, Pencil, Save,
  FileText, Sparkles, ShieldCheck, ShieldAlert, RotateCw, X, ChevronDown, ChevronUp
} from 'lucide-react'
import { useExam, useTriggerOCR, useUpdateQuestions } from '@/hooks/useApi'
import { LoadingPage, PageHeader, StatusBadge } from '@/components/shared'
import { CLASS_LEVEL_LABELS, SUBJECT_META } from '@/constants/domain'
import type { Question, Exam } from '@/types'
import type { ClassLevel, Subject } from '@/constants/domain'

const OCR_THRESHOLD = 70

// ── OCR Step Indicator ────────────────────────────────────────────────────────
const OCR_STEPS = [
  { id: 1, label: 'Uploading Images',     icon: FileText,   desc: 'Preparing exam images for AI processing' },
  { id: 2, label: 'Processing OCR',       icon: Sparkles,   desc: 'Gemini 2.0 is extracting questions & answers' },
  { id: 3, label: 'Structuring Results',  icon: Eye,        desc: 'Organizing extracted data into questions' },
  { id: 4, label: 'Completed',            icon: CheckCircle, desc: 'OCR finished — review results below' },
]

function getOCRStep(exam: Exam | undefined): number {
  if (!exam) return 0
  if (exam.status === 'processing' && (!exam.questions || exam.questions.length === 0)) return 2
  if (exam.status === 'processing') return 3
  if (exam.status === 'active' || exam.status === 'draft') {
    if (exam.ocrProcessedAt) return 4
  }
  return 0
}

function OCRStepper({ currentStep, isProcessing }: { currentStep: number; isProcessing: boolean }) {
  return (
    <div className="glass-card p-5">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">OCR Processing Pipeline</h3>
      <div className="space-y-1">
        {OCR_STEPS.map((step, i) => {
          const state = currentStep > step.id ? 'done'
            : currentStep === step.id ? 'active'
            : 'pending'
          const Icon = step.icon
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                state === 'active' ? 'bg-amber-500/10 border border-amber-500/20' :
                state === 'done'   ? 'bg-emerald-500/[0.06] border border-emerald-500/15' :
                'bg-transparent border border-transparent'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                state === 'done'   ? 'bg-emerald-500/20' :
                state === 'active' ? 'bg-amber-500/20' :
                'bg-white/[0.04]'
              }`}>
                {state === 'done' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : state === 'active' && isProcessing ? (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                ) : (
                  <Icon className={`w-4 h-4 ${state === 'active' ? 'text-amber-400' : 'text-slate-600'}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${
                  state === 'done' ? 'text-emerald-400' :
                  state === 'active' ? 'text-amber-400' :
                  'text-slate-600'
                }`}>
                  {step.label}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{step.desc}</p>
              </div>
              {state === 'active' && isProcessing && (
                <span className="text-[10px] text-amber-400 animate-pulse font-medium">Processing…</span>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ── Confidence Badge ──────────────────────────────────────────────────────────
function ConfBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null
  const isLow = score < OCR_THRESHOLD
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
      isLow
        ? 'bg-red-500/15 text-red-400 border border-red-500/20'
        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
    }`}>
      {isLow ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
      {score.toFixed(0)}%
      {isLow ? ' Low' : ' Valid'}
    </span>
  )
}

// ── Question Card (with inline editing) ───────────────────────────────────────
function QuestionCard({
  question,
  index,
  isEditing,
  editData,
  onStartEdit,
  onCancelEdit,
  onChange,
}: {
  question: Question
  index: number
  isEditing: boolean
  editData: Partial<Question> | null
  onStartEdit: () => void
  onCancelEdit: () => void
  onChange: (field: string, value: string | number) => void
}) {
  const isLow = (question.confidence ?? 100) < OCR_THRESHOLD

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`glass-card p-4 transition-all ${
        isLow && !isEditing ? 'border-red-500/20 bg-red-500/[0.03]' :
        isEditing ? 'border-amber-500/30 bg-amber-500/[0.03]' :
        ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center text-xs font-bold text-amber-400">
            {question.number}
          </span>
          <span className="text-[10px] text-slate-500 capitalize">{question.type.replace('_', ' ')}</span>
          <span className="text-[10px] text-slate-500">· {question.maxScore} pts</span>
        </div>
        <div className="flex items-center gap-2">
          <ConfBadge score={question.confidence} />
          {!isEditing ? (
            <button onClick={onStartEdit}
              className={`p-1.5 rounded-lg transition-colors ${
                isLow
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'hover:bg-white/[0.07] text-slate-400 hover:text-amber-400'
              }`}>
              <Pencil className="w-3 h-3" />
            </button>
          ) : (
            <button onClick={onCancelEdit}
              className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2.5 mt-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Question Text</label>
            <textarea
              value={editData?.text ?? question.text}
              onChange={e => onChange('text', e.target.value)}
              className="input-dark text-xs resize-none h-16"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Correct Answer</label>
              <input
                value={editData?.correctAnswer ?? question.correctAnswer}
                onChange={e => onChange('correctAnswer', e.target.value)}
                className="input-dark text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Max Score</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={editData?.maxScore ?? question.maxScore}
                onChange={e => onChange('maxScore', parseFloat(e.target.value) || 0)}
                className="input-dark text-xs"
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-white leading-relaxed mb-2">{question.text}</p>
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/10">
            <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-emerald-300 font-mono">{question.correctAnswer}</p>
          </div>
        </>
      )}

      {isLow && !isEditing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400"
        >
          <AlertTriangle className="w-3 h-3" />
          Low confidence — click edit to validate this question
        </motion.div>
      )}
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [edits, setEdits] = useState<Record<number, Partial<Question>>>({})
  const [showAll, setShowAll] = useState(false)

  const isProcessing = true // we'll refine below
  const { data: exam, isLoading } = useExam(id || '', undefined)

  // Poll when processing
  const polling = exam?.status === 'processing'
  const { data: polledExam } = useExam(id || '', polling)
  const currentExam = polledExam || exam

  const triggerOCR = useTriggerOCR()
  const updateQuestions = useUpdateQuestions()

  const ocrStep = getOCRStep(currentExam)
  const questions = currentExam?.questions ?? []
  const lowConfCount = questions.filter(q => (q.confidence ?? 100) < OCR_THRESHOLD).length
  const hasLowConf = lowConfCount > 0

  if (isLoading) return <LoadingPage />
  if (!currentExam) return <div className="p-8 text-slate-400">Exam not found</div>

  const subjectMeta = SUBJECT_META[currentExam.subject as Subject]

  const handleEdit = (qIdx: number, field: string, value: string | number) => {
    const q = questions[qIdx]
    setEdits(prev => ({
      ...prev,
      [qIdx]: { ...prev[qIdx], [field]: value },
    }))
  }

  const handleSaveAll = async () => {
    // Merge edits into questions
    const merged: Question[] = questions.map((q, i) => {
      const e = edits[i]
      if (!e) return q
      return { ...q, ...e }
    })
    await updateQuestions.mutateAsync({ id: currentExam._id, questions: merged })
    setEdits({})
    setEditingIdx(null)
  }

  const handleTriggerOCR = async () => {
    await triggerOCR.mutateAsync(currentExam._id)
  }

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
          <h1 className="text-lg font-bold text-white">{currentExam.title}</h1>
          <p className="text-xs text-slate-400">
            {subjectMeta ? `${subjectMeta.emoji} ${subjectMeta.en}` : currentExam.subject}
            {' · '}
            {CLASS_LEVEL_LABELS[currentExam.classLevel as ClassLevel] ?? currentExam.classLevel}
            {currentExam.ocrConfidence != null && ` · OCR Confidence: ${currentExam.ocrConfidence.toFixed(0)}%`}
          </p>
        </div>
        <StatusBadge status={currentExam.status} />
      </div>

      {/* OCR Stepper — show when processing or recently processed */}
      {(currentExam.status === 'processing' || (ocrStep > 0 && ocrStep <= 4)) && (
        <OCRStepper currentStep={ocrStep} isProcessing={currentExam.status === 'processing'} />
      )}

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {(currentExam.status === 'draft' && !currentExam.ocrProcessedAt) && (
          <button onClick={handleTriggerOCR} disabled={triggerOCR.isPending}
            className="btn-primary flex items-center gap-2">
            {triggerOCR.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Start OCR
          </button>
        )}
        {currentExam.status === 'draft' && currentExam.ocrProcessedAt && (
          <button onClick={handleTriggerOCR} disabled={triggerOCR.isPending}
            className="btn-ghost flex items-center gap-2 text-sky-400">
            <RotateCw className="w-4 h-4" /> Re-run OCR
          </button>
        )}
        {hasLowConf && questions.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-red-400 font-semibold">{lowConfCount} question(s) need validation</span>
          </div>
        )}
        {Object.keys(edits).length > 0 && (
          <button onClick={handleSaveAll} disabled={updateQuestions.isPending}
            className="btn-primary flex items-center gap-2 ml-auto">
            {updateQuestions.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Validate & Save ({Object.keys(edits).length} edited)
          </button>
        )}
      </div>

      {/* Overall confidence bar */}
      {currentExam.ocrConfidence != null && questions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Overall OCR Confidence</span>
            <span className={`text-sm font-bold ${
              currentExam.ocrConfidence >= OCR_THRESHOLD ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {currentExam.ocrConfidence.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-navy-950 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                currentExam.ocrConfidence >= OCR_THRESHOLD
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-red-500 to-orange-400'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${currentExam.ocrConfidence}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-slate-500">
              {questions.length} questions · {currentExam.totalScore} total points
            </span>
            {currentExam.ocrNotes && (
              <span className="text-[10px] text-slate-500 italic">{currentExam.ocrNotes}</span>
            )}
          </div>
        </motion.div>
      )}

      {/* Questions list */}
      {questions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Extracted Questions</h2>
            <span className="text-[10px] text-slate-500">
              {questions.filter(q => (q.confidence ?? 100) >= OCR_THRESHOLD).length}/{questions.length} valid
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleQuestions.map((q, i) => (
              <QuestionCard
                key={q.number}
                question={q}
                index={i}
                isEditing={editingIdx === i}
                editData={edits[i] ?? null}
                onStartEdit={() => setEditingIdx(i)}
                onCancelEdit={() => {
                  setEditingIdx(null)
                  const newEdits = { ...edits }
                  delete newEdits[i]
                  setEdits(newEdits)
                }}
                onChange={(field, value) => handleEdit(i, field, value)}
              />
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

      {/* Empty state when no questions yet and not processing */}
      {questions.length === 0 && currentExam.status !== 'processing' && (
        <div className="glass-card p-12 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-1">No questions extracted yet</p>
          <p className="text-[10px] text-slate-500 mb-4">
            {currentExam.correctedExamImages.length > 0
              ? 'Click "Start OCR" to extract questions from the uploaded images.'
              : 'Upload corrected exam images first, then run OCR.'}
          </p>
        </div>
      )}

      {/* Processing placeholder */}
      {currentExam.status === 'processing' && questions.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-8 h-8 text-amber-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-amber-400 font-semibold mb-1">Processing with Gemini 2.0</p>
          <p className="text-[10px] text-slate-500">This usually takes 10-30 seconds. Results will appear automatically.</p>
        </div>
      )}
    </div>
  )
}