import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { detectInAppWebView, getOS, getAndroidIntentUrl, getKakaoExternalUrl } from '../lib/utils/userAgent';
import { LayoutDashboard, Mic, LogOut, User, Sparkles, UserPlus, LogIn, CheckCircle2, AlertCircle, ArrowLeft, BarChart3, ShieldCheck, Zap, Globe, Copy, Check, ExternalLink, Compass } from 'lucide-react';
import { ThePtLogo } from './ThePtLogo';

interface PortalProps {
  initialView?: 'landing' | 'auth';
}

export function Portal({ initialView }: PortalProps) {
  const [session, setSession] = useState<any>(null);
  const [portalMode, setPortalMode] = useState<'landing' | 'auth'>(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (initialView) return initialView;
    if (path === '/login' || path === '/login/' || hash === '#auth' || hash === '#login') return 'auth';
    return 'landing';
  });

  // Auth form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // WebView & Device OS
  const [isWebView, setIsWebView] = useState(false);
  const [showWebViewGuide, setShowWebViewGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const [os, setOs] = useState({ isAndroid: false, isIOS: false });

  useEffect(() => {
    setIsWebView(detectInAppWebView());
    setOs(getOS());

    // Token Sync via URL Hash
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ data, error }) => {
          if (!error && data.session) {
            setSession(data.session);
            window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
          }
        });
      }
    }

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email || !password) {
      setMessage({ type: 'error', text: '이메일과 비밀번호를 모두 입력해 주세요.' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setSession(data.session);
    } catch (error: any) {
      const errorMsg = error.message === 'Invalid login credentials'
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : error.message;
      setMessage({ type: 'error', text: '로그인 실패: ' + errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email || !password || !confirmPassword) {
      setMessage({ type: 'error', text: '모든 항목을 입력해 주세요.' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: '비밀번호와 비밀번호 확인이 일치하지 않습니다.' });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: '비밀번호는 최소 6자리 이상이어야 합니다.' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      if (data.session) {
        setSession(data.session);
        setMessage({ type: 'success', text: '회원가입이 완료되었습니다! 서비스를 선택해주세요.' });
      } else {
        setMessage({ type: 'success', text: '가입 확인 이메일이 발송되었습니다. 이메일을 확인해 주세요!' });
        setAuthTab('login');
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: '회원가입 실패: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isWebView) {
      setShowWebViewGuide(true);
      return;
    }
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/',
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      setMessage({ type: 'error', text: '구글 로그인 연동 실패: ' + error.message });
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setMessage(null);
    } catch (err) {
      console.error('로그아웃 실패:', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('링크 복사에 실패했습니다. 직접 복사해 주세요.');
    }
  };

  const userEmail = session?.user?.email || '';
  const isKakao = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('kakaotalk');

  return (
    <div className="min-h-screen w-full bg-slate-50 relative overflow-x-hidden text-slate-800 font-sans flex flex-col justify-between">
      {/* 백그라운드 프리미엄 블러 오라 */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-100/50 opacity-70 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full bg-indigo-100/50 opacity-70 blur-[120px] pointer-events-none"></div>

      {/* 상단 통합 헤더 (네비게이션) */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPortalMode('landing')}>
          <ThePtLogo className="text-slate-900" />
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-600 hidden sm:inline">{userEmail} 님</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer"
              >
                <LogOut size={14} /> 로그아웃
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setPortalMode('auth'); setAuthTab('login'); setMessage(null); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-blue-600 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <LogIn size={14} /> 로그인
              </button>
              <button
                onClick={() => { setPortalMode('auth'); setAuthTab('signup'); setMessage(null); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <UserPlus size={14} /> 회원가입
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 md:p-6 my-2">
        {session ? (
          /* ==================== 1. 로그인 성공 상태: 서비스 이동 포털 게이트웨이 ==================== */
          <div className="w-full max-w-2xl p-6 md:p-10 bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full text-xs font-black mb-6 text-blue-700 shadow-inner">
              <User size={15} className="text-blue-600" />
              <span>{userEmail} 계정 인증됨</span>
            </div>

            <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-2 text-center tracking-tight">
              이동하실 솔루션을 선택해 주세요
            </h2>
            <p className="text-xs font-semibold text-slate-500 mb-8 text-center">
              통합계정 하나로 모든 서비스를 손쉽게 오갈 수 있습니다.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-6">
              {/* 서비스 1: 물리치료실 상황판 */}
              <button
                onClick={() => { window.location.href = '/app'; }}
                className="flex flex-col text-left p-6 bg-white hover:bg-blue-50/40 border-2 border-slate-200 hover:border-blue-500 rounded-2xl transition-all duration-300 group hover:-translate-y-1 shadow-md hover:shadow-blue-500/10 cursor-pointer"
              >
                <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <LayoutDashboard size={24} />
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-1.5 group-hover:text-blue-600 transition-colors">물리치료실 상황판 바로가기</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  베드 현황 실시간 관제, 치료 타이머 및 도면 레이아웃 기반 터치/드래그 이송 조작을 제어합니다.
                </p>
              </button>

              {/* 서비스 2: 스케줄 및 AI 임상 차팅 */}
              <button
                onClick={() => {
                  const hostname = window.location.hostname;
                  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.');
                  const calendarBase = isLocal 
                    ? `${window.location.protocol}//${hostname}:5174/book/calendar` 
                    : `${window.location.origin}/book/calendar`;
                  if (session?.access_token && session?.refresh_token) {
                    window.location.href = `${calendarBase}#access_token=${session.access_token}&refresh_token=${session.refresh_token}`;
                  } else {
                    window.location.href = calendarBase;
                  }
                }}
                className="flex flex-col text-left p-6 bg-white hover:bg-indigo-50/40 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl transition-all duration-300 group hover:-translate-y-1 shadow-md hover:shadow-indigo-500/10 cursor-pointer"
              >
                <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Mic size={24} />
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-1.5 group-hover:text-indigo-600 transition-colors">스케줄 & AI 임상 차팅</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  고객과의 대화 음성을 인식(STT)하여 SOAP 노트 및 도수치료 시행 기록지를 자동 생성합니다.
                </p>
              </button>
            </div>

            {/* 스태프 링크 생성 섹션 */}
            <div className="w-full border-t border-slate-100 pt-6">
              <p className="text-xs font-black text-slate-500 mb-3 text-center uppercase tracking-wider">스태프 접속 링크 생성</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/dashboard?mode=viewer&owner=${session?.user?.id || ''}`;
                    navigator.clipboard.writeText(link);
                    alert('뷰어(읽기전용) 링크가 복사되었습니다!\n스태프에게 공유하면 로그인 없이 상황판을 조회할 수 있습니다.');
                  }}
                  className="flex items-center gap-3 p-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div className="w-9 h-9 bg-amber-100 border border-amber-200 text-amber-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform text-base">👁</div>
                  <div>
                    <p className="text-sm font-black text-amber-900">뷰어 링크 복사</p>
                    <p className="text-[10px] text-amber-600 font-medium">읽기 전용 · 로그인 불필요</p>
                  </div>
                  <Copy size={14} className="ml-auto text-amber-400 group-hover:text-amber-600 transition-colors" />
                </button>

                <button
                  onClick={() => {
                    const link = `${window.location.origin}/dashboard?mode=staff&owner=${session?.user?.id || ''}`;
                    navigator.clipboard.writeText(link);
                    alert('스태프(베드 조작 가능) 링크가 복사되었습니다!\n스태프에게 공유하면 로그인 없이 베드를 조작할 수 있습니다.');
                  }}
                  className="flex items-center gap-3 p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div className="w-9 h-9 bg-emerald-100 border border-emerald-200 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform text-base">🧑‍⚕️</div>
                  <div>
                    <p className="text-sm font-black text-emerald-900">스태프 링크 복사</p>
                    <p className="text-[10px] text-emerald-600 font-medium">베드 조작 가능 · 로그인 불필요</p>
                  </div>
                  <Copy size={14} className="ml-auto text-emerald-400 group-hover:text-emerald-600 transition-colors" />
                </button>
              </div>
            </div>
          </div>
        ) : portalMode === 'landing' ? (
          /* ==================== 2. 미로그인 상태 - 통합 포털 메인 랜딩 페이지 ==================== */
          <div className="w-full max-w-4xl flex flex-col items-center animate-in fade-in duration-200">
            {/* Hero 헤더 */}
            <div className="text-center max-w-2xl mb-8 md:mb-12">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-xs font-black text-blue-600 mb-4 shadow-sm">
                <Sparkles size={14} className="text-blue-500" />
                <span>스마트 재활치료 AI 통합 플랫폼</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
                재활치료 상황판부터<br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AI 임상 음성 차팅</span>까지 한눈에
              </h1>
              <p className="text-sm md:text-base text-slate-600 font-medium leading-relaxed">
                하나의 통합 계정으로 상황판 베드 관제 서비스와 자동 생성 SOAP 차팅 시스템을 연동하여 업무 효율을 대폭 향상하세요.
              </p>

              {/* 메인 랜딩 CTA 버튼 */}
              <div className="flex flex-row items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => { setPortalMode('auth'); setAuthTab('login'); setMessage(null); }}
                  className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm md:text-base transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <LogIn size={18} /> 통합계정 로그인
                </button>
                <button
                  onClick={() => { setPortalMode('auth'); setAuthTab('signup'); setMessage(null); }}
                  className="px-6 py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-sm md:text-base transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <UserPlus size={18} /> 무료 회원가입
                </button>
              </div>
            </div>

            {/* 주요 기능 소개 카드 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
              {/* 기능 1: 물리치료실 상황판 */}
              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl flex flex-col">
                <div className="w-10 h-10 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                  <LayoutDashboard size={20} />
                </div>
                <h3 className="text-base font-black text-slate-800 mb-2">실시간 베드 상황판</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4 flex-1">
                  도면 레이아웃 기반 터치/드래그앤드롭 베드 이송, 실시간 타이머 및 치료 항목 완수 상태 모니터링
                </p>
                <div className="pt-3 border-t border-slate-100 flex items-center text-[11px] font-bold text-blue-600">
                  <Zap size={13} className="mr-1" /> 모바일 & 멀티 디바이스 연동
                </div>
              </div>

              {/* 기능 2: AI 음성 차팅 */}
              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl flex flex-col">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                  <Mic size={20} />
                </div>
                <h3 className="text-base font-black text-slate-800 mb-2">AI 음성 임상 차팅</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4 flex-1">
                  고객 대화 녹음 파일 기반 STT 화자분리 및 SOAP 임상 기록·도수치료 시행 기록지 1클릭 자동 생성
                </p>
                <div className="pt-3 border-t border-slate-100 flex items-center text-[11px] font-bold text-indigo-600">
                  <Sparkles size={13} className="mr-1" /> Open AI GPT-4o 보정 엔지니어링
                </div>
              </div>

              {/* 기능 3: 통계 & 리포트 */}
              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl flex flex-col">
                <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                  <BarChart3 size={20} />
                </div>
                <h3 className="text-base font-black text-slate-800 mb-2">통계 및 리포트 관리</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4 flex-1">
                  방문 고객 일별/기간별 통계 내역 자동 집계 및 Excel/CSV 서식 내보내기 지원
                </p>
                <div className="pt-3 border-t border-slate-100 flex items-center text-[11px] font-bold text-emerald-600">
                  <ShieldCheck size={13} className="mr-1" /> 보안 RLS 암호화 저장
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ==================== 3. 미로그인 상태 - 통합 계정 로그인 / 회원가입 페이지 ==================== */
          <div className="w-full max-w-md p-8 bg-white/85 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            {/* 상단 뒤로가기 링크 */}
            <button
              onClick={() => { setPortalMode('landing'); setMessage(null); }}
              className="self-start flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors mb-4 cursor-pointer"
            >
              <ArrowLeft size={14} /> 포털 둘러보기로 이동
            </button>

            <div className="flex flex-col items-center mb-6">
              <ThePtLogo className="text-slate-800" />
            </div>

            {/* 로그인 / 회원가입 선택 탭 */}
            <div className="flex w-full bg-slate-100 p-1.5 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => { setAuthTab('login'); setMessage(null); }}
                className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LogIn size={15} /> 로그인
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('signup'); setMessage(null); }}
                className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'signup' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserPlus size={15} /> 회원가입
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-500 mb-6 text-center leading-normal">
              {authTab === 'login'
                ? '통합 계정 하나로 상황판과 AI 임상 차팅을 모두 이용하세요'
                : '새로운 이메일 계정으로 THEPT# 통합 서비스를 시작하세요'}
            </p>

            {/* 알림 메시지 */}
            {message && (
              <div className={`w-full p-3.5 rounded-xl text-xs font-bold mb-4 flex items-center gap-2 border ${
                message.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
              }`}>
                {message.type === 'error' ? <AlertCircle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            {/* 폼 렌더링 */}
            {authTab === 'login' ? (
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
                  {loading ? '로그인 처리 중...' : '통합 계정 로그인'}
                </button>
              </form>
            ) : (
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
                  {loading ? '가입 처리 중...' : '통합 계정 회원가입 완료'}
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
                Google 계정으로 통합 로그인
              </button>
            </div>

            {/* 스태프 접속 안내 카드 */}
            <div className="w-full mt-6 p-4 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-800 font-medium leading-relaxed">
                <strong className="font-bold block mb-0.5 text-blue-900">스태프 접속 안내</strong>
                공유받으신 <strong>스태프 전용 딥링크</strong>를 클릭하시면 별도 로그인 절차 없이 바로 관제 모드로 들어오실 수 있습니다.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 하단 풋터 */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 py-4 text-center text-xs font-bold text-slate-400 border-t border-slate-200/60">
        © THEPT# Smart Physical Therapy Solutions. All rights reserved.
      </footer>

      {/* 인앱 웹뷰 안내 모달 */}
      {showWebViewGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 relative animate-scale-up">
            <div className="flex flex-col items-center text-center gap-2 mt-2">
              <div className="w-12 h-12 bg-amber-50 border border-amber-100 text-amber-500 rounded-full flex items-center justify-center">
                <Globe size={24} className="animate-spin-slow" />
              </div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">외부 브라우저 연결 안내</h2>
              <p className="text-[11px] font-bold text-slate-400 leading-normal px-2">
                보안 정책에 따라 내장 웹뷰에서는 구글 로그인이 제한됩니다. 아래 버튼으로 정식 브라우저로 전환해 주세요.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {os.isAndroid && (
                <a
                  href={getAndroidIntentUrl()}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm shadow-md active:scale-95 transition-all"
                >
                  <ExternalLink size={16} /> Chrome 브라우저로 이동
                </a>
              )}

              {os.isIOS && isKakao && (
                <button
                  type="button"
                  onClick={() => { window.location.href = getKakaoExternalUrl(); }}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm shadow-md active:scale-95 transition-all"
                >
                  <Compass size={16} /> Safari 브라우저로 전환
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={handleCopyLink}
                className={`flex items-center justify-center gap-2 w-full py-3 border rounded-xl font-black text-sm transition-all ${copied
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 active:scale-95'
                }`}
              >
                {copied ? <><Check size={16} /> 주소 복사 완료!</> : <><Copy size={16} /> 주소 복사하기</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
