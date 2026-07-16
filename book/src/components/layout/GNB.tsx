// GNB: 글로벌 네비게이션 바
// 데스크톱: 상단 가로 네비게이션 / 모바일: 하단 탭바

import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { LogOut, User, CalendarDays, Users, BarChart3, Menu, X, Sparkles, Copy, Check, Globe } from 'lucide-react'
import { clsx } from 'clsx'

export default function GNB() {
    const { profile, user, isStaffMode, ownerId, signOut } = useAuth()
    const navigate = useNavigate()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [profileMenuOpen, setProfileMenuOpen] = useState(false)
    const [copied, setCopied] = useState(false)

    const handleCopyStaffLink = () => {
        const targetOwnerId = ownerId || profile?.id || user?.id || ''
        const staffUrl = `${window.location.origin}/calendar?mode=staff&owner=${targetOwnerId}`
        navigator.clipboard.writeText(staffUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleLogout = async () => {
        await signOut()
        navigate('/portal')
    }

    const navItems = [
        { label: '예약 관리', href: '/calendar', icon: CalendarDays },
        { label: '고객 관리', href: '/clients', icon: Users },
        { label: 'AI 음성 차팅', href: '/charting', icon: Sparkles },
    ]

    if (profile?.is_owner) {
        navItems.push({ label: '통계', href: '/statistics', icon: BarChart3 })
    }

    const displayName = profile?.full_name || profile?.name || user?.email?.split('@')[0] || '치료사'
    const displayEmail = profile?.email || user?.email || ''

    return (
        <>
            {/* ─── 데스크톱 상단 네비게이션 ─── */}
            <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 font-sans">
                <div className="flex items-center gap-4 md:gap-8">
                    <Link to="/portal" className="text-2xl md:text-3xl font-black text-black font-roboto italic tracking-tighter leading-none [-webkit-text-stroke:1px_black]">
                        THEPT#
                    </Link>
                    {/* 데스크톱 네비 */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.href}
                                to={item.href}
                                className={({ isActive }) =>
                                    clsx(
                                        'px-4 py-2 text-sm font-bold transition-all rounded-lg',
                                        isActive
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    )
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-2 md:gap-3 relative">
                    {/* 원장님/관리자 모드: 스태프 공유 링크 복사 버튼 */}
                    {(!isStaffMode && (profile || user)) && (
                        <button
                            onClick={handleCopyStaffLink}
                            className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold transition border border-emerald-200 cursor-pointer"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-600" />}
                            <span>{copied ? '복사됨!' : '📋 스태프 링크 복사'}</span>
                        </button>
                    )}

                    {/* 스태프 모드 배지 */}
                    {isStaffMode && (
                        <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>스태프 전용 모드</span>
                        </div>
                    )}

                    {/* 프로필 / 드롭다운 */}
                    {(profile || user) && !isStaffMode && (
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
                                <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50">
                                    <div className="px-4 py-2.5 border-b border-gray-100 bg-slate-50/50">
                                        <p className="text-xs font-bold text-gray-800">{displayName} 치료사님</p>
                                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{displayEmail}</p>
                                    </div>
                                    <Link
                                        to="/profile"
                                        onClick={() => setProfileMenuOpen(false)}
                                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                        <User className="w-4 h-4 text-blue-500" /> 내 프로필 / 마이페이지
                                    </Link>
                                    <Link
                                        to="/portal"
                                        onClick={() => setProfileMenuOpen(false)}
                                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                        <Globe className="w-4 h-4 text-emerald-500" /> 통합 메인 포털
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 text-left border-t border-gray-100 cursor-pointer"
                                    >
                                        <LogOut className="w-4 h-4" /> 로그아웃
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 모바일 햄버거 버튼 */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="md:hidden p-2 text-gray-600 hover:text-gray-900 cursor-pointer"
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </header>

            {/* ─── 모바일 서브 메뉴 드롭다운 ─── */}
            {mobileMenuOpen && (
                <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex flex-col gap-2 font-sans sticky top-16 z-40 shadow-lg">
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
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg"
                    >
                        <User className="w-4 h-4 text-blue-500" /> 내 프로필 (마이페이지)
                    </Link>
                    <Link
                        to="/portal"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 rounded-lg"
                    >
                        <Globe className="w-4 h-4 text-blue-500" /> 🌐 통합 포털
                    </Link>
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
