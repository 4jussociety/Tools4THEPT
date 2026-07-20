-- 파일 목적: 꼬여버린(공용으로 묶여버린) 센터 소속 정보를 강제로 1인 1센터(독립)로 분리하는 복구 스크립트
-- 주의사항: 이 스크립트를 실행하면 현재 캘린더나 환자 목록에 보이던 남의 환자가 즉시 사라집니다. (격리 성공)
-- 단, 내 환자 중 일부도 '가짜 공용 센터' 소속으로 잘못 저장되어 있었다면 함께 안 보일 수 있으니, 실행 후 내 진짜 system_id로 환자들을 찾아와야 합니다.

BEGIN;

-- 1. 자신이 직접 개설한(owner_id) 센터가 아닌 다른 공용 센터에 묶여 있는 가짜 소속 정보 연결을 모두 삭제합니다.
DELETE FROM public.system_members sm
WHERE NOT EXISTS (
    SELECT 1 FROM public.systems s 
    WHERE s.id = sm.system_id AND s.owner_id = sm.user_id
);

-- 2. profiles(치료사 프로필) 테이블의 소속 ID 역시, 자신의 진짜 센터 ID로 초기화(복구)합니다.
UPDATE public.profiles p
SET system_id = (
    SELECT s.id FROM public.systems s WHERE s.owner_id = p.id LIMIT 1
)
WHERE p.system_id NOT IN (
    SELECT s.id FROM public.systems s WHERE s.owner_id = p.id
);

COMMIT;
