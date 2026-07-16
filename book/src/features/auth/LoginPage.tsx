import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from './AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Loader2, Sparkles } from 'lucide-react'

const loginSchema = z.object({
    email: z.string().min(1, '이메일을 입력해주세요.').email('올바른 이메일 형식이 아닙니다.'),
    password: z.string().min(1, '비밀번호를 입력해주세요.'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
    const { session } = useAuth()
    const navigate = useNavigate()
    const [error, setError] = useState<string | null>(null)
    const [showEmailForm, setShowEmailForm] = useState(false)

    useEffect(() => {
        if (session) {
            navigate('/portal', { replace: true })
        }
    }, [session, navigate])

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    })

    const onLoginSubmit = async (data: LoginForm) => {
        setError(null)

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: data.email.trim(),
                password: data.password,
            })

            if (authError) {
                console.error(authError)
                if (authError.message.includes('Invalid login credentials')) {
                    setError('이메일 또는 비밀번호가 올바르지 않습니다.')
                } else {
                    setError('로그인 중 문제가 발생했습니다. 관리자에게 문의해주세요.')
                }
            } else {
                navigate('/portal', { replace: true })
            }
        } catch (err) {
            console.error('Login exception:', err)
            setError('알 수 없는 오류가 발생했습니다.')
        }
    }

    const handleGoogleLogin = async () => {
        setError(null)
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
        } catch (err: any) {
            setError('구글 로그인 연동 에러: ' + err.message)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100">
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-black text-slate-900 font-roboto italic tracking-tighter leading-none [-webkit-text-stroke:2px_black]">THEPT#</h1>
                    <p className="text-slate-500 text-sm mt-3 font-semibold">스케줄 예약 & AI 임상차팅 솔루션</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-xs p-4 rounded-2xl mb-6 border border-red-100 font-bold flex items-center gap-2">
                        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-current stroke-2 shrink-0"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" strokeLinecap="round" /><path d="M12 16h.01" strokeLinecap="round" /></svg>
                        <span>{error}</span>
                    </div>
                )}

                {/* 구글 소셜 로그인 전면 배치 */}
                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 py-4 px-4 rounded-2xl font-bold transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-3 text-base cursor-pointer"
                    >
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Google 계정으로 로그인</span>
                    </button>

                    <div className="relative my-6 flex items-center justify-center">
                        <div className="border-t border-slate-200 w-full"></div>
                        <span className="bg-white px-3 text-xs text-slate-400 font-bold uppercase whitespace-nowrap absolute">또는</span>
                    </div>

                    {!showEmailForm ? (
                        <button
                            type="button"
                            onClick={() => setShowEmailForm(true)}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer"
                        >
                            이메일 계정으로 로그인
                        </button>
                    ) : (
                        <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">이메일 주소</label>
                                <input
                                    {...register('email')}
                                    type="email"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm"
                                    placeholder="example@clinic.com"
                                    autoComplete="email"
                                />
                                {errors.email && (
                                    <p className="text-red-500 text-xs mt-1 font-bold">{errors.email.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">비밀번호</label>
                                <input
                                    {...register('password')}
                                    type="password"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm"
                                    placeholder="비밀번호 입력"
                                    autoComplete="current-password"
                                />
                                {errors.password && (
                                    <p className="text-red-500 text-xs mt-1 font-bold">{errors.password.message}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer"
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> 로그인 처리 중...</>
                                ) : (
                                    '로그인'
                                )}
                            </button>
                        </form>
                    )}
                </div>

                {/* 스태프 접속 안내 카드 */}
                <div className="mt-8 p-4 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 font-medium leading-relaxed">
                        <strong className="font-bold block mb-0.5 text-blue-900">치료사 스태프 접속 안내</strong>
                        스태프 분들은 별도 로그인 필요 없이 원장님이 공유해주신 <strong>스태프 전용 딥링크</strong>를 클릭하여 바로 접속하실 수 있습니다.
                    </p>
                </div>
            </div>
        </div>
    )
}
