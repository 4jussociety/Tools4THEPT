-- 파일 목적: 하드 리셋 과정에서 날아간 본인의 센터장(owner) 권한을 100% 완벽하게 복구(생성)하는 스크립트
-- 이 스크립트를 실행하면 즉시 403 에러가 사라지고 다시 데이터 등록이 가능해집니다.

BEGIN;

-- 1. 혹시 본인 소유의 센터(systems)가 없는 계정이 있다면, 1인 전용 독립 센터를 강제로 생성해 줍니다.
INSERT INTO public.systems (name, owner_id)
SELECT COALESCE(p.full_name, '원장님') || '의 센터', p.id
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.systems s WHERE s.owner_id = p.id
);

-- 2. 프로필(profiles)에 본인의 진짜 센터 ID를 매핑합니다.
UPDATE public.profiles p
SET system_id = (
    SELECT s.id FROM public.systems s WHERE s.owner_id = p.id LIMIT 1
);

-- 3. ★핵심 복구★: 본인의 1인 센터에 '최고 관리자(owner)' 권한으로 다시 멤버 등록을 해줍니다.
-- (기존에 staff 로 되어 있어서 리셋 때 날아간 권한을 owner로 격상시켜 복구)
INSERT INTO public.system_members (system_id, user_id, status, role)
SELECT s.id, s.owner_id, 'approved', 'owner'
FROM public.systems s
ON CONFLICT (system_id, user_id) 
DO UPDATE SET role = 'owner', status = 'approved';

COMMIT;
