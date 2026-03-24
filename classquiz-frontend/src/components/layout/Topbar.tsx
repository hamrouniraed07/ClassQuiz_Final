import { useLocation } from 'react-router-dom'
import { Bell, Search } from 'lucide-react'
import { useValidationStats } from '@/hooks/useApi'
import { motion } from 'framer-motion'

const routeLabels: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':  { title: 'Dashboard',       subtitle: 'Overview of your platform' },
  '/students':   { title: 'Students',        subtitle: 'Manage student records' },
  '/exams':      { title: 'Exams',           subtitle: 'Create and manage exams' },
  '/batch':      { title: 'Batch Upload',    subtitle: 'Upload multiple student exams' },
  '/validation': { title: 'Validation',      subtitle: 'Review low-confidence OCR results' },
  '/reports':    { title: 'Reports',         subtitle: 'Performance analytics' },
}

export default function Topbar() {
  const { pathname } = useLocation()
  const basePath = '/' + pathname.split('/')[1]
  const meta = routeLabels[basePath] ?? { title: 'ClassQuiz', subtitle: '' }
  const { data: stats } = useValidationStats()

  return (
    <header className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.05] bg-navy-900/80 backdrop-blur-sm">
      <div className="flex-1">
        <motion.h1
          key={pathname}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-bold text-white leading-none"
        >
          {meta.title}
        </motion.h1>
        <p className="text-xs text-slate-500 mt-0.5">{meta.subtitle}</p>
      </div>

      {/* Search */}
      <div className="relative hidden md:flex items-center">
        <Search className="absolute left-3 w-3.5 h-3.5 text-slate-500" />
        <input
          placeholder="Quick search…"
          className="input-dark pl-9 w-52 text-xs py-2"
        />
      </div>

      {/* Notifications */}
      <button className="relative p-2 rounded-xl hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors">
        <Bell className="w-4.5 h-4.5" size={18} />
        {stats?.pending && stats.pending > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
        )}
      </button>

      {/* Date */}
      <div className="hidden lg:block text-right">
        <p className="text-xs text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</p>
        <p className="text-xs font-semibold text-white">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>
    </header>
  )
}
