-- sessions 테이블 누락 컬럼 추가 마이그레이션
-- Supabase Dashboard에서 실제 컬럼 존재 여부를 확인한 후 실행해 주세요.

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS profession TEXT DEFAULT 'pt';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS therapy_date DATE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS therapy_time TEXT;
