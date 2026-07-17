-- 물리치료실 상황판 및 예약/임상 차팅 데이터베이스 통합 DDL 마이그레이션 스크립트
-- 지금까지 컬럼 명칭 변경(patient -> client) 및 누락 필드 추가, 강사 트리거를 일괄 반영합니다.

-- =========================================================================
-- 1. 상황판 및 이력 데이터 patient -> client 명칭 통일
-- =========================================================================
-- beds 테이블 (이미 존재하는 client_memo 외에 patient_name만 변경)
ALTER TABLE beds RENAME COLUMN patient_name TO client_name;

-- treatment_history 테이블 컬럼명 변경
ALTER TABLE treatment_history RENAME COLUMN patient_name TO client_name;
ALTER TABLE treatment_history RENAME COLUMN patient_memo TO client_memo;

-- =========================================================================
-- 2. AI 차팅 세션(sessions) 테이블 patient -> client 명칭 통일
-- =========================================================================
ALTER TABLE sessions RENAME COLUMN patient_id TO client_id;
ALTER TABLE sessions RENAME COLUMN patient_name TO client_name;

-- =========================================================================
-- 3. 예약 고객(clients) 테이블 누락 컬럼 생성 (성별 및 생년월일)
-- =========================================================================
ALTER TABLE clients ADD COLUMN gender text;
ALTER TABLE clients ADD COLUMN birth_date date;

-- =========================================================================
-- 4. 강사 프로필(profiles) 데이터 복구 및 자동 연동 트리거 생성
-- =========================================================================
-- 4-1. 기존 가입된 계정 강사 프로필로 강제 복구
INSERT INTO public.profiles (id, full_name, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email, '새 강사'), 'STAFF'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4-2. 신규 회원가입 시 프로필 테이블 자동 삽입 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '새 강사'),
    'STAFF'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4-3. 트리거 생성 및 적용
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
