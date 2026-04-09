import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Pencil, Trash2, Users, X, ChevronLeft, ChevronRight, FileSpreadsheet, Upload, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent, useImportCSV } from '@/hooks/useApi'
import { LoadingPage, EmptyState, StatusBadge, PageHeader } from '@/components/shared'
import { CLASS_LEVELS, CLASS_LEVEL_LABELS } from '@/constants/domain'
import type { ClassLevel } from '@/constants/domain'
import type { Student, CSVImportResult } from '@/types'

// ── Add Student Modal ─────────────────────────────────────────────────────────
function AddStudentModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<{ name: string; code: string; classLevel: ClassLevel }>({ name: '', code: '', classLevel: '1ere' })
  const [error, setError] = useState('')
  const create = useCreateStudent()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    try { await create.mutateAsync(form); onClose() }
    catch (err: any) { setError(err.response?.data?.message || 'Failed to create student') }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="glass-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Add New Student</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-dark" placeholder="Ahmed Ben Ali" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Student Code</label>
            <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-dark font-mono" placeholder="STU-2024-001" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Class Level</label>
            <select value={form.classLevel} onChange={e => setForm({ ...form, classLevel: e.target.value as ClassLevel })} className="input-dark">
              {CLASS_LEVELS.map(cl => <option key={cl} value={cl}>{CLASS_LEVEL_LABELS[cl]}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">{create.isPending ? 'Creating…' : 'Add Student'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Edit Student Modal ────────────────────────────────────────────────────────
function EditStudentModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const [form, setForm] = useState({
    name: student.name,
    code: student.code,
    classLevel: student.classLevel as ClassLevel,
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const update = useUpdateStudent()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || update.isPending) return
    setError('')
    setIsSubmitting(true)
    try {
      await update.mutateAsync({ id: student._id, name: form.name, code: form.code, classLevel: form.classLevel })
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update student')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="glass-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Edit Student</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-dark" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Student Code</label>
            <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input-dark font-mono" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Class Level</label>
            <select value={form.classLevel} onChange={e => setForm({ ...form, classLevel: e.target.value as ClassLevel })} className="input-dark">
              {CLASS_LEVELS.map(cl => <option key={cl} value={cl}>{CLASS_LEVEL_LABELS[cl]}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={update.isPending || isSubmitting} className="btn-primary flex-1">{update.isPending || isSubmitting ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Delete Confirmation Modal ─────────────────────────────────────────────────
function DeleteConfirmModal({ student, onClose, onConfirm, isPending }: { student: Student; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="glass-card w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">Delete Student?</h3>
        <p className="text-xs text-slate-400 mb-5">
          This will deactivate <span className="text-white font-semibold">{student.name}</span> ({student.code}).
          This action can be undone by reactivating later.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={onConfirm} disabled={isPending}
            className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────
function ImportCSVModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<CSVImportResult | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const importCSV = useImportCSV()

  const summary = result?.summary
  const totalRows = summary?.totalRows ?? 0
  const successCount = summary?.successCount ?? 0
  const failedCount = summary?.failedCount ?? 0
  const successRate = totalRows > 0 ? Math.round((successCount / totalRows) * 100) : 0

  const handleImport = async () => {
    if (!file) return; setError(''); setResult(null)
    try { const res = await importCSV.mutateAsync(file); setResult(res) }
    catch (err: any) { setError(err.response?.data?.message || 'CSV import failed') }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="glass-card w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-teal-400" />Import CSV</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="mb-4 p-3 rounded-lg bg-sky-500/[0.06] border border-sky-500/15">
          <p className="text-xs font-semibold text-sky-400 mb-1">CSV Format:</p>
          <code className="text-[11px] text-slate-300 block font-mono">name,studentCode,classLevel<br/>Ahmed Ben Ali,STU-2024-001,3eme</code>
        </div>
        <div onClick={() => fileRef.current?.click()} className={`drop-zone p-6 text-center cursor-pointer mb-4 ${file ? 'border-teal-500/40 bg-teal-500/[0.04]' : ''}`}>
          <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
          {file ? <p className="text-xs text-teal-400">{file.name}</p> : <p className="text-xs text-slate-400">Click to select CSV</p>}
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setError('') }} />
        </div>
        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg mb-4">{error}</p>}
        {result && (
          <div className="mb-4 space-y-3">
            <div className={`p-3 rounded-xl border ${failedCount === 0 ? 'bg-emerald-500/10 border-emerald-500/25' : successCount === 0 ? 'bg-red-500/10 border-red-500/25' : 'bg-amber-500/10 border-amber-500/25'}`}>
              <div className="flex items-center gap-2 mb-1">
                {failedCount === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <p className="text-xs font-semibold text-white">
                  {failedCount === 0 ? 'Import completed successfully' : 'Import completed with errors'}
                </p>
              </div>
              <p className="text-xs text-slate-300">
                {successCount} success / {failedCount} failed (total {totalRows})
              </p>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-slate-800/50 text-center">
                <p className="text-lg font-bold text-white">{totalRows}</p>
                <p className="text-[10px] text-slate-500">Total</p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-center">
                <p className="text-lg font-bold text-emerald-400">{successCount}</p>
                <p className="text-[10px] text-slate-500">Success</p>
              </div>
              <div className="p-2.5 rounded-lg bg-red-500/10 text-center">
                <p className="text-lg font-bold text-red-400">{failedCount}</p>
                <p className="text-[10px] text-slate-500">Failed</p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">Import distribution</span>
                <span className="text-[10px] text-slate-400">{successRate}% success</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden flex">
                <div className="h-full bg-emerald-500" style={{ width: `${successRate}%` }} />
                <div className="h-full bg-red-500" style={{ width: `${100 - successRate}%` }} />
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 max-h-28 overflow-y-auto">
                <p className="text-[10px] font-semibold text-red-400 mb-1">First errors:</p>
                <div className="space-y-1">
                  {result.errors.slice(0, 3).map((e, idx) => (
                    <p key={`${e.row}-${e.field}-${idx}`} className="text-[10px] text-slate-300">
                      Row {e.row} - {e.field}: {e.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">{result ? 'Close' : 'Cancel'}</button>
          {!result && <button onClick={handleImport} disabled={!file || importCSV.isPending} className="btn-primary flex-1">{importCSV.isPending ? 'Importing…' : 'Import'}</button>}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCSVModal, setShowCSVModal] = useState(false)
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [classFilter, setClassFilter] = useState<ClassLevel | undefined>()
  const [page, setPage] = useState(1)

  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    if (urlSearch && urlSearch !== search) setSearch(urlSearch)
  }, [searchParams])

  const { data, isLoading } = useStudents({ classLevel: classFilter, page, limit: 100 })
  const deleteStudent = useDeleteStudent()

  if (isLoading) return <LoadingPage />

  const allStudents = data?.students ?? []
  const pagination = data?.pagination

  const students = search.trim()
    ? allStudents.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase())
      )
    : allStudents

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteStudent.mutateAsync(deleteTarget._id)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Students" subtitle={`${pagination?.total ?? 0} students enrolled`}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCSVModal(true)} className="btn-ghost flex items-center gap-2 text-teal-400 border-teal-500/20 hover:bg-teal-500/10">
              <FileSpreadsheet className="w-4 h-4" /> Import CSV
            </button>
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Student
            </button>
          </div>
        }
      />

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setClassFilter(undefined); setPage(1) }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${!classFilter ? 'bg-amber-500 text-white' : 'btn-ghost'}`}>
          All Classes
        </button>
        {CLASS_LEVELS.map(cl => (
          <button key={cl} onClick={() => { setClassFilter(cl); setPage(1) }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${classFilter === cl ? 'bg-amber-500 text-white' : 'btn-ghost'}`}>
            {CLASS_LEVEL_LABELS[cl]}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/[0.05] flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="input-dark pl-9 text-xs" placeholder="Search students by name or code…" />
          </div>
          <span className="text-xs text-slate-500">{students.length} shown</span>
        </div>

        {students.length === 0
          ? <EmptyState icon={Users} title="No students found" description={search ? `No results for "${search}"` : "Add your first student."} />
          : (
          <div className="overflow-x-auto">
            <table className="w-full table-dark">
              <thead><tr><th>Student</th><th>Code</th><th>Class</th><th>Status</th><th>Joined</th><th className="text-right w-24">Actions</th></tr></thead>
              <tbody>
                {students.map((s, i) => (
                  <motion.tr key={s._id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-grad-quiz flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">{s.name[0]}</div>
                        <span className="font-medium text-white">{s.name}</span>
                      </div>
                    </td>
                    <td><code className="text-xs text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded">{s.code}</code></td>
                    <td><span className="badge-sky">{CLASS_LEVEL_LABELS[s.classLevel] ?? s.classLevel}</span></td>
                    <td><StatusBadge status={s.isActive ? 'active' : 'inactive'} /></td>
                    <td className="text-slate-500 text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="w-24 pr-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => setEditStudent(s)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-amber-400 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(s)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/[0.05]">
            <span className="text-xs text-slate-500">Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && <AddStudentModal onClose={() => setShowAddModal(false)} />}
        {showCSVModal && <ImportCSVModal onClose={() => setShowCSVModal(false)} />}
        {editStudent && <EditStudentModal student={editStudent} onClose={() => setEditStudent(null)} />}
        {deleteTarget && <DeleteConfirmModal student={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} isPending={deleteStudent.isPending} />}
      </AnimatePresence>
    </div>
  )
}