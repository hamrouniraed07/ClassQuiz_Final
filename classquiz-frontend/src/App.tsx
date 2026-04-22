import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import StudentsPage from '@/pages/students/StudentsPage'
import ExamsPage from '@/pages/exams/ExamsPage'
import CreateExamPage from '@/pages/exams/CreateExamPage'
import ExamDetailPage from '@/pages/exams/ExamDetailPage'
import BatchUploadPage from '@/pages/batch/BatchUploadPage'
import ValidationPage from '@/pages/validation/ValidationPage'
import ReportsPage from '@/pages/reports/ReportsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"  element={<DashboardPage />} />
              <Route path="/students"   element={<StudentsPage />} />
              <Route path="/exams"      element={<ExamsPage />} />
              <Route path="/exams/create" element={<CreateExamPage />} />
              <Route path="/exams/:id"  element={<ExamDetailPage />} />
              <Route path="/batch"      element={<BatchUploadPage />} />
              <Route path="/validation" element={<ValidationPage />} />
              <Route path="/reports"    element={<ReportsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}