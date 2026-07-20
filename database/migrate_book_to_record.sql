-- ============================================================
-- [THEPT# 통합 DB 마이그레이션 스크립트] (v7.0 clients 컬럼 완비)
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. profiles 테이블
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    name TEXT,
    profession TEXT,
    phone TEXT,
    role TEXT DEFAULT 'THERAPIST',
    system_id UUID,
    sort_order INT DEFAULT 0,
    incentive_percentage_opt1 NUMERIC(5,2) DEFAULT 0,
    incentive_percentage_opt2 NUMERIC(5,2) DEFAULT 0,
    incentive_percentage_opt3 NUMERIC(5,2) DEFAULT 0,
    incentive_percentage_opt4 NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'THERAPIST';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS system_id UUID;

-- 2. systems 테이블
CREATE TABLE IF NOT EXISTS public.systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    owner_id UUID REFERENCES auth.users(id),
    organization_name TEXT,
    contact_number TEXT,
    manager_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. clients (환자/고객) 테이블 (누락 컬럼 완비)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID,
    name TEXT NOT NULL,
    phone VARCHAR(50),
    chart_number TEXT,
    birth_date DATE,
    gender TEXT,
    client_no INT,
    first_visit_date DATE,
    last_appointment_at TIMESTAMPTZ,
    memo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 기존 clients 테이블 확장
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_no INT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS first_visit_date DATE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_appointment_at TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS system_id UUID;

-- 4. client_tickets & ticket_packages 테이블
CREATE TABLE IF NOT EXISTS public.client_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_sessions INT DEFAULT 1,
    used_sessions INT DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID,
    name TEXT NOT NULL,
    total_sessions INT DEFAULT 1,
    price NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. global_ads 테이블
CREATE TABLE IF NOT EXISTS public.global_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    image_url TEXT,
    link_url TEXT,
    slot_id TEXT DEFAULT 'instructor_bottom',
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. appointments 테이블
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    instructor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES public.client_tickets(id) ON DELETE SET NULL,
    session_id UUID,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'PENDING',
    event_type TEXT DEFAULT 'APPOINTMENT',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES public.client_tickets(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS system_id UUID;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS note TEXT;

-- 7. sessions & results 테이블
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    client_name TEXT,
    status TEXT DEFAULT 'pending',
    memo TEXT,
    audio_url TEXT,
    duration INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    raw_transcript TEXT,
    refined_transcript TEXT,
    guide_content TEXT,
    chart_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 보안 정책 통합 적용
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "RLS_profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "RLS_systems" ON public.systems FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "RLS_clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "RLS_client_tickets" ON public.client_tickets FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "RLS_ticket_packages" ON public.ticket_packages FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "RLS_global_ads" ON public.global_ads FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "RLS_appointments" ON public.appointments FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "RLS_sessions" ON public.sessions FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "RLS_results" ON public.results FOR ALL TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- 컬럼명 변경 마이그레이션 (patient_* → client_*)
-- 이미 존재하는 컴럼을 안전하게 이름 변경합니다.
-- ============================================
DO $$
BEGIN
  -- sessions: patient_id → client_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sessions' AND column_name='patient_id') THEN
    ALTER TABLE public.sessions RENAME COLUMN patient_id TO client_id;
  END IF;
  -- sessions: patient_name → client_name
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sessions' AND column_name='patient_name') THEN
    ALTER TABLE public.sessions RENAME COLUMN patient_name TO client_name;
  END IF;
  -- results: patient_reaction → client_reaction (therapy_records 또는 results 테이블)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='results' AND column_name='patient_reaction') THEN
    ALTER TABLE public.results RENAME COLUMN patient_reaction TO client_reaction;
  END IF;
END $$;

COMMIT;
