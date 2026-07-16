/**
 * 인증 및 사용자 모드 관리 커스텀 훅
 * 세션 관리, 뷰어/스태프/매니저 모드 파싱, URL Hash 세션 동기화, ownerId 결정을 담당합니다.
 *
 * URL 파라미터 규칙:
 *   ?mode=viewer&owner=<userId>  → 뷰어 모드 (읽기 전용, 로그인 불필요)
 *   ?mode=staff&owner=<userId>   → 스태프 모드 (베드 조작 가능, 레이아웃/설정 변경 불가)
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export type UserMode = 'manager' | 'staff' | 'viewer';

export interface AuthState {
  session: Session | null;
  isViewerMode: boolean;   // viewer or staff (로그인 불필요 모드)
  isStaffMode: boolean;    // staff 전용 (베드 조작 가능, 설정 변경 불가)
  userMode: UserMode;      // 'manager' | 'staff' | 'viewer'
  ownerId: string | null;
  isLoading: boolean;      // 초기 auth 상태 확인 중
}

// URL 파라미터를 렌더 전에 동기적으로 파싱 (race condition 방지)
function parseUrlMode(): { mode: UserMode; ownerParam: string | null } {
  const urlParams = new URLSearchParams(window.location.search);
  const modeParam = urlParams.get('mode');
  const ownerParam = urlParams.get('owner');

  if (modeParam === 'viewer') return { mode: 'viewer', ownerParam };
  if (modeParam === 'staff') return { mode: 'staff', ownerParam };
  return { mode: 'manager', ownerParam: null };
}

export function useAuth(): AuthState {
  // URL 파라미터를 useState 초기값 함수로 동기 파싱 → 첫 렌더부터 올바른 모드 적용
  const [parsedMode] = useState<{ mode: UserMode; ownerParam: string | null }>(parseUrlMode);

  const isGuestMode = parsedMode.mode === 'viewer' || parsedMode.mode === 'staff';

  const [session, setSession] = useState<Session | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(
    isGuestMode ? parsedMode.ownerParam : null
  );
  // 게스트 모드(viewer/staff)는 세션 조회 필요 없으므로 isLoading = false
  const [isLoading, setIsLoading] = useState(!isGuestMode);

  useEffect(() => {
    // 게스트 모드(뷰어/스태프)는 세션 관련 처리 불필요
    if (isGuestMode) return;

    // Cross-origin session sync: URL hash에 access_token이 넘어온 경우 처리
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
            if (data.session.user?.id) {
              setOwnerId(data.session.user.id);
            }
            // Hash 파라미터 깔끔하게 제거
            window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
          }
          setIsLoading(false);
        });
        return;
      }
    }

    // 일반 관리자 모드: 기존 로그인 세션 조회
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        if (session.user?.id) {
          setOwnerId(session.user.id);
        }
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        setOwnerId(session.user.id);
      } else {
        setOwnerId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [isGuestMode]);

  // 구글 로그인 및 토큰 전달 후 URL 끝의 '#' 깔끔 정리
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (window.location.hash === '' && window.location.href.endsWith('#')) {
        window.history.replaceState(
          null,
          document.title,
          window.location.pathname + window.location.search
        );
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, []);

  return {
    session,
    isViewerMode: isGuestMode,           // viewer + staff 둘 다 로그인 불필요
    isStaffMode: parsedMode.mode === 'staff',
    userMode: parsedMode.mode,
    ownerId,
    isLoading,
  };
}
