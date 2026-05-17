import { motion } from 'framer-motion'
import { useState } from 'react'
import {
  Users, FileText, AlertTriangle, Award, CheckCircle,
  Eye, Download, TrendingUp, BookOpen, Star, Clock,
  ChevronRight, Zap, BarChart2
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts'
import { useDashboard, useStudentExams, useValidations, useDownloadReport, usePreviewReport } from '@/hooks/useApi'
import { StatusBadge } from '@/components/shared'
import { formatDate } from '@/lib/utils'

// ── Static chart data ─────────────────────────────────────────────────────────
const gradeData = [
  { grade: '1ère', avg: 68, count: 24 },
  { grade: '2ème', avg: 74, count: 31 },
  { grade: '3ème', avg: 71, count: 28 },
  { grade: '4ème', avg: 79, count: 22 },
  { grade: '5ème', avg: 65, count: 19 },
  { grade: '6ème', avg: 82, count: 26 },
]

const weekData = [
  { day: 'Lun', copies: 12 },
  { day: 'Mar', copies: 19 },
  { day: 'Mer', copies: 8 },
  { day: 'Jeu', copies: 24 },
  { day: 'Ven', copies: 17 },
  { day: 'Sam', copies: 5 },
]

const pieData = [
  { name: 'Correct',      value: 52, color: '#10b981' },
  { name: 'Partiel',      value: 22, color: '#f59e0b' },
  { name: 'Conceptuel',   value: 14, color: '#ef4444' },
  { name: 'Calcul',       value:  8, color: '#f97316' },
  { name: 'Incomplet',    value:  4, color: '#8b5cf6' },
]

// ── Tooltip ───────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(15,23,42,0.95)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '8px 14px',
      fontSize: 12,
    }}>
      <p style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color || '#14b8a6', fontWeight: 700 }}>
          {p.name}: {p.value}{p.dataKey === 'avg' ? '%' : ''}
        </p>
      ))}
    </div>
  )
}

// ── Mini stat card ─────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, color, delay
}: {
  label: string; value: string | number; sub: string
  icon: any; color: string; delay: number
}) {
  const colors: Record<string, { bg: string; text: string; ring: string }> = {
    teal:   { bg: 'rgba(20,184,166,0.12)', text: '#14b8a6', ring: 'rgba(20,184,166,0.3)' },
    amber:  { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', ring: 'rgba(245,158,11,0.3)' },
    red:    { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', ring: 'rgba(239,68,68,0.3)' },
    violet: { bg: 'rgba(139,92,246,0.12)', text: '#8b5cf6', ring: 'rgba(139,92,246,0.3)' },
  }
  const c = colors[color]
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: '20px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${c.text}, transparent)`,
        opacity: 0.6,
      }} />
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: c.bg,
        border: `1px solid ${c.ring}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={22} color={c.text} />
      </div>
      <div>
        <p style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>
          {value}
        </p>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 600, letterSpacing: '0.04em' }}>
          {label}
        </p>
        <p style={{ fontSize: 10, color: c.text, marginTop: 2 }}>{sub}</p>
      </div>
    </motion.div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Panel({ title, children, action, delay = 0 }: {
  title: string; children: React.ReactNode; action?: React.ReactNode; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 18,
        padding: '20px 22px',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.02em' }}>{title}</p>
        {action}
      </div>
      {children}
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboard()
  const { data: recentExams }      = useStudentExams({ page: 1, limit: 5 })
  const { data: pendingVal }       = useValidations({ status: 'pending', page: 1, limit: 4 })
  const downloadReport             = useDownloadReport()
  const previewReport              = usePreviewReport()

  // Progress bar helper
  const avg = stats?.avgScore ?? 0
  const pass = stats?.passRate ?? 0

  return (
    <div style={{ fontFamily: "'Sora', 'DM Sans', sans-serif" }}>
      {/* ── Inject Google Fonts ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        .dash-table { width: 100%; border-collapse: collapse; }
        .dash-table th {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
          color: #475569; font-weight: 700; padding: 0 8px 10px;
          text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .dash-table td {
          font-size: 12px; color: #94a3b8; padding: 10px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          vertical-align: middle;
        }
        .dash-table tr:last-child td { border-bottom: none; }
        .dash-table tr:hover td { background: rgba(255,255,255,0.02); }
        .prog-bar {
          height: 6px; border-radius: 99px;
          background: rgba(255,255,255,0.06); overflow: hidden;
        }
        .prog-fill {
          height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, #0ea5e9, #14b8a6);
          transition: width 1s ease;
        }
      `}</style>

      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 28 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 11, color: '#14b8a6', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              ✦ Tableau de bord
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>
              Vue d'ensemble
            </h1>
          </div>
          {/* Live indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)',
            borderRadius: 99, padding: '6px 14px',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#14b8a6',
              animation: 'pulse 2s infinite',
              display: 'inline-block',
            }} />
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
            <span style={{ fontSize: 11, color: '#14b8a6', fontWeight: 700 }}>Données en direct</span>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        <KpiCard label="Étudiants inscrits" value={stats?.totalStudents ?? 0}    sub="Toutes classes confondues" icon={Users}         color="teal"   delay={0} />
        <KpiCard label="Examens traités"    value={stats?.totalExams ?? 0}        sub="Ce semestre"               icon={BookOpen}      color="violet" delay={0.05} />
        <KpiCard label="En attente"         value={stats?.pendingValidations ?? 0} sub="Validation manuelle OCR"  icon={AlertTriangle} color="red"    delay={0.1} />
        <KpiCard label="Score moyen"        value={`${avg}%`}                     sub={`Taux de réussite : ${pass}%`} icon={Award}    color="amber"  delay={0.15} />
      </div>

      {/* ── Score + Progress summary ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        style={{
          background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(20,184,166,0.06) 100%)',
          border: '1px solid rgba(20,184,166,0.15)',
          borderRadius: 18,
          padding: '18px 24px',
          marginBottom: 22,
          display: 'flex',
          alignItems: 'center',
          gap: 40,
        }}
      >
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Score moyen global
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: '#14b8a6', fontFamily: "'DM Mono', monospace" }}>
              {avg}<span style={{ fontSize: 18, color: '#475569' }}>%</span>
            </span>
            <div style={{ flex: 1 }}>
              <div className="prog-bar">
                <div className="prog-fill" style={{ width: `${avg}%` }} />
              </div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#475569' }}>
            Basé sur {stats?.totalExams ?? 0} examens corrigés automatiquement par l'IA
          </p>
        </div>

        <div style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.06)' }} />

        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Taux de réussite
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: '#f59e0b', fontFamily: "'DM Mono', monospace" }}>
              {pass}<span style={{ fontSize: 18, color: '#475569' }}>%</span>
            </span>
            <div style={{ flex: 1 }}>
              <div className="prog-bar">
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: 'linear-gradient(90deg, #f59e0b, #f97316)',
                  width: `${pass}%`, transition: 'width 1s ease',
                }} />
              </div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#475569' }}>
            Note de passage fixée à 50%
          </p>
        </div>

        <div style={{ width: 1, height: 60, background: 'rgba(255,255,255,0.06)' }} />

        <div style={{ textAlign: 'center', minWidth: 100 }}>
          <p style={{ fontSize: 11, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Validations OCR
          </p>
          <p style={{ fontSize: 36, fontWeight: 800, color: '#ef4444', fontFamily: "'DM Mono', monospace" }}>
            {stats?.pendingValidations ?? 0}
          </p>
          <p style={{ fontSize: 10, color: '#475569' }}>réponses à vérifier</p>
        </div>
      </motion.div>



      {/* ── Area chart ── */}
      <div style={{ marginBottom: 22 }}>
        <Panel title="Copies traitées cette semaine" delay={0.28}>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={weekData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="copies" name="Copies" stroke="#14b8a6" strokeWidth={2.5}
                fill="url(#areaG)" dot={{ fill: '#14b8a6', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* ── Bottom row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Recent exams table */}
        <Panel title="Examens récents"
          action={<span style={{ fontSize: 10, color: '#14b8a6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
            Voir tout <ChevronRight size={12} />
          </span>}
          delay={0.32}
        >
          <table className="dash-table">
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Matière</th>
                <th>Score</th>
                <th>Statut</th>
                <th>Rapport</th>
              </tr>
            </thead>
            <tbody>
              {recentExams?.studentExams?.slice(0, 5).map(se => (
                <tr key={se._id}>
                  <td style={{ color: '#e2e8f0', fontWeight: 600 }}>
                    {se?.student && typeof se.student === 'object' ? se.student.name : '—'}
                  </td>
                  <td>{se?.exam && typeof se.exam === 'object' ? se.exam.subject : '—'}</td>
                  <td>
                    {se.percentage != null ? (
                      <span style={{
                        color: se.percentage >= 50 ? '#10b981' : '#ef4444',
                        fontWeight: 700, fontFamily: "'DM Mono', monospace", fontSize: 13,
                      }}>
                        {se.percentage}%
                      </span>
                    ) : '—'}
                  </td>
                  <td><StatusBadge status={se.status} /></td>
                  <td>
                    {se.reportPath ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => previewReport.mutate(se._id)}
                          style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: '#0ea5e9', display: 'flex', alignItems: 'center' }}>
                          <Eye size={13} />
                        </button>
                        <button onClick={() => downloadReport.mutate(se._id)}
                          style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: '#14b8a6', display: 'flex', alignItems: 'center' }}>
                          <Download size={13} />
                        </button>
                      </div>
                    ) : <span style={{ color: '#334155' }}>—</span>}
                  </td>
                </tr>
              ))}
              {!recentExams?.studentExams?.length && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '28px 0', color: '#334155' }}>
                  Aucun examen pour le moment
                </td></tr>
              )}
            </tbody>
          </table>
        </Panel>

        {/* Pending validations */}
        <Panel
          title="Validations en attente"
          action={
            <span style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 99, padding: '2px 10px', fontSize: 11, color: '#ef4444', fontWeight: 700,
            }}>
              {pendingVal?.pagination.total ?? 0} en attente
            </span>
          }
          delay={0.35}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingVal?.validations?.slice(0, 4).map((v, i) => (
              <motion.div
                key={v._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(239,68,68,0.1)',
                  borderRadius: 12,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(239,68,68,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <AlertTriangle size={16} color="#ef4444" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {v?.student?.name || 'Étudiant inconnu'}
                  </p>
                  <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    {v?.exam?.subject || 'Matière inconnue'} · {v?.flaggedAnswers?.length ?? 0} réponse(s) à vérifier
                  </p>
                </div>
                <p style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>{formatDate(v.createdAt)}</p>
              </motion.div>
            ))}
            {!pendingVal?.validations?.length && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, color: '#10b981', fontWeight: 700 }}>Tout est validé !</p>
                <p style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>Aucune réponse en attente de vérification</p>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}