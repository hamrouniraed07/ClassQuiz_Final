import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckSquare, AlertTriangle, ChevronRight, CheckCircle, SkipForward,
  Edit3, X, Save, Eye, ZoomIn, RotateCw
} from 'lucide-react'
import { useValidations, useValidationStats, useValidation, useSubmitReview, useSkipValidation } from '@/hooks/useApi'
import { LoadingPage, PageHeader, ConfidenceBadge, SectionCard } from '@/components/shared'
import type { Validation, Correction } from '@/types'

const SUBJECTS = [
  { key: 'الرياضيات',      en: 'Mathematics',     color: 'amber', emoji: '📐' },
  { key: 'الإيقاظ العلمي', en: 'Science',         color: 'teal',  emoji: '🔬' },
  { key: 'الفرنسية',       en: 'French',          color: 'sky',   emoji: '🇫🇷' },
  { key: 'الإنجليزية',     en: 'English',         color: 'indigo',emoji: '🇬🇧' },
]

// ── Subject Card ──────────────────────────────────────────────────────────────
function SubjectCard({ subject, count, onClick, delay }: {
  subject: typeof SUBJECTS[0]; count: number; onClick: () => void; delay: number
}) {
  const colorMap: Record<string, string> = {
    amber:  'from-amber-500/20 to-orange-500/10 border-amber-500/20 text-amber-400',
    teal:   'from-teal-500/20 to-emerald-500/10 border-teal-500/20 text-teal-400',
    sky:    'from-sky-500/20 to-blue-500/10 border-sky-500/20 text-sky-400',
    indigo: 'from-indigo-500/20 to-violet-500/10 border-indigo-500/20 text-indigo-400',
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`glass-card bg-gradient-to-br ${colorMap[subject.color]} border w-full text-left p-6 group transition-all duration-300`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-3xl">{subject.emoji}</span>
        {count > 0 && (
          <motion.span
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="badge-red text-xs font-bold"
          >
            {count} pending
          </motion.span>
        )}
        {count === 0 && <span className="badge-green text-xs">All clear</span>}
      </div>
      <h3 className="text-xl font-bold text-white mb-0.5 font-arabic text-right">{subject.key}</h3>
      <p className="text-xs text-slate-400 text-right">{subject.en}</p>
      <div className="flex items-center justify-end gap-1 mt-4 text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
        <span>Review answers</span>
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </motion.button>
  )
}

// ── Review Interface ──────────────────────────────────────────────────────────
function ReviewPanel({ validationId, onBack, onNext }: {
  validationId: string; onBack: () => void; onNext: () => void
}) {
  const { data: v, isLoading } = useValidation(validationId)
  const submitReview = useSubmitReview()
  const skipVal = useSkipValidation()
  const [corrections, setCorrections] = useState<Record<number, string>>({})
  const [notes, setNotes] = useState('')
  const [editingQ, setEditingQ] = useState<number | null>(null)
  const [zoom, setZoom] = useState(false)

  if (isLoading || !v) return <LoadingPage />

  const allAnswers = v.studentExam.answers || []
  const flagged = new Set(v.flaggedAnswers.map(f => f.questionNumber))

  const handleCorrection = (qNum: number, text: string) => {
    setCorrections(prev => ({ ...prev, [qNum]: text }))
  }

  const handleSubmit = async () => {
    const correctionsList: Correction[] = Object.entries(corrections).map(([qNum, text]) => ({
      questionNumber: parseInt(qNum), correctedText: text
    }))
    await submitReview.mutateAsync({ id: v._id, corrections: correctionsList, notes })
    onNext()
  }

  const handleSkip = async () => {
    await skipVal.mutateAsync(v._id)
    onNext()
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5 text-xs">
          <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back
        </button>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white">{v.student.name}</h3>
          <p className="text-xs text-slate-400">{v.exam.subject} · Grade {v.exam.class} · {v.flaggedAnswers.length} answers flagged</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSkip} disabled={skipVal.isPending}
            className="btn-ghost flex items-center gap-1.5 text-xs border border-white/[0.08]">
            <SkipForward className="w-3.5 h-3.5" /> Skip
          </button>
          <button onClick={handleSubmit} disabled={submitReview.isPending || Object.keys(corrections).length === 0}
            className="btn-primary flex items-center gap-1.5 text-xs">
            <Save className="w-3.5 h-3.5" />
            {submitReview.isPending ? 'Saving…' : `Save ${Object.keys(corrections).length} Corrections`}
          </button>
        </div>
      </div>

      {/* Split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[560px]">
        {/* Left: Exam Image */}
        <div className="glass-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-300">Exam Image</p>
            <button onClick={() => setZoom(!zoom)}
              className="btn-ghost text-xs flex items-center gap-1">
              <ZoomIn className="w-3.5 h-3.5" /> {zoom ? 'Fit' : 'Zoom'}
            </button>
          </div>
          <div className={`flex-1 rounded-xl bg-navy-950 border border-white/[0.04] overflow-auto flex items-${zoom ? 'start' : 'center'} justify-center`}>
            <img
              src={`/${v.studentExam.examImagePath}`}
              alt="Student exam"
              className={`rounded-lg ${zoom ? 'w-full' : 'max-h-[480px] max-w-full object-contain'} transition-all`}
              onError={e => {
                const t = e.target as HTMLImageElement
                t.src = 'https://placehold.co/600x800/1e293b/64748b?text=Exam+Image'
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>OCR Confidence avg: <span className={v.studentExam.ocrConfidenceAvg && v.studentExam.ocrConfidenceAvg >= 70 ? 'text-emerald-400' : 'text-red-400'}>{v.studentExam.ocrConfidenceAvg?.toFixed(1)}%</span></span>
            <span>{v.flaggedAnswers.length} flagged</span>
          </div>
        </div>

        {/* Right: Answers */}
        <div className="glass-card p-4 flex flex-col gap-3 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-300">OCR Extracted Answers</p>
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {allAnswers.map(answer => {
              const isFlagged = flagged.has(answer.questionNumber)
              const question = v.exam.questions?.find(q => q.number === answer.questionNumber)
              const correctedVal = corrections[answer.questionNumber]
              const isEditing = editingQ === answer.questionNumber

              return (
                <motion.div
                  key={answer.questionNumber}
                  layout
                  className={`p-3.5 rounded-xl border transition-all ${
                    isFlagged
                      ? 'border-red-500/30 bg-red-500/[0.05]'
                      : 'border-white/[0.05] bg-white/[0.02]'
                  }`}
                >
                  {/* Q header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Q{answer.questionNumber}</span>
                      {isFlagged && (
                        <span className="badge-red text-[10px] flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Low confidence
                        </span>
                      )}
                      {correctedVal && (
                        <span className="badge-green text-[10px] flex items-center gap-0.5">
                          <CheckCircle className="w-2.5 h-2.5" /> Corrected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <ConfidenceBadge score={answer.confidenceScore ?? 0} />
                      {isFlagged && (
                        <button
                          onClick={() => setEditingQ(isEditing ? null : answer.questionNumber)}
                          className="p-1 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-amber-400 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Question text */}
                  {question && (
                    <p className="text-[10px] text-slate-500 mb-1.5 line-clamp-1">{question.text}</p>
                  )}

                  {/* OCR result */}
                  <div className="text-xs">
                    <span className="text-slate-500">OCR: </span>
                    <span className={`font-mono ${isFlagged ? 'text-red-300' : 'text-slate-300'}`}>
                      {answer.extractedText || <em className="text-slate-600">empty</em>}
                    </span>
                  </div>

                  {/* Correction input */}
                  <AnimatePresence>
                    {isEditing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2.5 overflow-hidden"
                      >
                        <label className="text-[10px] text-amber-400 font-semibold block mb-1">Correction:</label>
                        <div className="flex gap-2">
                          <input
                            value={correctedVal ?? answer.extractedText}
                            onChange={e => handleCorrection(answer.questionNumber, e.target.value)}
                            className="input-dark text-xs flex-1 py-1.5"
                            placeholder="Type corrected answer…"
                            autoFocus
                          />
                          <button
                            onClick={() => setEditingQ(null)}
                            className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Show corrected value if set and not editing */}
                  {correctedVal && !isEditing && (
                    <div className="mt-1.5 text-xs">
                      <span className="text-slate-500">Corrected: </span>
                      <span className="font-mono text-emerald-400">{correctedVal}</span>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* Notes */}
          <div className="border-t border-white/[0.05] pt-3">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input-dark text-xs resize-none h-16"
              placeholder="e.g. Handwriting smudged on bottom half…"
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main Validation Page ──────────────────────────────────────────────────────
export default function ValidationPage() {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [selectedValidationId, setSelectedValidationId] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const { data: stats } = useValidationStats()
  const { data: validationsData, isLoading } = useValidations({
    status: 'pending',
    page: 1,
  })

  const validations = validationsData?.validations ?? []

  // Filter by selected subject
  const subjectValidations = selectedSubject
    ? validations.filter(v => v.exam.subject === selectedSubject)
    : []

  const getCountForSubject = (subjectAr: string, subjectEn: string) =>
    validations.filter(v =>
      v.exam.subject === subjectEn || v.exam.subject === subjectAr
    ).length

  const handleSubjectSelect = (subjectEn: string) => {
    const filtered = validations.filter(v => v.exam.subject === subjectEn)
    if (filtered.length > 0) {
      setSelectedSubject(subjectEn)
      setSelectedValidationId(filtered[0]._id)
      setCurrentIndex(0)
    }
  }

  const handleNext = () => {
    const next = currentIndex + 1
    if (next < subjectValidations.length) {
      setCurrentIndex(next)
      setSelectedValidationId(subjectValidations[next]._id)
    } else {
      setSelectedValidationId(null)
      setSelectedSubject(null)
      setCurrentIndex(0)
    }
  }

  if (isLoading) return <LoadingPage />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Validation Center"
        subtitle="Review and correct low-confidence OCR results"
        action={
          <div className="flex gap-2">
            <span className="badge-red">{stats?.pending ?? 0} pending</span>
            <span className="badge-green">{stats?.completed ?? 0} done today</span>
          </div>
        }
      />

      <AnimatePresence mode="wait">
        {/* ── Subject Selection View ── */}
        {!selectedValidationId && (
          <motion.div key="subjects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Pending Review', value: stats?.pending ?? 0, cls: 'badge-red' },
                { label: 'In Review',      value: stats?.in_review ?? 0, cls: 'badge-amber' },
                { label: 'Completed',      value: stats?.completed ?? 0, cls: 'badge-green' },
                { label: 'Skipped',        value: stats?.skipped ?? 0, cls: 'badge-sky' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="glass-card p-4 flex items-center gap-3">
                  <span className={`${cls} text-lg font-bold px-3 py-1`}>{value}</span>
                  <span className="text-xs text-slate-400">{label}</span>
                </div>
              ))}
            </div>

            {/* Subject cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {SUBJECTS.map((subject, i) => (
                <SubjectCard
                  key={subject.key}
                  subject={subject}
                  count={getCountForSubject(subject.key, subject.en)}
                  onClick={() => handleSubjectSelect(subject.en)}
                  delay={i * 0.08}
                />
              ))}
            </div>

            {/* All pending validations list */}
            {validations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-6"
              >
                <SectionCard title="All Pending Reviews"
                  action={
                    <button
                      onClick={() => {
                        if (validations.length > 0) {
                          setSelectedValidationId(validations[0]._id)
                          setSelectedSubject(validations[0].exam.subject)
                        }
                      }}
                      className="btn-primary text-xs flex items-center gap-1.5"
                    >
                      <CheckSquare className="w-3.5 h-3.5" /> Start Reviewing
                    </button>
                  }
                >
                  <table className="w-full table-dark">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Exam</th>
                        <th>Flagged</th>
                        <th>Avg Confidence</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {validations.slice(0, 8).map((v, i) => (
                        <motion.tr key={v._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0 text-xs font-bold text-red-400">
                                {v.student.name[0]}
                              </div>
                              <span className="font-medium text-white">{v.student.name}</span>
                            </div>
                          </td>
                          <td className="text-slate-400">{v.exam.subject}</td>
                          <td>
                            <span className="badge-red">{v.flaggedAnswers.length} answers</span>
                          </td>
                          <td>
                            <ConfidenceBadge score={
                              v.flaggedAnswers.reduce((s, f) => s + f.confidenceScore, 0) /
                              (v.flaggedAnswers.length || 1)
                            } />
                          </td>
                          <td>
                            <button
                              onClick={() => {
                                setSelectedValidationId(v._id)
                                setSelectedSubject(v.exam.subject)
                                setCurrentIndex(validations.indexOf(v))
                              }}
                              className="btn-ghost text-xs flex items-center gap-1"
                            >
                              Review <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </SectionCard>
              </motion.div>
            )}

            {validations.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 }}
                className="mt-6 glass-card p-12 text-center"
              >
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-base font-bold text-white mb-1">All caught up!</h3>
                <p className="text-sm text-slate-400">No pending validations right now. Great work!</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Review Panel ── */}
        {selectedValidationId && (
          <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {/* Progress indicator */}
            {subjectValidations.length > 1 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-slate-400">
                  Reviewing {currentIndex + 1} of {subjectValidations.length} in {selectedSubject}
                </span>
                <div className="flex-1 h-1.5 bg-navy-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-grad-class rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentIndex + 1) / subjectValidations.length) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
            )}
            <ReviewPanel
              validationId={selectedValidationId}
              onBack={() => { setSelectedValidationId(null); setSelectedSubject(null) }}
              onNext={handleNext}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
