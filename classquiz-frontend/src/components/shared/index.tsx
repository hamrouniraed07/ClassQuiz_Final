import { motion } from 'framer-motion'
import { LucideIcon, Loader2 } from 'lucide-react'
import { cn, getStatusBadge } from '@/lib/utils'

// ── Stat Card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string; value: string | number; subtitle?: string
  icon: LucideIcon; gradient?: 'class' | 'quiz' | 'teal' | 'red'
  delta?: { value: string; positive: boolean }
  delay?: number
}
export function StatCard({ title, value, subtitle, icon: Icon, gradient = 'class', delta, delay = 0 }: StatCardProps) {
  const gradMap = {
    class: 'from-amber-500/20 to-orange-500/10 border-amber-500/20',
    quiz:  'from-sky-500/20 to-teal-500/10 border-sky-500/20',
    teal:  'from-teal-500/20 to-emerald-500/10 border-teal-500/20',
    red:   'from-red-500/20 to-orange-600/10 border-red-500/20',
  }
  const iconMap = {
    class: 'bg-amber-500/20 text-amber-400',
    quiz:  'bg-sky-500/20 text-sky-400',
    teal:  'bg-teal-500/20 text-teal-400',
    red:   'bg-red-500/20 text-red-400',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn('stat-card bg-gradient-to-br border', gradMap[gradient])}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-xl', iconMap[gradient])}>
          <Icon className="w-5 h-5" />
        </div>
        {delta && (
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
            delta.positive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
          )}>
            {delta.positive ? '↑' : '↓'} {delta.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </motion.div>
  )
}

// ── Page Header ───────────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string; subtitle?: string
  action?: React.ReactNode
}
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const { label, cls } = getStatusBadge(status)
  return <span className={cls}>{label}</span>
}

// ── Loading Spinner ───────────────────────────────────────────────────────────
export function LoadingSpinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  return <Loader2 className={cn('animate-spin text-amber-400', s[size], className)} />
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: LucideIcon; title: string; description?: string; action?: React.ReactNode
}
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-white/[0.05] flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-500" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-sm mb-5">{description}</p>}
      {action}
    </motion.div>
  )
}

// ── Confidence Badge ──────────────────────────────────────────────────────────
export function ConfidenceBadge({ score }: { score: number }) {
  const cls = score >= 70 ? 'badge-green' : score >= 50 ? 'badge-amber' : 'badge-red'
  return <span className={cls}>{score.toFixed(0)}%</span>
}

// ── Grade Badge ───────────────────────────────────────────────────────────────
export function GradeBadge({ grade }: { grade?: string }) {
  const map: Record<string, string> = {
    A: 'badge-green', B: 'badge-sky', C: 'badge-amber', D: 'badge-red', F: 'badge-red'
  }
  return <span className={map[grade ?? ''] ?? 'badge-sky'}>{grade ?? 'N/A'}</span>
}

// ── Section Card ──────────────────────────────────────────────────────────────
export function SectionCard({ title, children, className, action }: {
  title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode
}) {
  return (
    <div className={cn('glass-card p-5', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
