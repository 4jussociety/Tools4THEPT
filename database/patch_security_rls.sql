-- 파일 목적: Supabase RLS(Row Level Security) 강화를 통해 고객정보 노출 취약점 해결 (v2 - 무한 루프 완벽 해결 버전)
-- 파일 기능: SECURITY DEFINER 헬퍼 함수를 정의하여 무한 루프를 차단하고, 11개 테이블의 RLS 격리를 완벽하게 수립합니다.

BEGIN;

-- ============================================
-- 1. 기존의 안전하지 않은 RLS 정책 및 함수 완벽 초기화 (동적 삭제)
-- ============================================

-- 이름이 달라서 지워지지 않은 과거의 허술한 정책(예: "Enable read access for all users")들이 
-- 남아있으면 OR 연산으로 뚫리게 됩니다. 따라서 모든 정책을 일괄 폭파시킵니다.
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename); 
    END LOOP; 
END $$;

DROP FUNCTION IF EXISTS public.get_my_system_ids();

-- ============================================
-- 2. RLS 우회 방지 및 무한 루프 차단용 헬퍼 함수 정의
-- SECURITY DEFINER를 적용하여 RLS의 재귀 호출(무한 루프)을 우회하고 관리자 권한으로 소속 system_id들을 가져옵니다.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_my_system_ids()
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  SELECT system_id 
  FROM public.system_members 
  WHERE user_id = auth.uid() AND status = 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 3. 테이블별 신규 RLS 정책 적용
-- ============================================

-- 3-1. profiles (치료사 프로필)
-- 본인 프로필이거나, 동일한 센터(system_id)에 속한 동료 치료사의 프로필만 조회 허용
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    system_id IN (SELECT public.get_my_system_ids())
  );

CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- 3-2. systems (기관/센터)
-- 소유자이거나 소속 멤버로 등록된 시스템만 접근 허용
CREATE POLICY "systems_select_policy" ON public.systems
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT public.get_my_system_ids())
  );

CREATE POLICY "systems_all_owner_policy" ON public.systems
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());


-- 3-3. clients (고객/환자)
-- 자신이 속한 센터(system_id)의 고객 데이터만 조회, 수정, 등록, 삭제 허용
CREATE POLICY "clients_system_policy" ON public.clients
  FOR ALL TO authenticated
  USING (system_id IN (SELECT public.get_my_system_ids()))
  WITH CHECK (system_id IN (SELECT public.get_my_system_ids()));


-- 3-4. appointments (예약)
-- 자신이 속한 센터(system_id)의 예약 내역만 접근 허용
CREATE POLICY "appointments_system_policy" ON public.appointments
  FOR ALL TO authenticated
  USING (system_id IN (SELECT public.get_my_system_ids()))
  WITH CHECK (system_id IN (SELECT public.get_my_system_ids()));


-- 3-5. client_tickets (고객 보유 이용권)
-- 소속 센터(system_id) 고객의 이용권만 접근 허용
CREATE POLICY "client_tickets_system_policy" ON public.client_tickets
  FOR ALL TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE system_id IN (SELECT public.get_my_system_ids())
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients 
      WHERE system_id IN (SELECT public.get_my_system_ids())
    )
  );


-- 3-6. ticket_packages (이용권 상품 설정)
-- 소속 센터(system_id)의 요금 설정만 접근 허용
CREATE POLICY "ticket_packages_system_policy" ON public.ticket_packages
  FOR ALL TO authenticated
  USING (system_id IN (SELECT public.get_my_system_ids()))
  WITH CHECK (system_id IN (SELECT public.get_my_system_ids()));


-- 3-7. system_members (센터 소속 멤버 목록)
-- 소속 센터의 동료 목록만 조회 가능하며, 센터장(systems.owner_id)만 관리 가능
CREATE POLICY "system_members_select_policy" ON public.system_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    system_id IN (SELECT public.get_my_system_ids())
  );

CREATE POLICY "system_members_all_owner_policy" ON public.system_members
  FOR ALL TO authenticated
  USING (
    system_id IN (
      SELECT id FROM public.systems WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    system_id IN (
      SELECT id FROM public.systems WHERE owner_id = auth.uid()
    )
  );


-- 3-8. sessions (AI 녹음 세션)
-- 본인이 녹음한 세션이거나 소속 센터 고객의 녹음 세션만 접근 허용
CREATE POLICY "sessions_system_policy" ON public.sessions
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    client_id IN (
      SELECT id FROM public.clients 
      WHERE system_id IN (SELECT public.get_my_system_ids())
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    client_id IN (
      SELECT id FROM public.clients 
      WHERE system_id IN (SELECT public.get_my_system_ids())
    )
  );


-- 3-9. results (AI 임상 차팅 결과)
-- 연관된 녹음 세션에 접근할 권한이 있는 경우에만 차팅 결과 접근 허용
CREATE POLICY "results_system_policy" ON public.results
  FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.sessions
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.sessions
    )
  );


-- 3-10. chunks (음성 분할 데이터)
-- 연관된 녹음 세션에 접근할 권한이 있는 경우에만 청크 정보 접근 허용
CREATE POLICY "chunks_system_policy" ON public.chunks
  FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.sessions
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.sessions
    )
  );


-- 3-11. transcriptions (STT 텍스트 데이터)
-- 연관된 분할 데이터(chunks)에 접근 권한이 있는 경우에만 텍스트 데이터 접근 허용
CREATE POLICY "transcriptions_system_policy" ON public.transcriptions
  FOR ALL TO authenticated
  USING (
    chunk_id IN (
      SELECT id FROM public.chunks
    )
  )
  WITH CHECK (
    chunk_id IN (
      SELECT id FROM public.chunks
    )
  );


-- ============================================
-- 4. Storage 'audio-records' 버킷 RLS 정책 강화
-- ============================================
DROP POLICY IF EXISTS "Allow public select from audio-records" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated select from audio-records" ON storage.objects;

CREATE POLICY "Allow authenticated select from audio-records"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'audio-records');

-- ============================================
-- 5. 기존 데이터 소급 마이그레이션 (과거 구조 완벽 호환)
-- ============================================

-- 5-1. profiles 테이블의 system_id가 NULL인 경우, system_members의 system_id로 자동 채워줍니다.
UPDATE public.profiles p
SET system_id = m.system_id
FROM public.system_members m
WHERE p.id = m.user_id 
  AND p.system_id IS NULL 
  AND m.status = 'approved';

-- 5-2. (핵심 원인 해결) 과거 방식으로 생성되어 profiles에만 system_id가 있고 system_members에는 누락된 멤버 복구
INSERT INTO public.system_members (system_id, user_id, status, role)
SELECT p.system_id, p.id, 'approved', 'staff'
FROM public.profiles p
WHERE p.system_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.system_members m 
    WHERE m.user_id = p.id AND m.system_id = p.system_id
  );

-- 5-3. systems 생성자(owner)이면서 system_members에 누락된 경우 복구
INSERT INTO public.system_members (system_id, user_id, status, role)
SELECT s.id, s.owner_id, 'approved', 'owner'
FROM public.systems s
WHERE s.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.system_members m 
    WHERE m.user_id = s.owner_id AND m.system_id = s.id
  );

-- ⚠️ [알림] 혹시 기존 고객(clients) 및 예약(appointments) 테이블에 system_id가 NULL인 경우:
-- 아래 구문을 사용하여 적절한 system_id로 일괄 채워주셔야 화면에 나타납니다.
-- UPDATE public.clients SET system_id = '여기에_실제_system_id_입력' WHERE system_id IS NULL;
-- UPDATE public.appointments SET system_id = '여기에_실제_system_id_입력' WHERE system_id IS NULL;

-- ============================================
-- 6. 데이터 무결성 강제 (유령 데이터 생성 원천 차단)
-- ============================================

-- 과거에 설치했던 'system_id 강제 주입 트리거'를 모두 제거합니다.
-- 소속(system_id)이 누락된 비정상 요청이 들어오면 억지로 채우지 않고 에러를 발생(저장 차단)시켜 데이터 무결성을 보호합니다.
DROP TRIGGER IF EXISTS tr_set_client_system_id ON public.clients;
DROP FUNCTION IF EXISTS public.set_client_system_id();

DROP TRIGGER IF EXISTS tr_set_appointment_system_id ON public.appointments;
DROP FUNCTION IF EXISTS public.set_appointment_system_id();

-- [권장] 스키마 레벨에서 system_id를 필수값(NOT NULL)으로 강제합니다.
-- (단, 이 구문을 실행하려면 기존 데이터 중에 system_id가 NULL인 레코드가 없어야 합니다.)
-- ALTER TABLE public.clients ALTER COLUMN system_id SET NOT NULL;
-- ALTER TABLE public.appointments ALTER COLUMN system_id SET NOT NULL;
-- ALTER TABLE public.sessions ALTER COLUMN system_id SET NOT NULL;

-- ============================================
-- 7. 대시보드(Dashboard) 앱 전용 레거시 RLS 정책 복구
-- (1번 단계에서 일괄 삭제된 상황판 테이블들의 접근 권한을 다시 열어줍니다)
-- ============================================

-- beds
CREATE POLICY "beds_owner_select" ON public.beds FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "beds_owner_insert" ON public.beds FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "beds_owner_update" ON public.beds FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "beds_owner_delete" ON public.beds FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "beds_viewer_select" ON public.beds FOR SELECT TO anon USING (true);

-- treatment_types
CREATE POLICY "treatment_types_owner_select" ON public.treatment_types FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_types_owner_insert" ON public.treatment_types FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "treatment_types_owner_update" ON public.treatment_types FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_types_owner_delete" ON public.treatment_types FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_types_viewer_select" ON public.treatment_types FOR SELECT TO anon USING (true);

-- treatment_history
CREATE POLICY "treatment_history_owner_select" ON public.treatment_history FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_history_owner_insert" ON public.treatment_history FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "treatment_history_owner_update" ON public.treatment_history FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_history_owner_delete" ON public.treatment_history FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "treatment_history_viewer_select" ON public.treatment_history FOR SELECT TO anon USING (true);

-- layout_settings
CREATE POLICY "layout_settings_owner_select" ON public.layout_settings FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "layout_settings_owner_insert" ON public.layout_settings FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "layout_settings_owner_update" ON public.layout_settings FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "layout_settings_viewer_select" ON public.layout_settings FOR SELECT TO anon USING (true);

-- layout_objects
CREATE POLICY "layout_objects_owner_select" ON public.layout_objects FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "layout_objects_owner_insert" ON public.layout_objects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "layout_objects_owner_update" ON public.layout_objects FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "layout_objects_owner_delete" ON public.layout_objects FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "layout_objects_viewer_select" ON public.layout_objects FOR SELECT TO anon USING (true);

COMMIT;
