import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckSquare, AlertTriangle, ChevronRight, CheckCircle, SkipForward,
  Edit3, X, Save, Eye, ZoomIn, RotateCw
} from 'lucide-react'
import { useValidations, useValidationStats, useValidation, useSubmitReview, useSkipValidation } from '@/hooks/useApi'
import { LoadingPage, PageHeader, ConfidenceBadge, SectionCard } from '@/components/shared'
import { SUBJECTS, SUBJECT_META } from '@/constants/domain'
import { CLASS_LEVEL_LABELS } from '@/constants/domain'
import type { Subject } from '@/constants/domain'
import type { Validation, Correction } from '@/types'

// Build local subject list from shared constants
const SUBJECT_LIST = SUBJECTS.map(key => ({
  key,
  en: SUBJECT_META[key].en,
  color: SUBJECT_META[key].color,
  emoji: SUBJECT_META[key].emoji,
}))

// ── Subject Card ──────────────────────────────────────────────────────────────
function SubjectCard({ subject, count, onClick, delay }: {
  subject: typeof SUBJECT_LIST[0]; count: number; onClick: () => void; delay: number
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
      className={`glass-card bg-gradient-to-br ${colorMap[subject.color] ?? colorMap.amber} p-5 text-left w-full`}
    >
      <span className="text-2xl mb-2 block">{subject.emoji}</span>
      <p className="text-sm font-bold mb-0.5" dir="rtl">{subject.key}</p>
      <p className="text-xs opacity-70">{subject.en}</p>
      <p className="text-lg font-bold mt-2">
        {count} <span className="text-xs font-normal opacity-60">pending</span>
      </p>
    </motion.button>
  )
}

// ── Review Panel ──────────────────────────────────────────────────────────────
function ReviewPanel({ validationId, onNext, onBack }: {
  validationId: string; onNext: () => void; onBack: () => void
}) {
  const { data: validation, isLoading } = useValidation(validationId)
  const submitReview = useSubmitReview()
  const skipValidation = useSkipValidation()
  const [corrections, setCorrections] = useState<Record<number, string>>({})
  const [editingQ, setEditingQ] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  if (isLoading || !validation) return <LoadingPage />

  const handleCorrection = (qNum: number, text: string) => {
    setCorrections(prev => ({ ...prev, [qNum]: text }))
  }

  const handleSubmit = async () => {
    const correctionArray: Correction[] = Object.entries(corrections)
      .filter(([, text]) => text.trim())
      .map(([qNum, text]) => ({ questionNumber: parseInt(qNum), correctedText: text }))
    await submitReview.mutateAsync({ id: validationId, corrections: correctionArray, notes })
    onNext()
  }

  const handleSkip = async () => {
    await skipValidation.mutateAsync(validationId)
    onNext()
  }

  const student = validation.student
  const exam = validation.exam

  return (
    <motion.div
      key={validationId}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-4"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost text-xs flex items-center gap-1">
          <X className="w-3.5 h-3.5" /> Back to subjects
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleSkip} disabled={skipValidation.isPending}
            className="btn-ghost text-xs flex items-center gap-1 text-slate-400 hover:text-amber-400">
            <SkipForward className="w-3.5 h-3.5" /> Skip
          </button>
          <button onClick={handleSubmit} disabled={submitReview.isPending}
            className="btn-primary text-xs flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            {submitReview.isPending ? 'Saving…' : 'Submit & Next'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Image viewer */}
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white">
              {student.name} — <span className="text-slate-400">{student.code}</span>
            </p>
            <span className="badge-sky text-[10px]">
              {CLASS_LEVEL_LABELS[student.classLevel] ?? student.classLevel}
            </span>
          </div>
          <div className="aspect-[3/4] rounded-lg bg-navy-950 border border-white/[0.05] flex items-center justify-center overflow-hidden">
            <img
              src={`/api/uploads/${validation.studentExam.examImagePath}`}
              alt="Student exam"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Right: Flagged answers review */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white">Flagged Answers</h4>
            <span className="badge-red text-[10px]">{validation.flaggedAnswers.length} flagged</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {validation.flaggedAnswers.map((answer, idx) => {
              const isEditing = editingQ === answer.questionNumber
              const correctedVal = corrections[answer.questionNumber]

              return (
                <motion.div
                  key={answer.questionNumber}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">Q{answer.questionNumber}</span>
                    <div className="flex items-center gap-2">
                      <ConfidenceBadge score={answer.confidenceScore} />
                      <button
                        onClick={() => setEditingQ(isEditing ? null : answer.questionNumber)}
                        className="p-1 rounded hover:bg-white/[0.07] text-slate-400 hover:text-amber-400 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 font-mono bg-navy-950/50 px-2 py-1 rounded">
                    {answer.extractedText || <span className="text-slate-600 italic">empty</span>}
                  </p>

                  <AnimatePresence>
                    {isEditing && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 overflow-hidden"
                      >
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

  const getCountForSubject = (subjectKey: string) =>
    validations.filter(v => v.exam.subject === subjectKey).length

  const handleSubjectSelect = (subjectKey: string) => {
    const filtered = validations.filter(v => v.exam.subject === subjectKey)
    if (filtered.length > 0) {
      setSelectedSubject(subjectKey)
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
              {SUBJECT_LIST.map((subject, i) => (
                <SubjectCard
                  key={subject.key}
                  subject={subject}
                  count={getCountForSubject(subject.key)}
                  onClick={() => handleSubjectSelect(subject.key)}
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
                            <ConfidenceBadge score={v.studentExam?.ocrConfidenceAvg ?? 0} />
                          </td>
                          <td>
                            <button
                              onClick={() => {
                                setSelectedValidationId(v._id)
                                setSelectedSubject(v.exam.subject)
                              }}
                              className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-amber-400 transition-colors"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </SectionCard>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Review View ── */}
        {selectedValidationId && (
          <ReviewPanel
            key={selectedValidationId}
            validationId={selectedValidationId}
            onNext={handleNext}
            onBack={() => {
              setSelectedValidationId(null)
              setSelectedSubject(null)
              setCurrentIndex(0)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}