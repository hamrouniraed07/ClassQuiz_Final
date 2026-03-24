import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, FileText, Upload, CheckSquare,
  BarChart3, LogOut, ChevronRight, GraduationCap, Menu, X
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useValidationStats } from '@/hooks/useApi'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/dashboard',   label: 'Dashboard',        icon: LayoutDashboard },
  { to: '/students',    label: 'Students',          icon: Users           },
  { to: '/exams',       label: 'Exams',             icon: FileText        },
  { to: '/batch',       label: 'Batch Upload',      icon: Upload          },
  { to: '/validation',  label: 'Validation',        icon: CheckSquare,    badge: true },
  { to: '/reports',     label: 'Reports',           icon: BarChart3       },
]

interface SidebarProps { collapsed: boolean; setCollapsed: (v: boolean) => void }

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()
  const { data: stats } = useValidationStats()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative flex flex-col h-full bg-sidebar-grad border-r border-white/[0.05] overflow-hidden"
    >
      {/* Top glow accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-grad-brand opacity-40" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.05]">
        <motion.div
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-grad-brand flex items-center justify-center shadow-glow-amber"
          whileHover={{ scale: 1.05 }}
        >
          <GraduationCap className="w-5 h-5 text-white" />
        </motion.div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <span className="font-display font-bold text-base leading-none">
                <span className="text-grad-class">Class</span>
                <span className="text-grad-quiz">Quiz</span>
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">EdTech Platform</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('ml-auto p-1.5 rounded-lg hover:bg-white/[0.07] text-slate-400 hover:text-white transition-colors', collapsed && 'ml-0')}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {nav.map(({ to, label, icon: Icon, badge }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <motion.div
                className={cn('sidebar-item', isActive && 'active')}
                whileHover={{ x: collapsed ? 0 : 3 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className="relative flex-shrink-0">
                  <Icon className={cn('w-4.5 h-4.5', isActive ? 'text-amber-400' : '')} size={18} />
                  {badge && stats?.pending && stats.pending > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {stats.pending > 9 ? '9+' : stats.pending}
                    </span>
                  )}
                </div>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="truncate"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {!collapsed && isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400"
                  />
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-white/[0.05]">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-xl bg-white/[0.04]"
            >
              <div className="w-7 h-7 rounded-lg bg-grad-class flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">{user?.username?.[0]?.toUpperCase()}</span>
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{user?.username}</p>
                <p className="text-[10px] text-slate-500 capitalize">{user?.role}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={handleLogout} className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
          <LogOut size={18} />
          <AnimatePresence>
            {!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Logout</motion.span>}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}
