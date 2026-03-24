import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { Download, FileText, TrendingUp, Users, Award, ChevronDown, BarChart3 } from 'lucide-react'
import { useExams, useExamReport, useGenerateReport, useDownloadReport, useStudentExams } from '@/hooks/useApi'
import { LoadingPage, PageHeader, StatCard, SectionCard, GradeBadge, EmptyState } from '@/components/shared'
import type { Exam } from '@/types'

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981', B: '#0ea5e9', C: '#f59e0b', D: '#f97316', F: '#ef4444'
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs border border-white/[0.08]">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill || p.stroke }} className="font-semibold">
          {p.name}: {p.value}{typeof p.value === 'number' && p.value <= 100 && p.name?.includes('Score') ? '%' : ''}
        </p>
      ))}
    </div>
  )
}

// ── Exam Selector ─────────────────────────────────────────────────────────────
function ExamSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const { data } = useExams({ status: 'active' })
  const selected = data?.exams.find(e => e._id === value)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-navy-800/60 border border-white/[0.08] text-sm text-white hover:border-white/[0.15] transition-all"
      >
        <FileText className="w-4 h-4 text-amber-400" />
        <span>{selected ? selected.title : 'Select Exam'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 z-10 glass-card min-w-[260px] py-1 shadow-glass-lg border border-white/[0.08]">
          {data?.exams.map(exam => (
            <button key={exam._id} onClick={() => { onChange(exam._id); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-xs hover:bg-white/[0.05] transition-colors ${value === exam._id ? 'text-amber-400' : 'text-slate-300'}`}>
              <p className="font-semibold">{exam.title}</p>
              <p className="text-slate-500">{exam.subject} · Grade {exam.class}</p>
            </button>
          ))}
          {!data?.exams.length && <p className="px-4 py-3 text-xs text-slate-500">No active exams</p>}
        </div>
      )}
    </div>
  )
}

// ── Student Performance Row ───────────────────────────────────────────────────
function StudentRow({ se, index, onDownload }: { se: any; index: number; onDownload: (id: string) => void }) {
  const [generating, setGenerating] = useState(false)
  const generateReport = useGenerateReport()

  const handleGenerate = async () => {
    setGenerating(true)
    await generateReport.mutateAsync(se._id)
    setGenerating(false)
  }

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <td>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${GRADE_COLORS[se.grade] ?? '#64748b'}30, ${GRADE_COLORS[se.grade] ?? '#64748b'}15)` }}>
            {se.student.name?.[0] ?? '?'}
          </div>
          <div>
            <p className="text-xs font-semibold text-white">{se.student.name}</p>
            <p className="text-[10px] text-slate-500">{se.student.code}</p>
          </div>
        </div>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-navy-950 rounded-full overflow-hidden w-20">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: GRADE_COLORS[se.grade] ?? '#64748b' }}
              initial={{ width: 0 }}
              animate={{ width: `${se.percentage ?? 0}%` }}
              transition={{ delay: index * 0.04 + 0.3, duration: 0.6 }}
            />
          </div>
          <span className="text-xs font-bold" style={{ color: GRADE_COLORS[se.grade] ?? '#64748b' }}>
            {se.percentage?.toFixed(1)}%
          </span>
        </div>
      </td>
      <td className="font-semibold text-white text-xs">{se.totalScore} / {se.maxPossibleScore}</td>
      <td><GradeBadge grade={se.grade} /></td>
      <td>
        <div className="flex items-center gap-1">
          {se.reportPath ? (
            <button onClick={() => onDownload(se._id)}
              className="p-1.5 rounded-lg hover:bg-teal-500/15 text-slate-400 hover:text-teal-400 transition-colors">
              <Download className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={handleGenerate} disabled={generating}
              className="p-1.5 rounded-lg hover:bg-amber-500/15 text-slate-400 hover:text-amber-400 transition-colors">
              <FileText className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  )
}

// ── Main Reports Page ─────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [examId, setExamId] = useState('')
  const { data: reportData, isLoading: reportLoading } = useExamReport(examId)
  const { data: studentExamsData } = useStudentExams({ examId: examId || undefined, status: 'evaluated', limit: 50 })
  const downloadReport = useDownloadReport()

  const studentExams = studentExamsData?.studentExams ?? []
  const summary = reportData?.summary
  const exam = reportData?.exam

  // Build chart data
  const scoreCompareData = studentExams.slice(0, 12).map(se => ({
    name: typeof se.student === 'object' ? se.student.name.split(' ')[0] : '?',
    score: se.percentage ?? 0,
    classAvg: summary?.averagePercentage ?? 0,
  }))

  const gradeDistData = summary ? Object.entries(summary.gradeDistribution).map(([grade, count]) => ({
    name: `Grade ${grade}`, value: count as number, color: GRADE_COLORS[grade] ?? '#64748b'
  })) : []

  const mistakeData = [
    { subject: 'Q1', correct: 85, partial: 10, wrong: 5 },
    { subject: 'Q2', correct: 60, partial: 25, wrong: 15 },
    { subject: 'Q3', correct: 70, partial: 20, wrong: 10 },
    { subject: 'Q4', correct: 45, partial: 30, wrong: 25 },
    { subject: 'Q5', correct: 80, partial: 12, wrong: 8 },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Detailed performance insights per exam"
        action={<ExamSelector value={examId} onChange={setExamId} />}
      />

      {!examId ? (
        <EmptyState
          icon={BarChart3}
          title="Select an exam to view reports"
          description="Choose an active exam from the dropdown above to see detailed performance analytics."
        />
      ) : reportLoading ? (
        <LoadingPage />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          {/* Summary stat cards */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Students Graded" value={summary.totalStudents} icon={Users} gradient="quiz" delay={0} />
              <StatCard title="Class Average" value={`${summary.averagePercentage.toFixed(1)}%`} icon={TrendingUp} gradient="class" delay={0.05}
                delta={{ value: `${summary.passRate}% pass`, positive: summary.passRate >= 50 }} />
              <StatCard title="Highest Score" value={`${summary.highestScore.toFixed(1)}%`} icon={Award} gradient="teal" delay={0.1} />
              <StatCard title="Lowest Score" value={`${summary.lowestScore.toFixed(1)}%`} icon={TrendingUp} gradient="red" delay={0.15} />
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Score comparison */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
              <SectionCard title="Student Scores vs Class Average">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={scoreCompareData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="score" name="Student Score" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="classAvg" name="Class Avg" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={28} opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </motion.div>

            {/* Grade distribution pie */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <SectionCard title="Grade Distribution">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={gradeDistData} dataKey="value" cx="50%" cy="45%" innerRadius={52} outerRadius={78} paddingAngle={3}>
                      {gradeDistData.map(entry => <Cell key={entry.name} fill={entry.color} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={(v) => <span className="text-xs text-slate-400">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </SectionCard>
            </motion.div>
          </div>

          {/* Per-question breakdown stacked bar */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <SectionCard title="Per-Question Performance Breakdown">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mistakeData} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="subject" type="category" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="correct" name="Correct %" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="partial" name="Partial %" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="wrong" name="Wrong %" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </motion.div>

          {/* Student table */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <SectionCard
              title={`Student Results — ${exam?.title ?? ''}`}
              action={
                <span className="text-xs text-slate-400">
                  {studentExams.length} students evaluated
                </span>
              }
            >
              {studentExams.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No evaluated exams for this exam yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-dark">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Score</th>
                        <th>Raw</th>
                        <th>Grade</th>
                        <th>Report</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentExams
                        .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
                        .map((se, i) => (
                          <StudentRow
                            key={se._id}
                            se={se}
                            index={i}
                            onDownload={(id) => downloadReport.mutate(id)}
                          />
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
