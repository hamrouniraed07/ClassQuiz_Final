import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  Upload, X, CheckCircle, ChevronRight, Users, Link2, Play, FileImage,
  AlertCircle, Loader2, XCircle, Eye, RotateCw, Trash2
} from 'lucide-react'
import { useExams, useStudents, useBatchUpload, useStudentExams } from '@/hooks/useApi'
import { LoadingPage, PageHeader } from '@/components/shared'
import { CLASS_LEVEL_LABELS } from '@/constants/domain'
import type { ClassLevel } from '@/constants/domain'

const STEPS = [
  { id: 1, label: 'Select Exam', icon: FileImage },
  { id: 2, label: 'Upload Images', icon: Upload },
  { id: 3, label: 'Map Students', icon: Link2 },
  { id: 4, label: 'Process', icon: Play },
]

interface FileMapping { file: File; studentId: string; studentName?: string }

// ── Pipeline Status Colors ────────────────────────────────────────────────────
const PIPELINE_STAGES = ['uploaded', 'ocr_processing', 'ocr_done', 'validated', 'evaluating', 'evaluated'] as const

function getPipelineProgress(status: string): { percent: number; stage: string; color: string } {
  switch (status) {
    case 'uploaded':          return { percent: 10, stage: 'Queued',      color: 'text-slate-400' }
    case 'ocr_processing':    return { percent: 35, stage: 'OCR',         color: 'text-sky-400' }
    case 'ocr_done':          return { percent: 55, stage: 'OCR Done',    color: 'text-teal-400' }
    case 'validation_pending':return { percent: 55, stage: 'Needs Review',color: 'text-amber-400' }
    case 'validated':         return { percent: 70, stage: 'Validated',   color: 'text-teal-400' }
    case 'evaluating':        return { percent: 85, stage: 'Grading',     color: 'text-purple-400' }
    case 'evaluated':         return { percent: 95, stage: 'Graded',      color: 'text-emerald-400' }
    case 'report_ready':      return { percent: 100,stage: 'Complete',    color: 'text-emerald-400' }
    case 'failed':            return { percent: 100,stage: 'Failed',      color: 'text-red-400' }
    default:                  return { percent: 0,  stage: 'Pending',     color: 'text-slate-500' }
  }
}

function StatusDot({ status }: { status: string }) {
  const { color } = getPipelineProgress(status)
  const isActive = ['ocr_processing', 'evaluating'].includes(status)
  return (
    <span className={`relative flex h-2.5 w-2.5 ${color}`}>
      {isActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-40" />}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
        status === 'failed' ? 'bg-red-500' :
        status === 'report_ready' ? 'bg-emerald-500' :
        isActive ? 'bg-current' :
        'bg-current opacity-60'
      }`} />
    </span>
  )
}

// ── Step Indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const state = current > step.id ? 'done' : current === step.id ? 'active' : 'pending'
        const Icon = step.icon
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <motion.div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                state === 'done' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                state === 'active' ? 'bg-teal-500/15 border-teal-500/40 text-teal-400' :
                'bg-white/[0.03] border-white/[0.06] text-slate-500'
              }`}
              animate={{ scale: state === 'active' ? 1.03 : 1 }}
            >
              {state === 'done' ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{step.label}</span>
            </motion.div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 transition-colors ${current > step.id ? 'bg-emerald-500/50' : 'bg-white/[0.06]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Pipeline Table Row ────────────────────────────────────────────────────────
function PipelineRow({ fileName, studentName, status, index }: {
  fileName: string; studentName: string; status: string; index: number
}) {
  const { percent, stage, color } = getPipelineProgress(status)
  const isFailed = status === 'failed'
  const isComplete = status === 'report_ready' || status === 'evaluated'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all ${
        isFailed ? 'border-red-500/20 bg-red-500/[0.03]' :
        isComplete ? 'border-emerald-500/15 bg-emerald-500/[0.02]' :
        'border-white/[0.05] bg-white/[0.02]'
      }`}
    >
      {/* File icon + name */}
      <div className="flex items-center gap-2.5 w-40 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/[0.06] flex items-center justify-center flex-shrink-0">
          <FileImage className="w-4 h-4 text-slate-500" />
        </div>
        <p className="text-xs text-slate-300 truncate font-mono">{fileName}</p>
      </div>

      {/* Student name */}
      <div className="w-32 flex-shrink-0">
        <p className="text-xs text-white font-medium truncate">{studentName}</p>
      </div>

      {/* Progress bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                isFailed ? 'bg-red-500' :
                isComplete ? 'bg-emerald-500' :
                'bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[10px] text-slate-500 w-8 text-right font-mono">{percent}%</span>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 w-28 flex-shrink-0 justify-end">
        <StatusDot status={status} />
        <span className={`text-xs font-semibold ${color}`}>{stage}</span>
      </div>
    </motion.div>
  )
}

// ── Legend ─────────────────────────────────────────────────────────────────────
function PipelineLegend() {
  const items = [
    { label: 'OCR', color: 'bg-sky-500' },
    { label: 'Validation', color: 'bg-amber-500' },
    { label: 'Grading', color: 'bg-purple-500' },
    { label: 'Complete', color: 'bg-emerald-500' },
  ]
  return (
    <div className="flex items-center gap-4 mb-4">
      {items.map(i => (
        <div key={i.label} className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${i.color}`} />
          <span className="text-[10px] text-slate-500">{i.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BatchUploadPage() {
  const [step, setStep] = useState(1)
  const [examId, setExamId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [mappings, setMappings] = useState<FileMapping[]>([])
  const [batchId, setBatchId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { data: examsData } = useExams({ status: 'active' })
  const { data: studentsData } = useStudents({ limit: 200 })
  const batchUpload = useBatchUpload()

  // Poll for student exam status updates when processing
  const shouldPoll = step === 4 && examId
  const { data: studentExamsData, refetch: refetchStudentExams } = useStudentExams(
    shouldPoll ? { examId } : undefined
  )

  // Auto-poll every 3 seconds during processing
  useEffect(() => {
    if (!shouldPoll) return
    const interval = setInterval(() => refetchStudentExams(), 3000)
    return () => clearInterval(interval)
  }, [shouldPoll, refetchStudentExams])

  const studentExams = studentExamsData?.studentExams ?? []

  // Build lookup: studentId → student name from mappings
  const studentNameMap: Record<string, string> = {}
  mappings.forEach(m => {
    if (m.studentId && m.studentName) studentNameMap[m.studentId] = m.studentName
  })

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(accepted)
    setMappings(accepted.map(f => ({ file: f, studentId: '', studentName: '' })))
    if (accepted.length > 0) setStep(examId ? 3 : 2)
  }, [examId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }, maxFiles: 50
  })

  const handleProcess = async () => {
    const unmapped = mappings.filter(m => !m.studentId)
    if (unmapped.length > 0) { setError(`${unmapped.length} images not mapped to students`); return }
    setError('')
    setStep(4)

    const fd = new FormData()
    fd.append('examId', examId)
    fd.append('mappings', JSON.stringify(mappings.map(m => ({ studentId: m.studentId, fileName: m.file.name }))))
    mappings.forEach(m => fd.append('examImages', m.file))

    try {
      const data = await batchUpload.mutateAsync(fd)
      setBatchId(data._id)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Batch upload failed')
      setStep(3)
    }
  }

  const handleReset = () => {
    setStep(1); setFiles([]); setMappings([]); setBatchId(null); setExamId(''); setError('')
  }

  // Stats for pipeline view
  const totalItems = mappings.length
  const completedItems = studentExams.filter(se =>
    ['ocr_done', 'validated', 'evaluated', 'report_ready'].includes(se.status)
  ).length
  const failedItems = studentExams.filter(se => se.status === 'failed').length
  const processingItems = studentExams.filter(se =>
    ['uploaded', 'ocr_processing', 'evaluating'].includes(se.status)
  ).length
  const allDone = studentExams.length > 0 && processingItems === 0

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader title="Batch Upload" subtitle="Upload and process multiple student exams at once" />

      <div className="glass-card p-6">
        <StepIndicator current={step} />

        <AnimatePresence mode="wait">
          {/* Step 1: Select Exam */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h3 className="text-sm font-bold text-white mb-3">Select the exam for this batch</h3>
              <div className="grid grid-cols-1 gap-2">
                {examsData?.exams.map(exam => (
                  <button key={exam._id} onClick={() => { setExamId(exam._id); setStep(2) }}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                      examId === exam._id
                        ? 'border-amber-500/50 bg-amber-500/[0.07]'
                        : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]'
                    }`}>
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                      <FileImage className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{exam.title}</p>
                      <p className="text-xs text-slate-400">
                        {exam.subject} · {CLASS_LEVEL_LABELS[exam.classLevel as ClassLevel] ?? exam.classLevel} · {exam.totalScore} pts
                      </p>
                    </div>
                    {examId === exam._id && <CheckCircle className="w-4 h-4 text-amber-400 ml-auto" />}
                  </button>
                ))}
                {!examsData?.exams.length && (
                  <p className="text-sm text-slate-400 text-center py-6">No active exams. Create and confirm an exam first.</p>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 2: Upload Images */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h3 className="text-sm font-bold text-white mb-3">Upload student exam images</h3>
              <div {...getRootProps()} className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
                isDragActive ? 'border-amber-500/50 bg-amber-500/[0.04]' : 'border-white/[0.1] hover:border-white/[0.15]'
              }`}>
                <input {...getInputProps()} />
                <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragActive ? 'text-amber-400' : 'text-slate-500'}`} />
                <p className="text-sm font-semibold text-white">{isDragActive ? 'Drop files here' : 'Drag & drop exam images'}</p>
                <p className="text-xs text-slate-400 mt-1">or click to browse · Up to 50 images · JPG, PNG, WebP</p>
              </div>
              {files.length > 0 && (
                <>
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {files.slice(0, 10).map((f, i) => (
                      <div key={i} className="aspect-square rounded-lg bg-slate-800 border border-white/[0.06] overflow-hidden">
                        <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="" />
                      </div>
                    ))}
                    {files.length > 10 && (
                      <div className="aspect-square rounded-lg bg-slate-800 border border-white/[0.06] flex items-center justify-center">
                        <span className="text-sm font-bold text-slate-400">+{files.length - 10}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between mt-4">
                    <p className="text-xs text-slate-400">{files.length} files ready</p>
                    <button onClick={() => setStep(3)} className="btn-primary flex items-center gap-1.5 text-xs">
                      Next: Map Students <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Step 3: Map Students */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">Map images to students</h3>
                <span className="text-xs text-slate-400">{mappings.filter(m => m.studentId).length}/{mappings.length} mapped</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {mappings.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800">
                      <img src={URL.createObjectURL(m.file)} className="w-full h-full object-cover" alt="" />
                    </div>
                    <p className="text-xs text-slate-300 truncate flex-1 min-w-0 font-mono">{m.file.name}</p>
                    <select
                      value={m.studentId}
                      onChange={e => {
                        const student = studentsData?.students.find(s => s._id === e.target.value)
                        const updated = [...mappings]
                        updated[i] = { ...m, studentId: e.target.value, studentName: student?.name || '' }
                        setMappings(updated)
                      }}
                      className="input-dark text-xs py-1.5 w-48 flex-shrink-0"
                    >
                      <option value="">— Select student —</option>
                      {studentsData?.students.map(s => (
                        <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                    {m.studentId
                      ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      : <AlertCircle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    }
                  </div>
                ))}
              </div>
              {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg mt-3">{error}</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep(2)} className="btn-ghost">← Back</button>
                <button onClick={handleProcess} disabled={mappings.some(m => !m.studentId) || batchUpload.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {batchUpload.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {batchUpload.isPending ? 'Uploading…' : 'Process All'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Pipeline Status */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* Summary header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Processing Pipeline</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {allDone ? 'All items processed' : 'OCR processing in progress…'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {completedItems > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                      <CheckCircle className="w-3 h-3" /> {completedItems} done
                    </span>
                  )}
                  {failedItems > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400">
                      <XCircle className="w-3 h-3" /> {failedItems} failed
                    </span>
                  )}
                  {processingItems > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400">
                      <Loader2 className="w-3 h-3 animate-spin" /> {processingItems} processing
                    </span>
                  )}
                </div>
              </div>

              <PipelineLegend />

              {/* Pipeline table */}
              <div className="space-y-2">
                {/* Header */}
                <div className="flex items-center gap-4 px-3.5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <div className="w-40">File</div>
                  <div className="w-32">Student</div>
                  <div className="flex-1">Pipeline</div>
                  <div className="w-28 text-right">Status</div>
                </div>

                {/* If we have student exam data from polling, show real status */}
                {studentExams.length > 0 ? (
                  studentExams.map((se: any, i: number) => {
                    const studentName = typeof se.student === 'object' ? se.student.name : (studentNameMap[se.student] || 'Unknown')
                    const fileName = se.examImageOriginalName || `exam_${i + 1}.jpg`
                    return (
                      <PipelineRow
                        key={se._id}
                        fileName={fileName}
                        studentName={studentName}
                        status={se.status}
                        index={i}
                      />
                    )
                  })
                ) : (
                  /* Show from mappings while waiting for first poll */
                  mappings.map((m, i) => (
                    <PipelineRow
                      key={i}
                      fileName={m.file.name}
                      studentName={m.studentName || 'Loading…'}
                      status={batchUpload.isPending ? 'uploading' : 'uploaded'}
                      index={i}
                    />
                  ))
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.05]">
                <button onClick={() => refetchStudentExams()} className="btn-ghost flex items-center gap-1.5 text-xs">
                  <RotateCw className="w-3.5 h-3.5" /> Refresh Status
                </button>
                <div className="flex gap-3">
                  {allDone && (
                    <button onClick={handleReset} className="btn-primary flex items-center gap-2 text-xs">
                      <Upload className="w-3.5 h-3.5" /> Start New Batch
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}