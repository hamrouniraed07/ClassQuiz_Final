# ClassQuiz Frontend

Production-ready React + TypeScript frontend for the ClassQuiz EdTech platform.

## Tech Stack

| Tool | Purpose |
|---|---|
| Vite + React 18 | Build toolchain & UI framework |
| TypeScript | Type safety |
| Tailwind CSS | Utility-first styling |
| Framer Motion | Page transitions & micro-interactions |
| TanStack Query v5 | Server state management & caching |
| Zustand | Client auth state |
| Recharts | Performance charts & analytics |
| react-dropzone | Drag-and-drop file upload |
| Axios | HTTP client with JWT interceptors |

## Design System

```
Primary palette:
  Yellow→Orange  (#f59e0b → #f97316)   "Class" brand
  Blue→Teal      (#0ea5e9 → #14b8a6)   "Quiz" brand

Base:
  Background     #0f172a  (navy-900)
  Cards          rgba(30,41,59,0.6) + backdrop-blur-xl
  Border         rgba(255,255,255,0.06)

Typography:
  Display/UI     Plus Jakarta Sans
  Arabic RTL     Tajawal
  Code           JetBrains Mono
```

## Pages

| Route | Page |
|---|---|
| `/login` | Glass split-screen login |
| `/dashboard` | Stats, charts, activity feed |
| `/students` | Table, search, add/edit/delete |
| `/exams` | Card grid, upload modal with OCR trigger |
| `/batch` | 4-step wizard: exam→images→map→process |
| `/validation` | Subject cards → split image+OCR review |
| `/reports` | Bar/pie/stacked charts, PDF export |

## Quick Start

```bash
# Install
npm install

# Dev (requires backend on :3000)
npm run dev

# Build
npm run build

# Preview production build
npm run preview
```

## Docker

```bash
# Build image
docker build -t classquiz-frontend .

# Run (connects to backend network)
docker run -p 80:80 classquiz-frontend
```

## Key Patterns

### API Hooks (TanStack Query)
```ts
// All hooks live in src/hooks/useApi.ts
const { data, isLoading } = useStudents({ class: 3, page: 1 })
const create = useCreateStudent()
await create.mutateAsync({ name, code, class: 3 })
```

### Auth Flow
```ts
// Zustand store with localStorage persistence
const { setAuth, logout, isAuthenticated } = useAuthStore()
// JWT auto-attached to all Axios requests via interceptor
```

### Animation Pattern
```tsx
// Staggered list reveals
{items.map((item, i) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.05 }}
  />
))}
```

### Glass Card Pattern
```tsx
<div className="glass-card p-5"> ... </div>        // static
<div className="glass-card-hover p-5"> ... </div>  // hover lift
```
