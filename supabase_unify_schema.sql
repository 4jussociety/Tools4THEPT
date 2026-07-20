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
// Legacy sync function and trigger removed (no longer used in current pipeline)
// ----------------------------------------------------------
// The following block was used for legacy field synchronization between
// old column names (instructor_id, client_id) and the new schema (therapist_id,
// patient_id). The current pipeline no longer relies on these triggers.
// ----------------------------------------------------------

-- 2-4. 기존 예약 데이터들의 레거시 필드 소급 동기화
UPDATE public.appointments
SET therapist_id = instructor_id,
    patient_id = client_id
WHERE therapist_id IS NULL OR patient_id IS NULL;

-- =========================================================================
-- 3. clients 테이블: 고객번호(client_no) 및 수동등록 여부(is_manual_no) 컬럼 추가
-- =========================================================================
-- 3-1. client_no 자동 증가용 시퀀스 생성
CREATE SEQUENCE IF NOT EXISTS public.clients_client_no_seq;

-- 3-2. clients 테이블에 컬럼 생성 및 기본값 적용
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS client_no integer DEFAULT nextval('public.clients_client_no_seq'),
ADD COLUMN IF NOT EXISTS is_manual_no boolean DEFAULT false;

-- 3-3. 기존 데이터 소급 적용
UPDATE public.clients
SET client_no = nextval('public.clients_client_no_seq')
WHERE client_no IS NULL;

-- =========================================================================
-- 4. sessions 테이블: 치료일시(therapy_date, therapy_time) 및 예약 연동(appointment_id) 컬럼 추가
-- =========================================================================
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS therapy_date DATE,
ADD COLUMN IF NOT EXISTS therapy_time TIME,
ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

-- 기존 데이터 소급 적용
UPDATE public.sessions
SET therapy_date = CAST(created_at AS DATE),
    therapy_time = CAST(created_at AS TIME)
WHERE therapy_date IS NULL;
-- 5. 차팅 세션 ↔ 예약 매핑 테이블
CREATE TABLE IF NOT EXISTS public.appointment_chart_map (
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  chart_id       uuid NOT NULL REFERENCES public.charts(id)      ON DELETE CASCADE,
  linked_at      timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (appointment_id, chart_id)
);
CREATE INDEX IF NOT EXISTS idx_appointment_chart_map_appointment ON public.appointment_chart_map (appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_chart_map_chart ON public.appointment_chart_map (chart_id);

-- 6. 세션에 차트 ID 컬럼 (optional, for 직접 연관)
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS chart_id uuid REFERENCES public.charts(id);

-- 7. 차트 생성 시 예약과 자동 매핑 트리거
CREATE OR REPLACE FUNCTION public.link_chart_to_appointment()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.appointment_chart_map (appointment_id, chart_id)
  SELECT a.id, NEW.id
  FROM public.appointments a
  WHERE a.scheduled_at <= now()
    AND a.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.appointment_chart_map am
      WHERE am.appointment_id = a.id AND am.chart_id = NEW.id
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_link_chart_to_appointment ON public.charts;
CREATE TRIGGER trg_link_chart_to_appointment
AFTER INSERT ON public.charts
FOR EACH ROW EXECUTE FUNCTION public.link_chart_to_appointment();
