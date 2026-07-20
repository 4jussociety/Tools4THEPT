-- 물리치료실 상황판 멀티테넌시 통합 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하여 RLS 보안이 적용된 계정별 독립 테이블들을 생성 또는 업데이트합니다.
-- 기존 유저들의 데이터를 보존하기 위해 테이블을 삭제(DROP)하지 않고 생성 및 컬럼 추가 방식을 사용합니다.

-- ============================================
-- [1단계] 테이블 생성 (존재하지 않는 경우에만 생성)
-- ============================================

-- 베드 정보 테이블
CREATE TABLE IF NOT EXISTS public.beds (
    id TEXT PRIMARY KEY,
    bed_number TEXT NOT NULL,
    bed_type TEXT NOT NULL DEFAULT 'GENERAL',
    status TEXT NOT NULL DEFAULT 'EMPTY',
    client_name TEXT,
    body_part TEXT,
    current_history_id UUID,
    treatments JSONB NOT NULL DEFAULT '[]'::jsonb,
    x_pos INTEGER DEFAULT 0,
    y_pos INTEGER DEFAULT 0,
    width INTEGER DEFAULT 220,
    height INTEGER DEFAULT 320,
    orientation TEXT DEFAULT 'vertical',
    owner_id UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    client_memo TEXT
);

-- 치료 항목 마스터 테이블 (설정에서 관리)
CREATE TABLE IF NOT EXISTS public.treatment_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 방문 기반 리포트 테이블
CREATE TABLE IF NOT EXISTS public.treatment_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name TEXT NOT NULL,
    body_part TEXT,
    visit_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    completed_treatments JSONB DEFAULT '[]'::jsonb,
    incomplete_treatments JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT '진행중',
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    client_memo TEXT
);

-- 레이아웃 설정 테이블
CREATE TABLE IF NOT EXISTS public.layout_settings (
    id TEXT PRIMARY KEY,
    canvas_width INTEGER DEFAULT 2000,
    canvas_height INTEGER DEFAULT 1200,
    zoom FLOAT DEFAULT 1,
    owner_id UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 레이아웃 가구 및 구조물 테이블
CREATE TABLE IF NOT EXISTS public.layout_objects (
    id TEXT PRIMARY KEY,
    object_type TEXT NOT NULL,
    name TEXT,
    x_pos INTEGER NOT NULL DEFAULT 0,
    y_pos INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 100,
    height INTEGER NOT NULL DEFAULT 100,
    rotation INTEGER NOT NULL DEFAULT 0,
    z_index INTEGER NOT NULL DEFAULT 10,
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- ============================================
-- [2단계] 기존 테이블 업데이트 (컬럼이 누락된 경우에만 추가)
-- ============================================

-- beds 테이블 컬럼 추가
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS bed_number TEXT;
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS bed_type TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'EMPTY';
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS body_part TEXT;
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS current_history_id UUID;
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS treatments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS x_pos INTEGER DEFAULT 0;
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS y_pos INTEGER DEFAULT 0;
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 220;
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 320;
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS orientation TEXT DEFAULT 'vertical';
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS client_memo TEXT;

-- treatment_types 테이블 컬럼 추가
ALTER TABLE public.treatment_types ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.treatment_types ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 15;
ALTER TABLE public.treatment_types ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE public.treatment_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;

-- treatment_history 테이블 컬럼 추가
ALTER TABLE public.treatment_history ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.treatment_history ADD COLUMN IF NOT EXISTS body_part TEXT;
ALTER TABLE public.treatment_history ADD COLUMN IF NOT EXISTS visit_time TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.treatment_history ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.treatment_history ADD COLUMN IF NOT EXISTS completed_treatments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.treatment_history ADD COLUMN IF NOT EXISTS incomplete_treatments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.treatment_history ADD COLUMN IF NOT EXISTS status TEXT DEFAULT '진행중';
ALTER TABLE public.treatment_history ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE public.treatment_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;
ALTER TABLE public.treatment_history ADD COLUMN IF NOT EXISTS client_memo TEXT;

-- layout_settings 테이블 컬럼 추가
ALTER TABLE public.layout_settings ADD COLUMN IF NOT EXISTS canvas_width INTEGER DEFAULT 2000;
ALTER TABLE public.layout_settings ADD COLUMN IF NOT EXISTS canvas_height INTEGER DEFAULT 1200;
ALTER TABLE public.layout_settings ADD COLUMN IF NOT EXISTS zoom FLOAT DEFAULT 1;
ALTER TABLE public.layout_settings ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE public.layout_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;

-- layout_objects 테이블 컬럼 추가
ALTER TABLE public.layout_objects ADD COLUMN IF NOT EXISTS object_type TEXT;
ALTER TABLE public.layout_objects ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.layout_objects ADD COLUMN IF NOT EXISTS x_pos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.layout_objects ADD COLUMN IF NOT EXISTS y_pos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.layout_objects ADD COLUMN IF NOT EXISTS width INTEGER NOT NULL DEFAULT 100;
ALTER TABLE public.layout_objects ADD COLUMN IF NOT EXISTS height INTEGER NOT NULL DEFAULT 100;
ALTER TABLE public.layout_objects ADD COLUMN IF NOT EXISTS rotation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.layout_objects ADD COLUMN IF NOT EXISTS z_index INTEGER NOT NULL DEFAULT 10;
ALTER TABLE public.layout_objects ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE public.layout_objects ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;

-- ============================================
-- [2.5단계] 기존 컬럼명 변경 마이그레이션 (patient_* → client_*)
-- 이미 존재하는 컬럼을 안전하게 이름 변경합니다.
-- ============================================
DO $$
BEGIN
  -- beds: patient_name → client_name
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='beds' AND column_name='patient_name') THEN
    ALTER TABLE public.beds RENAME COLUMN patient_name TO client_name;
  END IF;
  -- beds: patient_memo → client_memo
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='beds' AND column_name='patient_memo') THEN
    ALTER TABLE public.beds RENAME COLUMN patient_memo TO client_memo;
  END IF;
  -- treatment_history: patient_name → client_name
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='treatment_history' AND column_name='patient_name') THEN
    ALTER TABLE public.treatment_history RENAME COLUMN patient_name TO client_name;
  END IF;
  -- treatment_history: patient_memo → client_memo
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='treatment_history' AND column_name='patient_memo') THEN
    ALTER TABLE public.treatment_history RENAME COLUMN patient_memo TO client_memo;
  END IF;
END $$;

-- 실시간 변경 감지 대상이 잘 유지되도록 테이블 복제 ID 설정 재확인
ALTER TABLE public.beds REPLICA IDENTITY FULL;

-- ============================================
-- [3단계] RLS(Row Level Security) 활성화 및 보안 정책 설정
-- ============================================
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layout_objects ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 안전)
DROP POLICY IF EXISTS "beds_owner_select" ON public.beds;
DROP POLICY IF EXISTS "beds_owner_insert" ON public.beds;
DROP POLICY IF EXISTS "beds_owner_update" ON public.beds;
DROP POLICY IF EXISTS "beds_owner_delete" ON public.beds;
DROP POLICY IF EXISTS "beds_viewer_select" ON public.beds;

DROP POLICY IF EXISTS "treatment_types_owner_select" ON public.treatment_types;
DROP POLICY IF EXISTS "treatment_types_owner_insert" ON public.treatment_types;
DROP POLICY IF EXISTS "treatment_types_owner_update" ON public.treatment_types;
DROP POLICY IF EXISTS "treatment_types_owner_delete" ON public.treatment_types;
DROP POLICY IF EXISTS "treatment_types_viewer_select" ON public.treatment_types;

DROP POLICY IF EXISTS "treatment_history_owner_select" ON public.treatment_history;
DROP POLICY IF EXISTS "treatment_history_owner_insert" ON public.treatment_history;
DROP POLICY IF EXISTS "treatment_history_owner_update" ON public.treatment_history;
DROP POLICY IF EXISTS "treatment_history_owner_delete" ON public.treatment_history;
DROP POLICY IF EXISTS "treatment_history_viewer_select" ON public.treatment_history;

DROP POLICY IF EXISTS "layout_settings_owner_select" ON public.layout_settings;
DROP POLICY IF EXISTS "layout_settings_owner_insert" ON public.layout_settings;
DROP POLICY IF EXISTS "layout_settings_owner_update" ON public.layout_settings;
DROP POLICY IF EXISTS "layout_settings_viewer_select" ON public.layout_settings;

DROP POLICY IF EXISTS "layout_objects_owner_select" ON public.layout_objects;
DROP POLICY IF EXISTS "layout_objects_owner_insert" ON public.layout_objects;
DROP POLICY IF EXISTS "layout_objects_owner_update" ON public.layout_objects;
DROP POLICY IF EXISTS "layout_objects_owner_delete" ON public.layout_objects;
DROP POLICY IF EXISTS "layout_objects_viewer_select" ON public.layout_objects;

-- beds 보안 정책 생성
CREATE POLICY "beds_owner_select" ON public.beds FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "beds_owner_insert" ON public.beds FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "beds_owner_update" ON public.beds FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "beds_owner_delete" ON public.beds FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "beds_viewer_select" ON public.beds FOR SELECT TO anon USING (true);

-- treatment_types 보안 정책 생성
CREATE POLICY "treatment_types_owner_select" ON public.treatment_types FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_types_owner_insert" ON public.treatment_types FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "treatment_types_owner_update" ON public.treatment_types FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_types_owner_delete" ON public.treatment_types FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_types_viewer_select" ON public.treatment_types FOR SELECT TO anon USING (true);

-- treatment_history 보안 정책 생성
CREATE POLICY "treatment_history_owner_select" ON public.treatment_history FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_history_owner_insert" ON public.treatment_history FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "treatment_history_owner_update" ON public.treatment_history FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_history_owner_delete" ON public.treatment_history FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_history_viewer_select" ON public.treatment_history FOR SELECT TO anon USING (true);

-- layout_settings 보안 정책 생성
CREATE POLICY "layout_settings_owner_select" ON public.layout_settings FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "layout_settings_owner_insert" ON public.layout_settings FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "layout_settings_owner_update" ON public.layout_settings FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "layout_settings_viewer_select" ON public.layout_settings FOR SELECT TO anon USING (true);

-- layout_objects 보안 정책 생성
CREATE POLICY "layout_objects_owner_select" ON public.layout_objects FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "layout_objects_owner_insert" ON public.layout_objects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "layout_objects_owner_update" ON public.layout_objects FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "layout_objects_owner_delete" ON public.layout_objects FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "layout_objects_viewer_select" ON public.layout_objects FOR SELECT TO anon USING (true);

-- ============================================
-- [4단계] 데이터 조회 최적화를 위한 인덱스 설정
-- ============================================
CREATE INDEX IF NOT EXISTS idx_beds_owner_id ON public.beds(owner_id);
CREATE INDEX IF NOT EXISTS idx_treatment_types_owner_id ON public.treatment_types(owner_id);
CREATE INDEX IF NOT EXISTS idx_treatment_history_owner_id ON public.treatment_history(owner_id);
CREATE INDEX IF NOT EXISTS idx_layout_settings_owner_id ON public.layout_settings(owner_id);
CREATE INDEX IF NOT EXISTS idx_layout_objects_owner_id ON public.layout_objects(owner_id);

-- ============================================
-- [5단계] 실시간 변경 감지 활성화
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='beds') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.beds;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='treatment_types') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.treatment_types;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='treatment_history') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.treatment_history;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='layout_objects') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.layout_objects;
  END IF;
END $$;

-- ============================================
-- [6단계] 업데이트 시간 자동 갱신 트리거 설정
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 중복 생성 에러 방지를 위해 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS on_bed_updated ON public.beds;
CREATE TRIGGER on_bed_updated
    BEFORE UPDATE ON public.beds
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();
