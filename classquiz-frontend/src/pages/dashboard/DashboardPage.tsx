import { motion } from 'framer-motion'
import { Users, FileText, AlertTriangle, CheckCircle, TrendingUp, Award, Eye, Download } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import { useDashboard, useStudentExams, useValidations, useDownloadReport, usePreviewReport } from '@/hooks/useApi'
import { StatCard, LoadingPage, SectionCard } from '@/components/shared'
import { StatusBadge } from '@/components/shared'
import { formatDate } from '@/lib/utils'

const scoreData = [
  { class: 'Gr. 1', avg: 68 }, { class: 'Gr. 2', avg: 74 }, { class: 'Gr. 3', avg: 71 },
  { class: 'Gr. 4', avg: 79 }, { class: 'Gr. 5', avg: 65 }, { class: 'Gr. 6', avg: 82 },
]
const weeklyData = [
  { day: 'Mon', exams: 12 }, { day: 'Tue', exams: 19 }, { day: 'Wed', exams: 8 },
  { day: 'Thu', exams: 24 }, { day: 'Fri', exams: 17 }, { day: 'Sat', exams: 5 },
]
const mistakeData = [
  { name: 'Correct', value: 52, color: '#10b981' },
  { name: 'Partial', value: 22, color: '#f59e0b' },
  { name: 'Conceptual', value: 14, color: '#ef4444' },
  { name: 'Calculation', value: 8, color: '#f97316' },
  { name: 'Incomplete', value: 4, color: '#8b5cf6' },
]

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboard()
  const { data: recentExams } = useStudentExams({ page: 1, limit: 5 })
  const { data: pendingValidations } = useValidations({ status: 'pending', page: 1, limit: 4 })
  const downloadReport = useDownloadReport()
  const previewReport = usePreviewReport()

  if (isLoading) return <LoadingPage />

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={stats?.totalStudents ?? 0} icon={Users} gradient="quiz" delay={0} delta={{ value: '12 new', positive: true }} subtitle="All classes" />
        <StatCard title="Active Exams" value={stats?.totalExams ?? 0} icon={FileText} gradient="class" delay={0.05} subtitle="This semester" />
        <StatCard title="Pending Reviews" value={stats?.pendingValidations ?? 0} icon={AlertTriangle} gradient="red" delay={0.1} subtitle="Low confidence OCR" />
        <StatCard title="Avg Score" value={`${stats?.avgScore ?? 0}%`} icon={Award} gradient="teal" delay={0.15} delta={{ value: '3.2%', positive: true }} subtitle={`Pass rate: ${stats?.passRate ?? 0}%`} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <SectionCard title="Average Score by Grade">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="class" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="avg" name="Avg Score" radius={[6, 6, 0, 0]}
                  fill="url(#barGrad)" />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </motion.div>

        {/* Pie chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <SectionCard title="Mistake Distribution">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={mistakeData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                  {mistakeData.map((entry) => <Cell key={entry.name} fill={entry.color} strokeWidth={0} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={(v) => <span className="text-xs text-slate-400">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>
        </motion.div>
      </div>

      {/* Weekly activity */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <SectionCard title="Exams Processed This Week">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
              <Line type="monotone" dataKey="exams" name="Exams" stroke="url(#lineGrad)" strokeWidth={2.5} dot={{ fill: '#14b8a6', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </motion.div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <SectionCard title="Recent Exams">
            <table className="w-full table-dark">
              <thead><tr><th>Student</th><th>Exam</th><th>Score</th><th>Status</th><th>Report</th></tr></thead>
              <tbody>
                {recentExams?.studentExams.slice(0, 5).map(se => (
                  <tr key={se._id}>
                    <td>{typeof se.student === 'object' ? se.student.name : '—'}</td>
                    <td className="text-slate-400">{typeof se.exam === 'object' ? se.exam.subject : '—'}</td>
                    <td className="font-semibold text-white">{se.percentage != null ? `${se.percentage}%` : '—'}</td>
                    <td><StatusBadge status={se.status} /></td>
                    <td>
                      {se.reportPath ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => previewReport.mutate(se._id)}
                            title="Open pedagogical report"
                            className="p-1.5 rounded-lg hover:bg-sky-500/15 text-slate-400 hover:text-sky-400 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => downloadReport.mutate(se._id)}
                            title="Download report"
                            className="p-1.5 rounded-lg hover:bg-teal-500/15 text-slate-400 hover:text-teal-400 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!recentExams?.studentExams.length && (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-6">No exams yet</td></tr>
                )}
              </tbody>
            </table>
          </SectionCard>
        </motion.div>

        {/* Pending validations */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <SectionCard title="Pending Validations"
            action={<span className="badge-red">{pendingValidations?.pagination.total ?? 0} pending</span>}
          >
            <div className="space-y-2">
              {pendingValidations?.validations.slice(0, 4).map(v => (
                <div key={v._id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{v.student.name}</p>
                    <p className="text-xs text-slate-500">{v.exam.subject} · {v.flaggedAnswers.length} answers flagged</p>
                  </div>
                  <p className="text-xs text-slate-500">{formatDate(v.createdAt)}</p>
                </div>
              ))}
              {!pendingValidations?.validations.length && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">All validations complete!</p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </motion.div>
      </div>
    </div>
  )
}
