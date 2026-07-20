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

-- 3. ★핵심 복구★: ON CONFLICT 에러를 피하기 위해, 아직 등록되지 않은 경우에만 안전하게 INSERT 합니다.
INSERT INTO public.system_members (system_id, user_id, status, role)
SELECT s.id, s.owner_id, 'approved', 'owner'
FROM public.systems s
WHERE NOT EXISTS (
    SELECT 1 FROM public.system_members sm 
    WHERE sm.system_id = s.id AND sm.user_id = s.owner_id
);

-- 이미 등록된 찌꺼기가 남아있을 경우를 대비해 무조건 owner로 강제 업데이트(격상) 합니다.
UPDATE public.system_members sm
SET role = 'owner', status = 'approved'
FROM public.systems s
WHERE sm.system_id = s.id AND sm.user_id = s.owner_id;

COMMIT;
