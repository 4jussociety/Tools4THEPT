import { useAuth } from '@/features/auth/AuthContext'
import { Navigate, Outlet } from 'react-router-dom'
import AccessPendingScreen from '@/features/auth/AccessPendingScreen'

export default function RequireAuth() {
    const { session, guestStatus, loading } = useAuth()

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
