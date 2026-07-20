import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Mic, LogOut, User, Sparkles, UserPlus, LogIn, CheckCircle2, AlertCircle } from 'lucide-react'

export function PortalPage() {
    const { session } = useAuth()
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const handleNavigateDashboard = () => {
        const dashboardBase = `${window.location.origin}/dashboard`;
        if (session?.access_token && session?.refresh_token) {
            const dashboardUrl = `${dashboardBase}#access_token=${session.access_token}&refresh_token=${session.refresh_token}`
            window.location.href = dashboardUrl
        } else {
            window.location.href = dashboardBase
        }
    }

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)

        if (!email || !password) {
            setMessage({ type: 'error', text: '이메일과 비밀번호를 모두 입력해 주세요.' })
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            })
            if (error) throw error
            navigate('/portal', { replace: true })
        } catch (error: any) {
            const errorMsg = error.message === 'Invalid login credentials'
                ? '이메일 또는 비밀번호가 올바르지 않습니다.'
                : error.message
            setMessage({ type: 'error', text: '로그인 실패: ' + errorMsg })
        } finally {
            setLoading(false)
        }
    }

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)

        if (!email || !password || !confirmPassword) {
            setMessage({ type: 'error', text: '모든 항목을 입력해 주세요.' })
            return
        }

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: '비밀번호와 비밀번호 확인이 일치하지 않습니다.' })
            return
        }

        if (password.length < 6) {
            setMessage({ type: 'error', text: '비밀번호는 최소 6자리 이상이어야 합니다.' })
            return
        }

        setLoading(true)
        try {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
            })
            if (error) throw error

            if (data.session) {
                setMessage({ type: 'success', text: '회원가입이 완료되었습니다! 서비스를 선택해주세요.' })
                navigate('/portal', { replace: true })
            } else {
                setMessage({ type: 'success', text: '가입 확인 이메일이 발송되었습니다. 이메일을 확인해 주세요!' })
                setAuthMode('login')
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: '회원가입 실패: ' + error.message })
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setMessage(null)

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/portal',
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'select_account',
                    },
                },
            })
            if (error) throw error
        } catch (error: any) {
            setMessage({ type: 'error', text: '구글 로그인 연동 실패: ' + error.message })
        }
    }

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut()
            setMessage(null)
            navigate('/portal', { replace: true })
        } catch (err) {
            console.error('로그아웃 실패:', err)
        }
    }

    const userEmail = session?.user?.email || ''

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden text-slate-800 font-sans p-4">
            {/* 백그라운드 오라 */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-100/50 opacity-70 blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full bg-indigo-100/50 opacity-70 blur-[120px] pointer-events-none"></div>

            {session ? (
                /* ======== 로그인 완료 상태: 서비스 이동 포털 게이트웨이 ======== */
                <div className="relative z-10 w-full max-w-2xl p-6 md:p-10 bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50 flex flex-col items-center">
                    <div className="flex flex-col items-center mb-6">
                        <h1 className="text-4xl font-black text-slate-900 font-roboto italic tracking-tighter leading-none [-webkit-text-stroke:2px_black]">4THEPT</h1>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200 rounded-full text-sm font-semibold mb-8 text-slate-600">
                        <User size={16} className="text-blue-500" />
                        <span>{userEmail} 강사님 환영합니다!</span>
                    </div>

                    <h2 className="text-lg md:text-xl font-bold text-slate-600 mb-6 text-center">
                        이동하실 서비스를 선택해 주세요
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-8">
                        {/* 서비스 카드 1: 재활/레슨실 상황판 */}
                        <button
                            onClick={handleNavigateDashboard}
                            className="flex flex-col text-left p-6 bg-white hover:bg-blue-50/30 border border-slate-200 hover:border-blue-500/50 rounded-2xl transition-all duration-300 group hover:-translate-y-1 shadow-md hover:shadow-blue-500/10 cursor-pointer"
                        >
                            <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <LayoutDashboard size={24} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">재활/레슨실 상황판</h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                실시간 베드 현황 모니터링, 재활세션 관리 및 구역별 배정 상태를 직관적인 도면 레이아웃으로 제어합니다.
                            </p>
                        </button>

                        {/* 서비스 카드 2: 스케줄 및 AI 임상 차팅 */}
                        <button
                            onClick={() => { navigate('/calendar'); }}
                            className="flex flex-col text-left p-6 bg-white hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-500/50 rounded-2xl transition-all duration-300 group hover:-translate-y-1 shadow-md hover:shadow-indigo-500/10 cursor-pointer"
                        >
                            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Mic size={24} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">스케줄 & AI 임상 차팅</h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                고객과의 대화 음성을 인식(STT)하여 SOAP 임상 노트 및 도수재활세션 기록지를 1화면에서 자동 생성합니다.
                            </p>
                        </button>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    >
                        <LogOut size={14} /> 로그아웃
                    </button>
                </div>
            ) : (
                /* ======== 미로그인 상태: 로그인/회원가입 통합 게이트웨이 ======== */
                <div className="relative z-10 w-full max-w-md p-8 bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50 flex flex-col items-center">

                    <div className="flex flex-col items-center mb-6">
                        <h1 className="text-4xl font-black text-slate-900 font-roboto italic tracking-tighter leading-none [-webkit-text-stroke:2px_black]">4THEPT</h1>
                    </div>

                    {/* 로그인 / 회원가입 탭 */}
                    <div className="flex w-full bg-slate-100 p-1.5 rounded-2xl mb-6">
                        <button
                            type="button"
                            onClick={() => { setAuthMode('login'); setMessage(null); }}
                            className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${authMode === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            <LogIn size={15} /> 로그인
                        </button>
                        <button
                            type="button"
                            onClick={() => { setAuthMode('signup'); setMessage(null); }}
                            className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${authMode === 'signup' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            <UserPlus size={15} /> 회원가입
                        </button>
                    </div>

                    <p className="text-xs font-semibold text-slate-500 mb-6 text-center leading-normal">
                        {authMode === 'login'
                            ? '하나의 계정으로 상황판과 AI 임상 차팅을 모두 이용하세요'
                            : '새로운 이메일 계정으로 4THEPT 서비스를 시작하세요'}
                    </p>

                    {/* 알림 메시지 */}
                    {message && (
                        <div className={`w-full p-3.5 rounded-xl text-xs font-bold mb-4 flex items-center gap-2 border ${message.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            }`}>
                            {message.type === 'error' ? <AlertCircle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}
                            <span>{message.text}</span>
                        </div>
                    )}

                    {/* 로그인 폼 */}
                    {authMode === 'login' ? (
                        <form onSubmit={handleEmailLogin} className="w-full flex flex-col gap-3.5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">이메일 주소</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="example@naver.com"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">비밀번호</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm hover:scale-[1.01] transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-2 shadow-blue-600/10 cursor-pointer"
                            >
                                {loading ? '로그인 중...' : '로그인'}
                            </button>
                        </form>
                    ) : (
                        /* 회원가입 폼 */
                        <form onSubmit={handleEmailSignUp} className="w-full flex flex-col gap-3.5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">이메일 주소</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="example@naver.com"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">비밀번호 설정</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="6자리 이상 비밀번호 입력"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 mb-1.5 uppercase tracking-wider">비밀번호 재확인</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="비밀번호 다시 입력"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-sm hover:scale-[1.01] transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
                            >
                                {loading ? '가입 처리 중...' : '회원가입 완료'}
                            </button>
                        </form>
                    )}

                    {/* 구분선 */}
                    <div className="w-full flex items-center my-6 gap-3">
                        <div className="flex-1 h-px bg-slate-200"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">또는</span>
                        <div className="flex-1 h-px bg-slate-200"></div>
                    </div>

                    {/* 구글 소셜 로그인 버튼 */}
                    <div className="w-full">
                        <button
                            onClick={handleGoogleLogin}
                            className="w-full relative flex items-center justify-center gap-2.5 px-5 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm hover:scale-[1.01] transition-all active:scale-95 cursor-pointer"
                        >
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                            </svg>
                            Google 계정으로 간편 로그인
                        </button>
                    </div>

                    {/* 스태프 접속 안내 카드 */}
                    <div className="w-full mt-6 p-4 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-800 font-medium leading-relaxed">
                            <strong className="font-bold block mb-0.5 text-blue-900">강사 스태프 접속 안내</strong>
                            강사/스태프 분들은 원장님이 공유해주신 <strong>스태프 전용 딥링크</strong>를 클릭하시면 로그인 없이 바로 들어오실 수 있습니다.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
export default PortalPage
