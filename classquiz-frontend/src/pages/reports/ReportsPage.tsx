import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { Download, Eye, FileText, TrendingUp, Users, Award, ChevronDown, BarChart3 } from 'lucide-react'
import { useExams, useExamReport, useGenerateReport, useDownloadReport, usePreviewReport } from '@/hooks/useApi'
import { LoadingPage, PageHeader, StatCard, SectionCard, GradeBadge, EmptyState } from '@/components/shared'
import { CLASS_LEVEL_LABELS, SUBJECT_META } from '@/constants/domain'
import type { Subject } from '@/constants/domain'
import type { ReportStudentExam } from '@/types'

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
          {data?.exams.map(exam => {
            const meta = SUBJECT_META[exam.subject as Subject]
            return (
              <button key={exam._id} onClick={() => { onChange(exam._id); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 text-xs hover:bg-white/[0.05] transition-colors ${value === exam._id ? 'text-amber-400' : 'text-slate-300'}`}>
                <p className="font-semibold">{exam.title}</p>
                <p className="text-slate-500">
                  {meta ? `${meta.emoji} ${meta.en}` : exam.subject} · {CLASS_LEVEL_LABELS[exam.classLevel] ?? exam.classLevel}
                </p>
              </button>
            )
          })}
          {!data?.exams.length && <p className="px-4 py-3 text-xs text-slate-500">No active exams</p>}
        </div>
      )}
    </div>
  )
}

// ── Student Performance Row ───────────────────────────────────────────────────
function StudentRow({ se, index, onPreview, onDownload, onGenerated }: { se: ReportStudentExam; index: number; onPreview: (id: string) => void; onDownload: (id: string) => void; onGenerated: () => void }) {
  const [generating, setGenerating] = useState(false)
  const generateReport = useGenerateReport()
  const gradeColor = (se.grade && GRADE_COLORS[se.grade]) ? GRADE_COLORS[se.grade] : '#64748b'

  const handleGenerate = async () => {
    setGenerating(true)
    await generateReport.mutateAsync(se._id)
    onGenerated()
    onPreview(se._id)
    setGenerating(false)
  }

  const noteOn20 = ((se.percentage ?? 0) / 100) * 20

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <td>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${gradeColor}30, ${gradeColor}15)` }}>
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
              style={{ backgroundColor: gradeColor }}
              initial={{ width: 0 }}
              animate={{ width: `${se.percentage ?? 0}%` }}
              transition={{ delay: index * 0.04 + 0.3, duration: 0.6 }}
            />
          </div>
          <span className="text-xs font-bold" style={{ color: gradeColor }}>
            {se.percentage?.toFixed(1)}%
          </span>
        </div>
      </td>
      <td className="font-semibold text-white text-xs">{se.totalScore} / {se.maxPossibleScore}</td>
      <td className="font-semibold text-white text-xs">{noteOn20.toFixed(2)} / 20</td>
      <td><GradeBadge grade={se.grade} /></td>
      <td>
        <div className="flex items-center gap-1">
          {se.reportPath ? (
            <>
              <button
                onClick={() => onPreview(se._id)}
                title="Open pedagogical report"
                className="p-1.5 rounded-lg hover:bg-sky-500/15 text-slate-400 hover:text-sky-400 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDownload(se._id)}
                title="Download report"
                className="p-1.5 rounded-lg hover:bg-teal-500/15 text-slate-400 hover:text-teal-400 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button onClick={handleGenerate} disabled={generating}
              title={generating ? 'Generating report...' : 'Generate and open report'}
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
  const { data: reportData, isLoading: reportLoading, refetch: refetchReport } = useExamReport(examId)
  const downloadReport = useDownloadReport()
  const previewReport = usePreviewReport()

  const studentExams = reportData?.students ?? []
  const summary = reportData?.summary
  const exam = reportData?.exam

  // Build chart data
  const scoreCompareData = studentExams.slice(0, 12).map((se: ReportStudentExam) => ({
    name: se.student.name.split(' ')[0] || '?',
    score: se.percentage ?? 0,
    classAvg: summary?.averagePercentage ?? 0,
  }))

  const gradeDistData = summary ? Object.entries(summary.gradeDistribution).map(([grade, count]) => ({
    name: grade, value: count as number, color: GRADE_COLORS[grade] ?? '#64748b'
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

      {!examId
        ? <EmptyState icon={BarChart3} title="Select an Exam" description="Choose an exam from the dropdown to view detailed analytics and student performance." />
        : reportLoading
          ? <LoadingPage />
          : (
        <>
          {/* Stat cards */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title="Students" value={summary.totalStudents} icon={Users} />
              <StatCard title="Avg Score" value={`${summary.averagePercentage?.toFixed(1)}%`} icon={TrendingUp} />
              <StatCard title="Pass Rate" value={`${summary.passRate}%`} icon={Award} />
              <StatCard title="Highest" value={`${summary.highestScore?.toFixed(1)}%`} icon={Award} />
            </div>
          )}

          {/* Charts */}
          {scoreCompareData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Score Comparison">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreCompareData} barGap={3}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="score" name="Student Score" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="classAvg" name="Class Average" fill="#0ea5e9" radius={[4, 4, 0, 0]} opacity={0.5} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              
            </div>
          )}

          {/* Student results table */}
          {studentExams.length > 0 && (
            <SectionCard title="Student Results">
              <div className="overflow-x-auto">
                <table className="w-full table-dark">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Performance</th>
                      <th>Score</th>
                      <th>Note (/20)</th>
                      <th>Grade</th>
                      <th>Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentExams.map((se: ReportStudentExam, i: number) => (
                      <StudentRow
                        key={se._id}
                        se={se}
                        index={i}
                        onPreview={(id) => previewReport.mutate(id)}
                        onDownload={(id) => downloadReport.mutate(id)}
                        onGenerated={() => { void refetchReport() }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  )
}