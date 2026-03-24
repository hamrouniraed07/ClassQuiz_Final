import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, X, CheckCircle, ChevronRight, Loader2, FileImage,
  Eye, Save, ArrowLeft, AlertTriangle, Sparkles, Pencil
} from 'lucide-react'
import { useCreateExam, useTriggerOCR, useConfirmExam } from '@/hooks/useApi'
import { PageHeader, LoadingPage } from '@/components/shared'
import { SUBJECTS, SUBJECT_META, CLASS_LEVELS, CLASS_LEVEL_LABELS } from '@/constants/domain'
import type { ClassLevel, Subject } from '@/constants/domain'
import type { Question, OCRExtractionResult } from '@/types'

const STEPS = [
  { id: 1, label: 'Upload Images' },
  { id: 2, label: 'Review OCR Results' },
  { id: 3, label: 'Confirm' },
]

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done = current > step.id
        const active = current === step.id
        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              done ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              active ? 'bg-teal-500 text-white border border-teal-500' :
              'bg-white/[0.04] text-slate-500 border border-white/[0.08]'
            }`}>
              {done && <CheckCircle className="w-3.5 h-3.5" />}
              <span>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className={`w-4 h-4 mx-2 ${current > step.id ? 'text-emerald-400' : 'text-slate-600'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────
function UploadStep({
  onNext,
}: {
  onNext: (examId: string) => void
}) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState<Subject>(SUBJECTS[0])
  const [classLevel, setClassLevel] = useState<ClassLevel>('3eme')
  const [correctedFiles, setCorrectedFiles] = useState<File[]>([])
  const [blankFiles, setBlankFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const correctedRef = useRef<HTMLInputElement>(null)
  const blankRef = useRef<HTMLInputElement>(null)
  const createExam = useCreateExam()

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    if (!correctedFiles.length) { setError('Upload at least one corrected exam image'); return }
    setError('')
    const fd = new FormData()
    fd.append('title', title)
    fd.append('subject', subject)
    fd.append('classLevel', classLevel)
    correctedFiles.forEach(f => fd.append('correctedExam', f))
    blankFiles.forEach(f => fd.append('blankExam', f))
    try {
      const exam = await createExam.mutateAsync(fd)
      onNext(exam._id)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create exam')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Title + Subject row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Exam Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="input-dark" placeholder="Mid-Term Mathematics" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value as Subject)} className="input-dark" dir="rtl">
              {SUBJECTS.map(s => <option key={s} value={s}>{s} ({SUBJECT_META[s].en})</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Class Level</label>
          <select value={classLevel} onChange={e => setClassLevel(e.target.value as ClassLevel)} className="input-dark w-48">
            {CLASS_LEVELS.map(cl => <option key={cl} value={cl}>{CLASS_LEVEL_LABELS[cl]}</option>)}
          </select>
        </div>

        {/* File uploads as cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div onClick={() => correctedRef.current?.click()}
            className={`glass-card p-8 text-center cursor-pointer border-2 border-dashed transition-all hover:border-teal-500/40 ${
              correctedFiles.length ? 'border-teal-500/40 bg-teal-500/[0.04]' : 'border-white/[0.1]'
            }`}>
            <FileImage className="w-8 h-8 text-teal-400 mx-auto mb-3" />
            {correctedFiles.length > 0
              ? correctedFiles.map((f, i) => (
                <p key={i} className="text-xs text-teal-300 font-medium">{f.name} <span className="text-slate-500">({(f.size / 1024).toFixed(0)} KB)</span></p>
              ))
              : <p className="text-xs text-slate-400">Click to upload corrected exam pages</p>
            }
            <input ref={correctedRef} type="file" multiple accept="image/*" className="hidden"
              onChange={e => setCorrectedFiles(Array.from(e.target.files ?? []))} />
          </div>

          <div onClick={() => blankRef.current?.click()}
            className={`glass-card p-8 text-center cursor-pointer border-2 border-dashed transition-all hover:border-sky-500/40 ${
              blankFiles.length ? 'border-sky-500/40 bg-sky-500/[0.04]' : 'border-white/[0.1]'
            }`}>
            <FileImage className="w-8 h-8 text-sky-400 mx-auto mb-3" />
            {blankFiles.length > 0
              ? blankFiles.map((f, i) => (
                <p key={i} className="text-xs text-sky-300 font-medium">{f.name} <span className="text-slate-500">({(f.size / 1024).toFixed(0)} KB)</span></p>
              ))
              : <p className="text-xs text-slate-400">Blank exam (optional — improves OCR)</p>
            }
            <input ref={blankRef} type="file" multiple accept="image/*" className="hidden"
              onChange={e => setBlankFiles(Array.from(e.target.files ?? []))} />
          </div>
        </div>

        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>}

        <button onClick={handleSubmit} disabled={createExam.isPending}
          className="btn-primary flex items-center gap-2">
          {createExam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Process with OCR
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

// ── Step 2: Review OCR Results ────────────────────────────────────────────────
function ReviewStep({
  examId,
  ocrResult,
  isLoading,
  questions,
  setQuestions,
  onBack,
  onConfirm,
}: {
  examId: string
  ocrResult: OCRExtractionResult | null
  isLoading: boolean
  questions: Question[]
  setQuestions: (q: Question[]) => void
  onBack: () => void
  onConfirm: () => void
}) {
  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
        <Loader2 className="w-10 h-10 text-teal-400 mx-auto mb-4 animate-spin" />
        <p className="text-sm text-teal-400 font-semibold mb-1">Processing with Gemini 2.0</p>
        <p className="text-xs text-slate-500">Extracting questions and answers from your exam images…</p>
      </motion.div>
    )
  }

  const updateQuestion = (idx: number, field: keyof Question, value: string | number) => {
    const updated = [...questions]
    updated[idx] = { ...updated[idx], [field]: value }
    setQuestions(updated)
  }

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
      <p className="text-sm text-slate-400 mb-5">Review and edit the extracted questions and answers:</p>

      <div className="space-y-4 max-w-4xl">
        {questions.map((q, i) => {
          const isLow = (q.confidence ?? 100) < 70
          return (
            <motion.div
              key={q.number}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`glass-card p-5 ${isLow ? 'border-red-500/25 bg-red-500/[0.03]' : ''}`}
            >
              {/* Header: question number + points + confidence */}
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-sm font-bold text-teal-400">
                  {q.number}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">Points:</span>
                  <input
                    type="number" step="0.5" min="0"
                    value={q.maxScore}
                    onChange={e => updateQuestion(i, 'maxScore', parseFloat(e.target.value) || 0)}
                    className="w-16 input-dark text-xs text-center py-1"
                  />
                </div>
                {q.confidence != null && (
                  <span className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    isLow ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {isLow ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                    {q.confidence.toFixed(0)}% {isLow ? 'Low' : 'Good'}
                  </span>
                )}
              </div>

              {/* Question text — editable dark textarea */}
              <div className="mb-3">
                <textarea
                  value={q.text}
                  onChange={e => updateQuestion(i, 'text', e.target.value)}
                  className="w-full bg-navy-950/80 border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white resize-none focus:border-teal-500/50 focus:outline-none transition-colors"
                  dir="auto"
                  rows={2}
                />
              </div>

              {/* Answer — editable */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-semibold">Answer:</span>
                </div>
                <input
                  value={q.correctAnswer}
                  onChange={e => updateQuestion(i, 'correctAnswer', e.target.value)}
                  className="flex-1 bg-navy-950/80 border border-white/[0.08] rounded-lg px-4 py-2 text-sm text-white focus:border-teal-500/50 focus:outline-none transition-colors"
                  dir="auto"
                />
              </div>

              {isLow && (
                <p className="mt-2 text-[10px] text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Low confidence — please verify this question and answer
                </p>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-6">
        <button onClick={onBack} className="btn-ghost flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onConfirm} className="btn-primary flex items-center gap-2 ml-auto">
          <Save className="w-4 h-4" />
          Confirm Questions
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CreateExamPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [examId, setExamId] = useState<string | null>(null)
  const [ocrResult, setOcrResult] = useState<OCRExtractionResult | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])

  const triggerOCR = useTriggerOCR()
  const confirmExam = useConfirmExam()

  // Step 1 → 2: create exam, then trigger OCR
  const handleUploadDone = async (newExamId: string) => {
    setExamId(newExamId)
    setStep(2)
    try {
      const result = await triggerOCR.mutateAsync(newExamId)
      setOcrResult(result)
      setQuestions(result.questions)
    } catch {
      // OCR failed — stay on step 2 with error
    }
  }

  // Step 2 → 3: confirm
  const handleConfirm = async () => {
    if (!examId) return
    try {
      await confirmExam.mutateAsync({ id: examId, questions })
      setStep(3)
      // After short delay, go back to exams list
      setTimeout(() => navigate('/exams'), 1500)
    } catch {
      // error handled by mutation
    }
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="Create Exam"
        subtitle="Upload reference images and confirm OCR results"
      />

      <Stepper current={step} />

      <AnimatePresence mode="wait">
        {step === 1 && (
          <UploadStep key="upload" onNext={handleUploadDone} />
        )}

        {step === 2 && (
          <ReviewStep
            key="review"
            examId={examId!}
            ocrResult={ocrResult}
            isLoading={triggerOCR.isPending}
            questions={questions}
            setQuestions={setQuestions}
            onBack={() => { setStep(1); setOcrResult(null); setQuestions([]) }}
            onConfirm={handleConfirm}
          />
        )}

        {step === 3 && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20">
            <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
            <p className="text-lg font-bold text-white mb-1">Exam Confirmed!</p>
            <p className="text-sm text-slate-400">{questions.length} questions saved. Redirecting to exams…</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}