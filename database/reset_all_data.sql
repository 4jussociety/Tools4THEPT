-- 파일 목적: 꼬여버린 테스트/비즈니스 데이터를 모두 초기화(Hard Reset)하고 맑은 상태에서 새 출발하는 스크립트
-- 주의사항: 이 스크립트를 실행하면 기존의 모든 고객, 예약, 차팅 기록이 데이터베이스에서 영구적으로 삭제(폭파)됩니다.
-- (회원가입 계정(profiles)과 개설하신 센터 껍데기(systems)는 유지되어 바로 재로그인이 가능합니다.)

BEGIN;

-- ============================================
-- 1. AI 임상 차팅 관련 모든 녹음 및 분석 기록 폭파
-- ============================================
TRUNCATE TABLE public.transcriptions CASCADE;
TRUNCATE TABLE public.chunks CASCADE;
TRUNCATE TABLE public.results CASCADE;
TRUNCATE TABLE public.sessions CASCADE;

-- ============================================
-- 2. 모든 예약, 수강권, 고객 데이터 폭파
-- ============================================
TRUNCATE TABLE public.appointments CASCADE;
TRUNCATE TABLE public.client_tickets CASCADE;
TRUNCATE TABLE public.ticket_packages CASCADE;
TRUNCATE TABLE public.clients CASCADE;

-- ============================================
-- 3. 꼬여버린 연결고리 싹둑 (진짜 1인 센터장 권한만 남김)
-- ============================================
-- 남의 센터나 가짜 센터에 직원(staff 등)으로 묶여있던 모든 찌꺼기 연결 고리를 삭제합니다.
DELETE FROM public.system_members
WHERE role != 'owner';

-- 프로필 소속 ID도 자신의 진짜 센터 ID로 맞춥니다.
UPDATE public.profiles p
SET system_id = (
    SELECT s.id FROM public.systems s WHERE s.owner_id = p.id LIMIT 1
)
WHERE p.system_id NOT IN (
    SELECT s.id FROM public.systems s WHERE s.owner_id = p.id
);

COMMIT;
