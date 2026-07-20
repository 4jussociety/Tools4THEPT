-- 파일 목적: 구형 dashboard 관련 사용하지 않는 레거시 테이블 완전 삭제 (Cleanup)
-- 경고: 이 스크립트를 실행하면 기존의 상황판 데이터(beds, treatment_history 등)가 영구적으로 삭제됩니다.

BEGIN;

-- 1. 더 이상 사용하지 않는 상황판 테이블(beds) 관련 보안 정책 및 테이블 삭제
DROP POLICY IF EXISTS "beds_all_owner_policy" ON public.beds;
DROP TABLE IF EXISTS public.beds CASCADE;

-- 2. 더 이상 사용하지 않는 치료 이력 테이블 삭제
DROP POLICY IF EXISTS "treatment_history_all_owner_policy" ON public.treatment_history;
DROP TABLE IF EXISTS public.treatment_history CASCADE;

-- 3. 더 이상 사용하지 않는 치료 종류 테이블 삭제
DROP POLICY IF EXISTS "treatment_types_all_owner_policy" ON public.treatment_types;
DROP TABLE IF EXISTS public.treatment_types CASCADE;

COMMIT;
