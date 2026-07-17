-- 데이터베이스 명칭 통일 및 하위 호환성 보장 자동 동기화 트리거 DDL 스크립트
-- beds 및 appointments 테이블의 명칭 불일치(patient vs client, therapist vs instructor)를 동기화합니다.

-- =========================================================================
-- 1. beds 테이블: patient_memo -> client_memo 통합 및 삭제
-- =========================================================================
-- 혹시 남아있는 patient_memo 데이터를 client_memo로 마이그레이션
UPDATE public.beds
SET client_memo = COALESCE(client_memo, patient_memo)
WHERE patient_memo IS NOT NULL;

-- 낡은 patient_memo 컬럼 제거
ALTER TABLE public.beds DROP COLUMN IF EXISTS patient_memo;

-- =========================================================================
-- 2. appointments 테이블: 제약조건 완화 및 호환성 보장 트리거 설치
-- =========================================================================
-- 2-1. therapist_id 및 patient_id 필수 제약조건 제거 (400 에러 방지)
ALTER TABLE public.appointments ALTER COLUMN therapist_id DROP NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;

-- 2-2. 예약 생성/수정 시 instructor_id -> therapist_id, client_id -> patient_id 자동 동기화 트리거 함수 생성
CREATE OR REPLACE FUNCTION public.sync_appointment_legacy_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.therapist_id := NEW.instructor_id;
  NEW.patient_id := NEW.client_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2-3. 트리거 생성
DROP TRIGGER IF EXISTS on_appointment_sync ON public.appointments;
CREATE TRIGGER on_appointment_sync
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE PROCEDURE public.sync_appointment_legacy_fields();

-- 2-4. 기존 예약 데이터들의 레거시 필드 소급 동기화
UPDATE public.appointments
SET therapist_id = instructor_id,
    patient_id = client_id
WHERE therapist_id IS NULL OR patient_id IS NULL;
