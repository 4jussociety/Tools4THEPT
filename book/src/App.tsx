import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import RequireAuth from './components/layout/RequireAuth'
import RequireOwner from './features/auth/RequireOwner'
import CalendarPage from './features/calendar/CalendarPage'
import ClientList from './features/clients/ClientList'
import StatisticsPage from './features/statistics/StatisticsPage'
import MemberManagement from './features/admin/MemberManagementPage'
import ProfilePage from './features/profile/ProfilePage'
import CenterSettingsPage from './features/admin/CenterSettingsPage'
import SuperAdminPage from './features/admin/SuperAdminPage'
import ChartingPage from './features/charting/ChartingPage'
import PortalPage from './features/auth/PortalPage'

import RootLayout from './components/layout/RootLayout'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* 통합 로그인 & 서비스 선택 메인 포털 */}
            <Route path="/portal" element={<PortalPage />} />
            <Route path="/login" element={<PortalPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<RootLayout />}>
                <Route path="/" element={<Navigate to="/calendar" replace />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/clients" element={<ClientList />} />
                <Route path="/charting" element={<ChartingPage />} />
                <Route path="/profile" element={<ProfilePage />} />

                {/* 매니저 전용 라우트 */}
                <Route element={<RequireOwner />}>
                  <Route path="/statistics" element={<StatisticsPage />} />
                  <Route path="/members" element={<MemberManagement />} />
                  <Route path="/settings" element={<CenterSettingsPage />} />
                </Route>
              </Route>
            </Route>

            {/* Super Admin 전용 */}
            <Route element={<RequireAuth />}>
              <Route path="/super-admin" element={<SuperAdminPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
