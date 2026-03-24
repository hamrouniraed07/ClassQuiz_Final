import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Pencil, Trash2, Users, X, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import { useStudents, useCreateStudent, useDeleteStudent } from '@/hooks/useApi'
import { StatCard, LoadingPage, EmptyState, StatusBadge, PageHeader } from '@/components/shared'
import type { Student } from '@/types'

const CLASS_LABELS = ['', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6']

function AddStudentModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', code: '', class: 1 })
  const [error, setError] = useState('')
  const create = useCreateStudent()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await create.mutateAsync(form)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create student')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="glass-card w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Add New Student</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-dark" placeholder="Ahmed Ben Ali" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Student Code</label>
            <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="input-dark font-mono" placeholder="STU-2024-001" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Class</label>
            <select value={form.class} onChange={e => setForm({ ...form, class: parseInt(e.target.value) })}
              className="input-dark">
              {[1,2,3,4,5,6].map(c => <option key={c} value={c}>{CLASS_LABELS[c]}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">
              {create.isPending ? 'Creating…' : 'Add Student'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default function StudentsPage() {
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<number | undefined>()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useStudents({ search: search || undefined, class: classFilter, page, limit: 20 })
  const deleteStudent = useDeleteStudent()

  if (isLoading) return <LoadingPage />

  const students = data?.students ?? []
  const pagination = data?.pagination

  return (
    <div className="space-y-5">
      <PageHeader
        title="Students"
        subtitle={`${pagination?.total ?? 0} students enrolled`}
        action={
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Student
          </button>
        }
      />

      {/* Class filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setClassFilter(undefined); setPage(1) }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${!classFilter ? 'bg-amber-500 text-white' : 'btn-ghost'}`}>
          All Classes
        </button>
        {[1,2,3,4,5,6].map(c => (
          <button key={c} onClick={() => { setClassFilter(c); setPage(1) }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${classFilter === c ? 'bg-amber-500 text-white' : 'btn-ghost'}`}>
            Grade {c}
          </button>
        ))}
      </div>

      {/* Search + Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/[0.05] flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="input-dark pl-9 text-xs" placeholder="Search students by name…" />
          </div>
          <span className="text-xs text-slate-500">{students.length} shown</span>
        </div>

        {students.length === 0
          ? <EmptyState icon={Users} title="No students found" description="Add your first student or adjust filters." />
          : (
          <div className="overflow-x-auto">
            <table className="w-full table-dark">
              <thead>
                <tr><th>Student</th><th>Code</th><th>Class</th><th>Status</th><th>Joined</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <motion.tr key={s._id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-grad-quiz flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                          {s.name[0]}
                        </div>
                        <span className="font-medium text-white">{s.name}</span>
                      </div>
                    </td>
                    <td><code className="text-xs text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded">{s.code}</code></td>
                    <td><span className="badge-sky">{CLASS_LABELS[s.class]}</span></td>
                    <td><StatusBadge status={s.isActive ? 'active' : 'archived'} /></td>
                    <td className="text-slate-500 text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteStudent.mutate(s._id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/15 text-slate-400 hover:text-red-400 transition-colors">
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

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/[0.05]">
            <p className="text-xs text-slate-500">Page {page} of {pagination.pages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                className="p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && <AddStudentModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </div>
  )
}
