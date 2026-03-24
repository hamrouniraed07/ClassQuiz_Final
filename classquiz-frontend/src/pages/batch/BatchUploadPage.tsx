import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle, ChevronRight, Users, Link2, Play, FileImage, AlertCircle } from 'lucide-react'
import { useExams, useStudents, useBatchUpload } from '@/hooks/useApi'
import { LoadingPage, PageHeader } from '@/components/shared'

const STEPS = [
  { id: 1, label: 'Select Exam', icon: FileImage },
  { id: 2, label: 'Upload Images', icon: Upload },
  { id: 3, label: 'Map Students', icon: Link2 },
  { id: 4, label: 'Process', icon: Play },
]

interface FileMapping { file: File; studentId: string }

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const state = current > step.id ? 'done' : current === step.id ? 'active' : 'pending'
        const Icon = step.icon
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <motion.div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all step-${state}`}
              animate={{ scale: state === 'active' ? 1.03 : 1 }}
            >
              {state === 'done'
                ? <CheckCircle className="w-3.5 h-3.5" />
                : <Icon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{step.label}</span>
            </motion.div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 transition-colors ${current > step.id ? 'bg-amber-500/50' : 'bg-white/[0.06]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function BatchUploadPage() {
  const [step, setStep] = useState(1)
  const [examId, setExamId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [mappings, setMappings] = useState<FileMapping[]>([])
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const { data: examsData } = useExams({ status: 'active' })
  const { data: studentsData } = useStudents({ limit: 200 })
  const batchUpload = useBatchUpload()

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(accepted)
    setMappings(accepted.map(f => ({ file: f, studentId: '' })))
    if (accepted.length > 0 && examId) setStep(3)
    else if (accepted.length > 0) setStep(2)
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
      setResult(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Batch upload failed')
      setStep(3)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
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
                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all
                      ${examId === exam._id ? 'border-amber-500/50 bg-amber-500/[0.07]' : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]'}`}>
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                      <FileImage className="w-4.5 h-4.5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{exam.title}</p>
                      <p className="text-xs text-slate-400">{exam.subject} · Grade {exam.class} · {exam.totalScore} pts</p>
                    </div>
                    {examId === exam._id && <CheckCircle className="w-4 h-4 text-amber-400 ml-auto" />}
                  </button>
                ))}
                {!examsData?.exams.length && <p className="text-sm text-slate-400 text-center py-6">No active exams. Create an exam first.</p>}
              </div>
            </motion.div>
          )}

          {/* Step 2: Upload Images */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h3 className="text-sm font-bold text-white mb-3">Upload student exam images</h3>
              <div {...getRootProps()} className={`drop-zone p-10 text-center ${isDragActive ? 'dragging' : ''}`}>
                <input {...getInputProps()} />
                <motion.div animate={{ y: isDragActive ? -4 : 0 }} className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center">
                    <Upload className={`w-7 h-7 ${isDragActive ? 'text-amber-400' : 'text-slate-500'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {isDragActive ? 'Drop files here' : 'Drag & drop exam images'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">or click to browse · Up to 50 images · JPG, PNG, WebP</p>
                  </div>
                </motion.div>
              </div>
              {files.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 grid grid-cols-4 gap-2">
                  {files.slice(0, 8).map((f, i) => (
                    <div key={i} className="aspect-square rounded-xl bg-navy-800 border border-white/[0.06] flex items-center justify-center overflow-hidden relative group">
                      <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-xs text-white text-center px-1 truncate">{f.name}</p>
                      </div>
                    </div>
                  ))}
                  {files.length > 8 && <div className="aspect-square rounded-xl bg-navy-800 border border-white/[0.06] flex items-center justify-center"><p className="text-sm font-bold text-slate-400">+{files.length - 8}</p></div>}
                </motion.div>
              )}
              {files.length > 0 && (
                <div className="flex justify-between mt-4">
                  <p className="text-xs text-slate-400">{files.length} files ready</p>
                  <button onClick={() => setStep(3)} className="btn-primary flex items-center gap-1.5 text-xs">Next: Map Students <ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
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
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-navy-700">
                      <img src={URL.createObjectURL(m.file)} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{m.file.name}</p>
                    </div>
                    <select
                      value={m.studentId}
                      onChange={e => {
                        const updated = [...mappings]; updated[i] = { ...m, studentId: e.target.value }; setMappings(updated)
                      }}
                      className="input-dark text-xs py-1.5 w-44 flex-shrink-0"
                    >
                      <option value="">— Select student —</option>
                      {studentsData?.students.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
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
                <button onClick={handleProcess}
                  disabled={mappings.some(m => !m.studentId)}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Play className="w-3.5 h-3.5" /> Start Processing
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Processing */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
              {batchUpload.isPending ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-14 h-14 rounded-2xl bg-grad-brand mx-auto mb-4 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-white" />
                  </motion.div>
                  <p className="text-base font-bold text-white mb-1">Processing batch…</p>
                  <p className="text-sm text-slate-400">{mappings.length} exams uploading and queued for OCR</p>
                </>
              ) : result ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 mx-auto mb-4 flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-base font-bold text-white mb-1">Batch Created!</p>
                  <div className="flex justify-center gap-4 mt-3 text-sm">
                    <span className="badge-green">{result.successCount} queued</span>
                    {result.failedCount > 0 && <span className="badge-red">{result.failedCount} failed</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-3">OCR processing started in background</p>
                  <button onClick={() => { setStep(1); setFiles([]); setMappings([]); setResult(null); setExamId('') }}
                    className="btn-primary mt-5">Start New Batch</button>
                </>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
