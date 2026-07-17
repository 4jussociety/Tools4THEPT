-- 30분 단위 청크 파이프라인 테이블 및 스키마 확장을 위한 마이그레이션 SQL
-- chunks, transcriptions 테이블을 생성하고 기존 results 테이블에 chunk_id 관계를 연결합니다.

CREATE TABLE IF NOT EXISTS public.chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  segment_index integer NOT NULL,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid REFERENCES public.chunks(id) ON DELETE CASCADE,
  job_id text NOT NULL,
  raw_transcript text,
  speaker_labels jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.results 
ADD COLUMN IF NOT EXISTS chunk_id uuid REFERENCES public.chunks(id) ON DELETE SET NULL;

-- 4. RLS (Row Level Security) 설정
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

-- 4-1. chunks 테이블에 대한 RLS 정책 생성 (인증된 사용자 대상 전체 제어 허용)
DROP POLICY IF EXISTS "Allow full access for authenticated users to chunks" ON public.chunks;
CREATE POLICY "Allow full access for authenticated users to chunks"
  ON public.chunks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access for authenticated users to transcriptions" ON public.transcriptions;
CREATE POLICY "Allow full access for authenticated users to transcriptions"
  ON public.transcriptions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. sessions 테이블 외래키 제약조건 교정 (patients -> clients 테이블 참조로 갱신)
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_patient_id_fkey;
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_client_id_fkey;

ALTER TABLE public.sessions 
  ADD CONSTRAINT sessions_client_id_fkey 
  FOREIGN KEY (client_id) 
  REFERENCES public.clients(id) 
  ON DELETE SET NULL;

-- 6. Storage 'audio-records' public 버킷 생성 및 RLS 정책 수립
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-records', 'audio-records', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated insert to audio-records" ON storage.objects;
CREATE POLICY "Allow authenticated insert to audio-records"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio-records');

DROP POLICY IF EXISTS "Allow public select from audio-records" ON storage.objects;
CREATE POLICY "Allow public select from audio-records"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'audio-records');
