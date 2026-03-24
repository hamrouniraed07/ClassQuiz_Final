import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, Eye, EyeOff, ArrowRight, Loader2, BookOpen, Users, BarChart3 } from 'lucide-react'
import { useLogin } from '@/hooks/useApi'
import { useAuthStore } from '@/store/authStore'

const features = [
  { icon: BookOpen, label: 'AI-Powered OCR', desc: 'Gemini 2.0 reads handwritten answers' },
  { icon: Users,    label: 'Batch Processing', desc: 'Grade entire classes at once' },
  { icon: BarChart3,label: 'Instant Reports', desc: 'Detailed performance analytics' },
]

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const login = useLogin()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const data = await login.mutateAsync({ username, password })
      setAuth(data.token, data.user)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials')
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Left: Branding Panel */}
      <motion.div
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="hidden lg:flex flex-col justify-between w-[52%] relative bg-navy-950 p-12 overflow-hidden"
      >
        {/* Mesh background */}
        <div className="absolute inset-0 bg-mesh-dark opacity-70" />
        {/* Gradient orbs */}
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-teal-500/5 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 mb-16"
          >
            <div className="w-12 h-12 rounded-2xl bg-grad-brand flex items-center justify-center shadow-glow-amber">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold">
                <span className="text-grad-class">Class</span>
                <span className="text-grad-quiz">Quiz</span>
              </span>
              <p className="text-xs text-slate-500">EdTech Platform</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              AI-Powered Exam<br />
              <span className="text-grad-brand">Grading Platform</span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed max-w-sm">
              Upload, process, and grade student exams automatically with Gemini Vision OCR and GPT-4o evaluation.
            </p>
          </motion.div>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-3">
          {features.map(({ icon: Icon, label, desc }, i) => (
            <motion.div
              key={label}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-grad-brand flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className={`h-1 rounded-full ${i === 0 ? 'w-6 bg-amber-400' : 'w-2 bg-white/20'}`} />
            ))}
          </div>
          <p className="text-xs text-slate-500 ml-2">Grades 1–6 • Primary Education</p>
        </div>
      </motion.div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-navy-900">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-grad-brand flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              <span className="text-grad-class">Class</span><span className="text-grad-quiz">Quiz</span>
            </span>
          </div>

          <div className="glass-card p-8">
            <div className="mb-7">
              <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
              <p className="text-sm text-slate-400">Sign in to your admin account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username</label>
                <input
                  value={username} onChange={e => setUsername(e.target.value)}
                  className="input-dark" placeholder="admin"
                  autoComplete="username" required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="input-dark pr-10" placeholder="••••••••"
                    autoComplete="current-password" required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="submit" disabled={login.isPending}
                className="w-full btn-primary flex items-center justify-center gap-2 mt-2"
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              >
                {login.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                  : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>
                }
              </motion.button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-600 mt-5">
            ClassQuiz © {new Date().getFullYear()} • EdTech Platform
          </p>
        </motion.div>
      </div>
    </div>
  )
}
