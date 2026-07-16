import { useState, useEffect, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext } from './AuthContext'
import type { GuestStatus } from './AuthContext'
import type { Profile } from '@/types/db'

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [guestStatus, setGuestStatus] = useState<GuestStatus>('approved')
    const [ownerId, setOwnerId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = useCallback(async (userId: string, userEmail?: string) => {
        try {
            // 1. Fetch base profile from DB safely (400 예방)
            const { data: profileData } = await supabase
                .from('profiles')
                .select('id, email, full_name, role, system_id')
                .eq('id', userId)
                .maybeSingle()

            const computedName = profileData?.full_name || userEmail?.split('@')[0] || '치료사'

            const combinedProfile: Profile = {
                id: userId,
                email: userEmail || '',
                full_name: computedName,
                role: profileData?.role || 'THERAPIST',
                system_id: profileData?.system_id || null,
            }

            // 2. Fetch system details if system_id exists
            if (combinedProfile.system_id) {
                try {
                    const { data: systemData } = await supabase
                        .from('systems')
                        .select('owner_id, organization_name, contact_number, manager_name, option1_name, option2_name, option3_name')
                        .eq('id', combinedProfile.system_id)
                        .maybeSingle()

                    if (systemData) {
                        combinedProfile.is_owner = systemData.owner_id === userId
                        combinedProfile.organization_name = systemData.organization_name || undefined
                        combinedProfile.contact_number = systemData.contact_number || undefined
                        combinedProfile.manager_name = systemData.manager_name || undefined
                    }
                } catch { /* 시스템 테이블 미비 시 안전 무시 */ }
            } else {
                combinedProfile.is_owner = true // 디폴트 소유자 권한 부여
            }

            setProfile(combinedProfile)
        } catch (error) {
            console.error('[AuthProvider] 에러:', error)
        }
    }, [])

    useEffect(() => {
        let isMounted = true

        const initAuth = async () => {
            const hash = window.location.hash
            let currentSession: Session | null = null

            // 1. URL Hash에서 access_token / refresh_token 동기화 (SSO)
            if (hash && hash.includes('access_token=')) {
                const params = new URLSearchParams(hash.substring(1))
                const accessToken = params.get('access_token')
                const refreshToken = params.get('refresh_token')

                if (accessToken && refreshToken) {
                    try {
                        const { data, error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        })
                        if (!error && data.session) {
                            currentSession = data.session
                            window.history.replaceState(null, document.title, window.location.pathname + window.location.search)
                        }
                    } catch (e) {
                        console.error('SSO setSession Error:', e)
                    }
                }
            }

            // 2. Hash 토큰으로 세션을 세팅하지 못한 경우 기존 저장 세션 조회
            if (!currentSession) {
                const { data } = await supabase.auth.getSession()
                currentSession = data.session
            }

            if (!isMounted) return

            setSession(currentSession)
            setUser(currentSession?.user ?? null)

            if (currentSession?.user) {
                setOwnerId(currentSession.user.id)
                await fetchProfile(currentSession.user.id, currentSession.user.email)
            } else {
                setProfile(null)
                setOwnerId(null)
            }

            setLoading(false)
        }

        initAuth()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                setOwnerId(session.user.id)
                fetchProfile(session.user.id, session.user.email).finally(() => setLoading(false))
            } else {
                setProfile(null)
                setOwnerId(null)
                setLoading(false)
            }
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [fetchProfile])

    const value = {
        session,
        user,
        profile,
        guestStatus,
        ownerId,
        loading,
        refreshProfile: async () => {
            if (user) await fetchProfile(user.id, user.email)
        },
        signOut: async () => {
            await supabase.auth.signOut()
        },
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
