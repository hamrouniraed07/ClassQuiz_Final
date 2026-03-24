import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Tajawal', 'system-ui', 'sans-serif'],
        arabic: ['Tajawal', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Brand — Yellow→Orange (Class)
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        orange: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        // Brand — Blue→Teal (Quiz)
        sky: {
          400: '#38bdf8',
          500: '#0ea5e9',
        },
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6',
        },
        // Dark base palette
        navy: {
          950: '#020917',
          900: '#0f172a',
          850: '#111827',
          800: '#1e293b',
          750: '#1f2d40',
          700: '#243447',
          600: '#2d4060',
          500: '#334155',
        },
        // Semantic
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      backgroundImage: {
        // Core brand gradients
        'grad-class': 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)',
        'grad-quiz': 'linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)',
        'grad-brand': 'linear-gradient(135deg, #f59e0b 0%, #f97316 40%, #0ea5e9 70%, #14b8a6 100%)',
        // Card backgrounds
        'glass-card': 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)',
        // Mesh background
        'mesh-dark': 'radial-gradient(at 20% 25%, #1e3a5f 0px, transparent 50%), radial-gradient(at 80% 10%, #1a1a2e 0px, transparent 50%), radial-gradient(at 50% 80%, #0f2040 0px, transparent 50%)',
        // Sidebar
        'sidebar-grad': 'linear-gradient(180deg, #0a1628 0%, #0f172a 100%)',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glass-lg': '0 8px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.07)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.3)',
        'glow-sky': '0 0 20px rgba(14, 165, 233, 0.3)',
        'glow-teal': '0 0 20px rgba(20, 184, 166, 0.3)',
        'card-hover': '0 12px 40px rgba(0,0,0,0.5)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.1)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'slide-in-left': 'slideInLeft 0.3s ease forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInLeft: { from: { opacity: '0', transform: 'translateX(-16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(245,158,11,0.2)' },
          '50%': { boxShadow: '0 0 25px rgba(245,158,11,0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [animate],
}

export default config
