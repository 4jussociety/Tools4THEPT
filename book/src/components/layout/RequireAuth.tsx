import { useAuth } from '@/features/auth/AuthContext'
import { Navigate, Outlet } from 'react-router-dom'
import AccessPendingScreen from '@/features/auth/AccessPendingScreen'

export default function RequireAuth() {
    const { session, guestStatus, isStaffMode, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (isStaffMode) {
        return <Outlet />
    }

    if (!session) {
        window.location.href = 'http://localhost:5174/login';
        return null;
    }

    // 승인 대기 또는 거절된 경우
    if (guestStatus === 'pending' || guestStatus === 'rejected') {
        return <AccessPendingScreen />
    }

    return <Outlet />
}
