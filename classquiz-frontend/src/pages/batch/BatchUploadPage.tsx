import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  Upload, CheckCircle, ChevronRight, ChevronLeft, Play, FileImage,
  AlertCircle, Loader2, XCircle, RotateCw, Plus, Eye, Users, ArrowLeft
} from 'lucide-react'
import { useExams, useStudents, useBatchUpload, useStudentExams, useStudentExam } from '@/hooks/useApi'
import { PageHeader, StatusBadge } from '@/components/shared'
import { CLASS_LEVEL_LABELS } from '@/constants/domain'
import type { ClassLevel } from '@/constants/domain'

interface FileMapping { file: File; studentId: string; studentName?: string }

// ── Pipeline helpers ──────────────────────────────────────────────────────────
function getPipelineProgress(status: string) {
  switch (status) {
    case 'uploaded':          return { percent: 10, stage: 'Queued',       color: 'text-slate-400', bar: 'bg-slate-500' }
    case 'ocr_processing':    return { percent: 35, stage: 'OCR',          color: 'text-sky-400',   bar: 'bg-sky-500' }
    case 'ocr_done':          return { percent: 55, stage: 'OCR Done',     color: 'text-teal-400',  bar: 'bg-teal-500' }
    case 'validation_pending':return { percent: 55, stage: 'Needs Review', color: 'text-amber-400', bar: 'bg-amber-500' }
    case 'validated':         return { percent: 70, stage: 'Validated',    color: 'text-teal-400',  bar: 'bg-teal-500' }
    case 'evaluating':        return { percent: 85, stage: 'Grading',      color: 'text-purple-400',bar: 'bg-purple-500' }
    case 'evaluated':         return { percent: 95, stage: 'Graded',       color: 'text-emerald-400',bar: 'bg-emerald-500' }
    case 'report_ready':      return { percent: 100,stage: 'Complete',     color: 'text-emerald-400',bar: 'bg-emerald-500' }
    case 'failed':            return { percent: 100,stage: 'Failed',       color: 'text-red-400',   bar: 'bg-red-500' }
    default:                  return { percent: 0,  stage: 'Pending',      color: 'text-slate-500', bar: 'bg-slate-600' }
  }
}

function StatusDot({ status }: { status: string }) {
  const isActive = ['ocr_processing', 'evaluating'].includes(status)
  const { color } = getPipelineProgress(status)
  return (
    <span className={`relative flex h-2.5 w-2.5`}>
      {isActive && <span className={`animate-ping absolute h-full w-full rounded-full opacity-40 ${color === 'text-sky-400' ? 'bg-sky-400' : 'bg-purple-400'}`} />}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
        status === 'failed' ? 'bg-red-500' : status === 'report_ready' ? 'bg-emerald-500' :
        isActive ? (status === 'ocr_processing' ? 'bg-sky-400' : 'bg-purple-400') : 'bg-slate-500'
      }`} />
    </span>
  )
}

function canViewOCR(status: string) {
  return ['ocr_done', 'validation_pending', 'validated', 'evaluating', 'evaluated', 'report_ready'].includes(status)
}

// ── Pipeline Row ──────────────────────────────────────────────────────────────
function PipelineRow({ fileName, studentName, status, index, onViewOCR }: {
  fileName: string; studentName: string; status: string; index: number; onViewOCR: () => void
}) {
  const { percent, stage, color, bar } = getPipelineProgress(status)
  const viewEnabled = canViewOCR(status)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all ${
        status === 'failed' ? 'border-red-500/20 bg-red-500/[0.03]' :
        status === 'report_ready' || status === 'evaluated' ? 'border-emerald-500/15 bg-emerald-500/[0.02]' :
        'border-white/[0.05] bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center gap-2.5 w-36 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/[0.06] flex items-center justify-center flex-shrink-0">
          <FileImage className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <p className="text-[11px] text-slate-300 truncate font-mono">{fileName}</p>
      </div>
      <div className="w-32 flex-shrink-0">
        <p className="text-xs text-white font-medium truncate">{studentName}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div className={`h-full rounded-full ${bar}`}
              initial={{ width: 0 }} animate={{ width: `${percent}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }} />
          </div>
          <span className="text-[10px] text-slate-500 w-8 text-right font-mono">{percent}%</span>
        </div>
      </div>
      <div className="flex items-center gap-2 w-28 flex-shrink-0 justify-end">
        <StatusDot status={status} />
        <span className={`text-xs font-semibold ${color}`}>{stage}</span>
      </div>
      <div className="w-20 flex-shrink-0 flex justify-end">
        <button
          onClick={onViewOCR}
          disabled={!viewEnabled}
          className="btn-ghost text-xs px-2 py-1 h-auto inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          title={viewEnabled ? 'View OCR result' : 'OCR result is not ready yet'}
        >
          <Eye className="w-3.5 h-3.5" /> View
        </button>
      </div>
    </motion.div>
  )
}

function PipelineLegend() {
  return (
    <div className="flex items-center gap-4">
      {[{ l: 'OCR', c: 'bg-sky-500' }, { l: 'Validation', c: 'bg-amber-500' }, { l: 'Grading', c: 'bg-purple-500' }, { l: 'Complete', c: 'bg-emerald-500' }].map(i => (
        <div key={i.l} className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${i.c}`} /><span className="text-[10px] text-slate-500">{i.l}</span>
        </div>
      ))}
    </div>
  )
}

function OCRResultModal({ studentExamId, onClose }: { studentExamId: string; onClose: () => void }) {
  const { data: studentExam, isLoading } = useStudentExam(studentExamId)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="glass-card w-full max-w-3xl max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
            <div>
              <h3 className="text-sm font-bold text-white">OCR Result</h3>
              {studentExam && (
                <p className="text-xs text-slate-400">
                  Confidence: {studentExam.ocrConfidenceAvg ?? '-'}% · Status: {studentExam.status}
                </p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white">
              <XCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 max-h-[calc(85vh-72px)] overflow-y-auto">
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading OCR results...
              </div>
            )}

            {!isLoading && studentExam?.processingError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg mb-3">
                {studentExam.processingError}
              </div>
            )}

            {!isLoading && (!studentExam?.answers || studentExam.answers.length === 0) && (
              <p className="text-xs text-slate-400">No OCR answers available for this submission yet.</p>
            )}

            {!isLoading && studentExam?.answers && studentExam.answers.length > 0 && (
              <div className="space-y-2">
                {studentExam.answers
                  .slice()
                  .sort((a, b) => a.questionNumber - b.questionNumber)
                  .map((a) => (
                    <div key={a.questionNumber} className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-white">Q{a.questionNumber}</span>
                        <span className="text-[10px] text-slate-400">
                          Confidence: {a.confidenceScore ?? '-'}%
                        </span>
                      </div>
                      <p className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-words">
                        {a.correctedText || a.extractedText || 'empty'}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Exam Dashboard (shows pipeline + option to upload more) ───────────────────
function ExamDashboard({ examId, examTitle, onBack }: {
  examId: string; examTitle: string; onBack: () => void
}) {
  const [showUpload, setShowUpload] = useState(false)
  const [selectedStudentExamId, setSelectedStudentExamId] = useState<string | null>(null)
  const { data: studentsData } = useStudents({ limit: 200 })
  const { data: seData, refetch } = useStudentExams({ examId })
  const batchUpload = useBatchUpload()

  // Poll every 3s if any items are still processing
  const studentExams = seData?.studentExams ?? []
  const hasProcessing = studentExams.some(se => ['uploaded', 'ocr_processing', 'evaluating'].includes(se.status))

  useEffect(() => {
    if (!hasProcessing) return
    const interval = setInterval(() => refetch(), 3000)
    return () => clearInterval(interval)
  }, [hasProcessing, refetch])

  const completedCount = studentExams.filter(se => ['ocr_done', 'validated', 'evaluated', 'report_ready'].includes(se.status)).length
  const failedCount = studentExams.filter(se => se.status === 'failed').length
  const processingCount = studentExams.filter(se => ['uploaded', 'ocr_processing', 'evaluating'].includes(se.status)).length
  const pendingValidation = studentExams.filter(se => se.status === 'validation_pending').length

  // Upload state
  const [files, setFiles] = useState<File[]>([])
  const [mappings, setMappings] = useState<FileMapping[]>([])
  const [uploadStep, setUploadStep] = useState<'idle' | 'files' | 'map' | 'done'>('idle')
  const [error, setError] = useState('')

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(accepted)
    setMappings(accepted.map(f => ({ file: f, studentId: '', studentName: '' })))
    setUploadStep('map')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }, maxFiles: 50
  })

  const handleProcess = async () => {
    const unmapped = mappings.filter(m => !m.studentId)
    if (unmapped.length > 0) { setError(`${unmapped.length} images not mapped`); return }
    setError('')
    const fd = new FormData()
    fd.append('examId', examId)
    fd.append('mappings', JSON.stringify(mappings.map(m => ({ studentId: m.studentId, fileName: m.file.name }))))
    mappings.forEach(m => fd.append('examImages', m.file))
    try {
      await batchUpload.mutateAsync(fd)
      setUploadStep('done')
      setShowUpload(false)
      setFiles([]); setMappings([])
      refetch()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Batch upload failed')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/[0.07] text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-base font-bold text-white">{examTitle}</h2>
          <p className="text-xs text-slate-400">{studentExams.length} student submissions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn-ghost flex items-center gap-1.5 text-xs">
            <RotateCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => { setShowUpload(!showUpload); setUploadStep('files') }}
            className="btn-primary flex items-center gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add More Students
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {completedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
            <CheckCircle className="w-3 h-3" /> {completedCount} done
          </span>
        )}
        {processingCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400">
            <Loader2 className="w-3 h-3 animate-spin" /> {processingCount} processing
          </span>
        )}
        {pendingValidation > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400">
            <AlertCircle className="w-3 h-3" /> {pendingValidation} needs review
          </span>
        )}
        {failedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400">
            <XCircle className="w-3 h-3" /> {failedCount} failed
          </span>
        )}
        <div className="ml-auto"><PipelineLegend /></div>
      </div>

      {/* Pipeline table */}
      {studentExams.length > 0 ? (
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-4 px-3.5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="w-36">File</div>
            <div className="w-32">Student</div>
            <div className="flex-1">Pipeline</div>
            <div className="w-28 text-right">Status</div>
            <div className="w-20 text-right">OCR</div>
          </div>
          {studentExams.map((se: any, i: number) => {
            const name = typeof se.student === 'object' ? se.student.name : 'Unknown'
            const fileName = se.examImageOriginalName || `exam_${i + 1}.jpg`
            return (
              <PipelineRow
                key={se._id}
                fileName={fileName}
                studentName={name}
                status={se.status}
                index={i}
                onViewOCR={() => setSelectedStudentExamId(se._id)}
              />
            )
          })}
        </div>
      ) : !showUpload ? (
        <div className="glass-card p-12 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-1">No student exams yet</p>
          <p className="text-[10px] text-slate-500 mb-4">Upload student exam images to start OCR processing</p>
          <button onClick={() => { setShowUpload(true); setUploadStep('files') }}
            className="btn-primary flex items-center gap-2 mx-auto text-xs">
            <Upload className="w-3.5 h-3.5" /> Upload Student Exams
          </button>
        </div>
      ) : null}

      {/* Upload panel (collapsible) */}
      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="glass-card p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Upload New Batch</h3>
              <button onClick={() => { setShowUpload(false); setFiles([]); setMappings([]); setUploadStep('idle') }}
                className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white">
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {uploadStep === 'files' && (
              <div>
                <div {...getRootProps()} className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  isDragActive ? 'border-amber-500/50 bg-amber-500/[0.04]' : 'border-white/[0.1] hover:border-white/[0.15]'
                }`}>
                  <input {...getInputProps()} />
                  <Upload className={`w-7 h-7 mx-auto mb-2 ${isDragActive ? 'text-amber-400' : 'text-slate-500'}`} />
                  <p className="text-xs font-semibold text-white">{isDragActive ? 'Drop here' : 'Drag & drop student exam images'}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Up to 50 images · JPG, PNG, WebP</p>
                </div>
                {files.length > 0 && (
                  <div className="flex justify-between mt-3">
                    <span className="text-xs text-slate-400">{files.length} files selected</span>
                    <button onClick={() => setUploadStep('map')} className="btn-primary text-xs flex items-center gap-1">
                      Map Students <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {uploadStep === 'map' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400">{mappings.filter(m => m.studentId).length}/{mappings.length} mapped</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {mappings.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800">
                        <img src={URL.createObjectURL(m.file)} className="w-full h-full object-cover" alt="" />
                      </div>
                      <p className="text-[11px] text-slate-300 truncate flex-1 min-w-0 font-mono">{m.file.name}</p>
                      <select value={m.studentId}
                        onChange={e => {
                          const student = studentsData?.students.find(s => s._id === e.target.value)
                          const updated = [...mappings]
                          updated[i] = { ...m, studentId: e.target.value, studentName: student?.name || '' }
                          setMappings(updated)
                        }}
                        className="input-dark text-xs py-1.5 w-44 flex-shrink-0">
                        <option value="">— Select student —</option>
                        {studentsData?.students.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                      </select>
                      {m.studentId ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-slate-600 flex-shrink-0" />}
                    </div>
                  ))}
                </div>
                {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg mt-3">{error}</p>}
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setUploadStep('files')} className="btn-ghost text-xs">← Back</button>
                  <button onClick={handleProcess} disabled={mappings.some(m => !m.studentId) || batchUpload.isPending}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 text-xs">
                    {batchUpload.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {batchUpload.isPending ? 'Uploading…' : 'Process All'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {selectedStudentExamId && (
        <OCRResultModal
          studentExamId={selectedStudentExamId}
          onClose={() => setSelectedStudentExamId(null)}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BatchUploadPage() {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)
  const [selectedExamTitle, setSelectedExamTitle] = useState('')
  const { data: examsData } = useExams({ status: 'active' })
  const exams = examsData?.exams ?? []

  if (selectedExamId) {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <PageHeader title="Batch Upload" subtitle="Upload and process multiple student exams at once" />
        <ExamDashboard
          examId={selectedExamId}
          examTitle={selectedExamTitle}
          onBack={() => setSelectedExamId(null)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader title="Batch Upload" subtitle="Upload and process multiple student exams at once" />

      <div className="glass-card p-6">
        <h3 className="text-sm font-bold text-white mb-4">Select an exam to view pipeline or upload new student exams</h3>
        <div className="grid grid-cols-1 gap-2">
          {exams.map((exam, i) => (
            <motion.button
              key={exam._id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => { setSelectedExamId(exam._id); setSelectedExamTitle(exam.title) }}
              className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] hover:border-teal-500/30 hover:bg-teal-500/[0.03] text-left transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <FileImage className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{exam.title}</p>
                <p className="text-xs text-slate-400">
                  {exam.subject} · {CLASS_LEVEL_LABELS[exam.classLevel as ClassLevel] ?? exam.classLevel} · {exam.totalScore} pts
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={exam.status} />
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition-colors" />
              </div>
            </motion.button>
          ))}
          {exams.length === 0 && (
            <div className="text-center py-8">
              <FileImage className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No active exams</p>
              <p className="text-[10px] text-slate-500">Create and confirm an exam first</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}