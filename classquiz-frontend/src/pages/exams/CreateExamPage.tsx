import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, CheckCircle, ChevronRight, Loader2, FileImage,
  Save, ArrowLeft, AlertTriangle, Sparkles, X, Plus, Image as ImageIcon
} from 'lucide-react'
import { useCreateExam, useTriggerOCR, useConfirmExam } from '@/hooks/useApi'
import { SUBJECTS, SUBJECT_META, CLASS_LEVELS, CLASS_LEVEL_LABELS } from '@/constants/domain'
import type { ClassLevel, Subject } from '@/constants/domain'
import type { Question } from '@/types'

const STEPS = [
  { id: 1, label: 'Upload Images' },
  { id: 2, label: 'Review OCR Results' },
  { id: 3, label: 'Confirm' },
]

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

// ── Multi-File Upload Area ────────────────────────────────────────────────────
function FileUploadArea({
  label, sublabel, required, files, onAdd, onRemove, color = 'teal',
}: {
  label: string; sublabel: string; required?: boolean
  files: File[]; onAdd: (newFiles: File[]) => void; onRemove: (index: number) => void
  color?: 'teal' | 'sky'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const colors = color === 'teal'
    ? { border: 'border-teal-500/40', bg: 'bg-teal-500/[0.04]', text: 'text-teal-400', icon: 'text-teal-400', badge: 'bg-teal-500/15 text-teal-400' }
    : { border: 'border-sky-500/40', bg: 'bg-sky-500/[0.04]', text: 'text-sky-400', icon: 'text-sky-400', badge: 'bg-sky-500/15 text-sky-400' }

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
        {!required && <span className="text-slate-500 font-normal"> ({sublabel})</span>}
      </label>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl p-5 text-center cursor-pointer border-2 border-dashed transition-all hover:${colors.border} ${
          files.length > 0 ? `${colors.border} ${colors.bg}` : 'border-white/[0.1] bg-slate-800/30'
        }`}
      >
        {files.length === 0 ? (
          <>
            <FileImage className={`w-8 h-8 ${files.length > 0 ? colors.icon : 'text-slate-500'} mx-auto mb-2`} />
            <p className="text-xs text-slate-400">Click to upload exam pages</p>
            <p className="text-[10px] text-slate-500 mt-1">Supports multiple images · JPG, PNG, WebP</p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${colors.badge}`}>
                <ImageIcon className="w-3 h-3" />
                {files.length} image{files.length > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border border-white/[0.1] hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors`}
              >
                <Plus className="w-3 h-3" /> Add more
              </button>
            </div>

            {/* Thumbnails grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2" onClick={(e) => e.stopPropagation()}>
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-800 border border-white/[0.06]">
                  <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                    <p className="text-[8px] text-white text-center px-1 truncate w-full">{f.name}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(i) }}
                      className="p-1 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center text-[8px] text-white font-bold">
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-slate-500 mt-2">
              Total: {(files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(0)} KB
            </p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const newFiles = Array.from(e.target.files ?? [])
            if (newFiles.length > 0) onAdd(newFiles)
            e.target.value = '' // Reset so same file can be re-selected
          }}
        />
      </div>
    </div>
  )
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────
function UploadStep({ onNext }: { onNext: (examId: string) => void }) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState<Subject>(SUBJECTS[0])
  const [classLevel, setClassLevel] = useState<ClassLevel>('3eme')
  const [correctedFiles, setCorrectedFiles] = useState<File[]>([])
  const [blankFiles, setBlankFiles] = useState<File[]>([])
  const [error, setError] = useState('')
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Exam Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-800/60 border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500/50 focus:outline-none"
              placeholder="Mid-Term Mathematics" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value as Subject)}
              className="w-full bg-slate-800/60 border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500/50 focus:outline-none"
              dir="rtl">
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Class Level</label>
          <select value={classLevel} onChange={e => setClassLevel(e.target.value as ClassLevel)}
            className="w-48 bg-slate-800/60 border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500/50 focus:outline-none">
            {CLASS_LEVELS.map(cl => <option key={cl} value={cl}>{CLASS_LEVEL_LABELS[cl]}</option>)}
          </select>
        </div>

        {/* Upload areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUploadArea
            label="Corrected Exam Images"
            sublabel="Contains answers"
            required
            files={correctedFiles}
            onAdd={(newFiles) => setCorrectedFiles(prev => [...prev, ...newFiles])}
            onRemove={(idx) => setCorrectedFiles(prev => prev.filter((_, i) => i !== idx))}
            color="teal"
          />
          <FileUploadArea
            label="Blank Exam Images"
            sublabel="optional — improves OCR"
            files={blankFiles}
            onAdd={(newFiles) => setBlankFiles(prev => [...prev, ...newFiles])}
            onRemove={(idx) => setBlankFiles(prev => prev.filter((_, i) => i !== idx))}
            color="sky"
          />
        </div>

        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>}

        <button onClick={handleSubmit} disabled={createExam.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50">
          {createExam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Process with OCR
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

// ── Step 2: Review ────────────────────────────────────────────────────────────
function ReviewStep({
  isLoading, ocrError, questions, setQuestions, onBack, onConfirm, isConfirming,
}: {
  isLoading: boolean; ocrError: string | null; questions: Question[]
  setQuestions: (q: Question[]) => void; onBack: () => void; onConfirm: () => void; isConfirming: boolean
}) {
  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
        <Loader2 className="w-10 h-10 text-teal-400 mx-auto mb-4 animate-spin" />
        <p className="text-sm text-teal-400 font-semibold mb-1">Processing with Gemini</p>
        <p className="text-xs text-slate-500">Extracting questions and answers…</p>
      </motion.div>
    )
  }

  if (ocrError) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <p className="text-sm text-red-400 font-semibold mb-1">OCR Failed</p>
        <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">{ocrError}</p>
        <button onClick={onBack} className="text-xs text-sky-400 hover:underline">Go back and try again</button>
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
            <motion.div key={q.number} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`rounded-xl border p-5 ${isLow ? 'border-red-500/25 bg-red-500/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-sm font-bold text-teal-400">{q.number}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">Points:</span>
                  <input type="number" step="0.5" min="0" value={q.maxScore}
                    onChange={e => updateQuestion(i, 'maxScore', parseFloat(e.target.value) || 0)}
                    className="w-16 bg-slate-800/60 border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white text-center focus:border-teal-500/50 focus:outline-none" />
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
              <textarea value={q.text} onChange={e => updateQuestion(i, 'text', e.target.value)}
                className="w-full mb-3 bg-slate-900/80 border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white resize-none focus:border-teal-500/50 focus:outline-none"
                dir="auto" rows={2} />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-semibold">Answer:</span>
                </div>
                <input value={q.correctAnswer} onChange={e => updateQuestion(i, 'correctAnswer', e.target.value)}
                  className="flex-1 bg-slate-900/80 border border-white/[0.08] rounded-lg px-4 py-2 text-sm text-white focus:border-teal-500/50 focus:outline-none"
                  dir="auto" />
              </div>
              {isLow && (
                <p className="mt-2 text-[10px] text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Low confidence — please verify
                </p>
              )}
            </motion.div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-sm text-slate-300 hover:bg-white/[0.04] transition-all">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onConfirm} disabled={isConfirming || questions.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50 ml-auto">
          {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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
  const [questions, setQuestions] = useState<Question[]>([])
  const [ocrError, setOcrError] = useState<string | null>(null)

  const triggerOCR = useTriggerOCR()
  const confirmExam = useConfirmExam()

  const handleUploadDone = async (newExamId: string) => {
    setExamId(newExamId)
    setStep(2)
    setOcrError(null)
    try {
      const result = await triggerOCR.mutateAsync(newExamId)
      setQuestions(result.questions)
    } catch (err: any) {
      setOcrError(err.response?.data?.message || err.message || 'OCR processing failed')
    }
  }

  const handleConfirm = async () => {
    if (!examId) return
    try {
      await confirmExam.mutateAsync({ id: examId, questions })
      setStep(3)
      setTimeout(() => navigate('/exams'), 2000)
    } catch { /* error visible via confirmExam.isError */ }
  }

  return (
    <div className="space-y-2">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-white">Create Exam</h1>
        <p className="text-xs text-slate-400">Upload reference images and confirm OCR results</p>
      </div>
      <Stepper current={step} />
      <AnimatePresence mode="wait">
        {step === 1 && <UploadStep key="s1" onNext={handleUploadDone} />}
        {step === 2 && (
          <ReviewStep key="s2" isLoading={triggerOCR.isPending} ocrError={ocrError}
            questions={questions} setQuestions={setQuestions}
            onBack={() => { setStep(1); setOcrError(null); setQuestions([]) }}
            onConfirm={handleConfirm} isConfirming={confirmExam.isPending} />
        )}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20">
            <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
            <p className="text-lg font-bold text-white mb-1">Exam Confirmed!</p>
            <p className="text-sm text-slate-400">{questions.length} questions saved. Redirecting…</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}