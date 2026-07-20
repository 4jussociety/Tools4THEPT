// GNB: 글로벌 네비게이션 바
// 데스크톱: 상단 가로 네비게이션 / 모바일: 하단 탭바

import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { LogOut, User, CalendarDays, Users, BarChart3, Menu, X, Sparkles, Globe, Settings, UserCog, History } from 'lucide-react'
import { clsx } from 'clsx'
import { ThePtLogo } from '../ThePtLogo'

export default function GNB() {
    const { profile, user, signOut } = useAuth()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [profileMenuOpen, setProfileMenuOpen] = useState(false)

    const handleLogout = async () => {
        await signOut()
        window.location.href = '/login'
    }

    const navItems = [
        { label: '예약 관리', href: '/calendar', icon: CalendarDays },
        { label: '고객 관리', href: '/clients', icon: Users },
        { label: 'AI 음성 차팅', href: '/charting', icon: Sparkles },
    ]

    const displayName = profile?.full_name || profile?.name || user?.email?.split('@')[0] || '치료사'
    const displayEmail = profile?.email || user?.email || ''

    return (
        <>
            {/* ─── 데스크톱 상단 네비게이션 ─── */}
            <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 font-sans">
                <div className="flex items-center gap-4 md:gap-8">
                    <a href="/portal" className="no-underline flex items-center">
                        <ThePtLogo prefix="스케줄" className="text-[2.0em] md:text-[2.5em]" />
                    </a>
                    {/* 데스크톱 네비 */}
                    <nav className="hidden lg:flex items-center gap-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.href}
                                to={item.href}
                                className={({ isActive }) =>
                                    clsx(
                                        'px-3 py-2 text-xs md:text-sm font-bold transition-all rounded-lg flex items-center gap-1.5',
                                        isActive
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    )
                                }
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-2 md:gap-3 relative">
                    {/* 프로필 / 드롭다운 */}
                    {(profile || user) && (
                        <div className="relative">
                            <button
                                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition border border-slate-200 cursor-pointer"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                    {displayName.slice(0, 1).toUpperCase()}
                                </div>
                                <span className="hidden md:inline text-xs font-bold text-slate-700">{displayName}</span>
                            </button>

                            {profileMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50 divide-y divide-slate-100">
                                    <div className="px-4 py-2.5 bg-slate-50/50">
                                        <p className="text-xs font-bold text-gray-800">{displayName} 치료사님</p>
                                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{displayEmail}</p>
                                    </div>
                                    <div className="py-1">
                                        <Link
                                            to="/profile"
                                            onClick={() => setProfileMenuOpen(false)}
                                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                            <User className="w-4 h-4 text-blue-500" /> 내 프로필 / 마이페이지
                                        </Link>
                                        <Link
                                            to="/statistics"
                                            onClick={() => setProfileMenuOpen(false)}
                                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                            <BarChart3 className="w-4 h-4 text-emerald-500" /> 경영 통계 리포트
                                        </Link>
                                        <Link
                                            to="/members"
                                            onClick={() => setProfileMenuOpen(false)}
                                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                            <UserCog className="w-4 h-4 text-indigo-500" /> 스태프 멤버 관리
                                        </Link>
                                        <Link
                                            to="/settings"
                                            onClick={() => setProfileMenuOpen(false)}
                                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                            <Settings className="w-4 h-4 text-amber-500" /> 센터 운영 설정
                                        </Link>
                                    </div>
                                    <div className="py-1">
                                        <a
                                            href="/portal"
                                            onClick={() => setProfileMenuOpen(false)}
                                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                            <Globe className="w-4 h-4 text-blue-600" /> 🌐 통합 메인 포털
                                        </a>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 text-left cursor-pointer"
                                        >
                                            <LogOut className="w-4 h-4" /> 로그아웃
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 모바일 햄버거 버튼 */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="lg:hidden p-2 text-gray-600 hover:text-gray-900 cursor-pointer"
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </header>

            {/* ─── 모바일 서브 메뉴 드롭다운 ─── */}
            {mobileMenuOpen && (
                <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex flex-col gap-2 font-sans sticky top-16 z-40 shadow-lg">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.href}
                            to={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition',
                                    isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                                )
                            }
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </NavLink>
                    ))}
                    <Link
                        to="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg"
                    >
                        <User className="w-4 h-4 text-blue-500" /> 내 프로필 (마이페이지)
                    </Link>
                    <Link
                        to="/statistics"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg"
                    >
                        <BarChart3 className="w-4 h-4 text-emerald-500" /> 경영 통계 리포트
                    </Link>
                    <Link
                        to="/members"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg"
                    >
                        <UserCog className="w-4 h-4 text-indigo-500" /> 스태프 멤버 관리
                    </Link>
                    <Link
                        to="/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg"
                    >
                        <Settings className="w-4 h-4 text-amber-500" /> 센터 운영 설정
                    </Link>
                    <a
                        href="/portal"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 rounded-lg"
                    >
                        <Globe className="w-4 h-4 text-blue-500" /> 🌐 통합 메인 포털
                    </a>
                    {(profile || user) && (
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg text-left"
                        >
                            <LogOut className="w-4 h-4" /> 로그아웃
                        </button>
                    )}
                </div>
            )}
        </>
    )
}
