import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(date))
}

export function getGradeColor(grade?: string) {
  const map: Record<string, string> = {
    A: 'text-emerald-400', B: 'text-sky-400',
    C: 'text-amber-400', D: 'text-orange-400', F: 'text-red-400'
  }
  return map[grade ?? ''] ?? 'text-slate-400'
}

export function getConfidenceClass(score: number) {
  if (score >= 70) return 'confidence-high'
  if (score >= 50) return 'confidence-mid'
  return 'confidence-low'
}

export function getStatusBadge(status: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    uploaded:           { label: 'Uploaded',    cls: 'badge-sky'   },
    ocr_processing:     { label: 'OCR…',        cls: 'badge-amber' },
    ocr_done:           { label: 'OCR Done',    cls: 'badge-teal'  },
    validation_pending: { label: 'Needs Review',cls: 'badge-red'   },
    validated:          { label: 'Validated',   cls: 'badge-teal'  },
    evaluating:         { label: 'Grading…',    cls: 'badge-amber' },
    evaluated:          { label: 'Graded',      cls: 'badge-green' },
    report_ready:       { label: 'Report Ready',cls: 'badge-green' },
    failed:             { label: 'Failed',      cls: 'badge-red'   },
    active:             { label: 'Active',      cls: 'badge-green' },
    draft:              { label: 'Draft',       cls: 'badge-sky'   },
    processing:         { label: 'Processing',  cls: 'badge-amber' },
    archived:           { label: 'Archived',    cls: 'badge-amber' },
    pending:            { label: 'Pending',     cls: 'badge-red'   },
    completed:          { label: 'Completed',   cls: 'badge-green' },
    skipped:            { label: 'Skipped',     cls: 'badge-sky'   },
  }
  return map[status] ?? { label: status, cls: 'badge-sky' }
}
