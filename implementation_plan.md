# AI 음성 차팅 Edge Function 기반 파이프라인 구현 계획
이 파일은 프로젝트 내에 30분 단위 청킹 및 Supabase Edge Function을 활용한 AI 음성 차팅 파이프라인을 구축하기 위한 세부 구현 계획을 담고 있습니다.

---

## 1. 개요 및 목표
- 대용량 음성 녹음(최대 10시간)을 지원하기 위해 클라이언트 측에서 30분 단위로 음성을 청킹하여 업로드하는 구조를 구현합니다.
- 서버리스 환경(Supabase Edge Functions, Storage, DB)과 Soniox STT, OpenAI GPT-4o-mini API를 연동하여 완전한 분석 파이프라인을 구축합니다.
- 원본 오디오 파일은 보안 및 비용 절감을 위해 7일 후 삭제되도록 처리하며, 분석 결과(전사, 보정 데이터, 차트)는 영구 보관합니다.

## 2. 세부 제안 변경 사항

### 2‑1. 데이터베이스 스키마 및 마이그레이션 (`supabase_migration.sql`)
- `chunks`, `transcriptions`, `results` 테이블을 생성하는 DDL 작성 및 실행.
- RLS 정책을 활성화하여 `user_id`를 소유한 강사만 해당 데이터에 접근할 수 있도록 보안 설정.

### 2‑2. Supabase Storage 설정
- `audio_chunks` 버킷을 생성하고, 파일에 대해 public URL을 생성할 수 있도록 설정합니다. (Soniox API에 `audio_url`을 제공해야 하기 때문)
- 버킷에 대해 7일 후 객체가 자동 삭제되도록 Lifecycle Rule DDL 또는 CLI 설정을 구성합니다.

### 2‑3. Supabase Edge Functions 개발
- **`process-chunk` 신규 Edge Function**:
  - 클라이언트로부터 `{ chunk_id, file_path }`를 수신합니다.
  - Soniox Files API를 호출하여 비동기 STT 및 Diarization(화자 구분) 작업을 등록합니다.
  - 반환된 `job_id`를 `transcriptions` 테이블에 `pending` 상태로 기록하고, `chunks` 테이블의 상태를 `queued`로 변경합니다.
- **`poll-jobs` 신규 Edge Function**:
  - Cron 또는 주기적 호출을 통해 `transcriptions`에서 `pending` 상태인 레코드를 가져옵니다.
  - Soniox API를 조회하여 작업 완료 여부를 체크합니다.
  - 완료 시, Raw 전사 및 화자 라벨을 저장한 뒤 **OpenAI GPT-4o-mini**를 호출하여 정제된 텍스트와 SOAP 차트 JSON, 가이드 Markdown을 생성하여 `results`에 저장합니다.

### 2‑4. 프론트엔드 연동 (`AudioUploadForm.tsx`)
- 오디오 파일을 브라우저단에서 자바스크립트로 30분 단위로 슬라이싱(청킹)하는 헬퍼 함수를 구현합니다.
- 각 청크를 순차적으로 `audio_chunks` 버킷에 업로드하고, 각 업로드 완료 시 즉시 `process-chunk` Edge Function을 호출하는 비동기 업로드 파이프라인을 작성합니다.
- 각 청크의 진행 상태(`uploaded` -> `queued` -> `processing` -> `done` / `failed`)를 DB Realtime 구독을 통해 화면에 실시간 진행률과 개별 상태바로 렌더링합니다.

---

## 3. 검증 및 테스트 계획
- **수동 테스트**: 약 5~10분 분량의 테스트용 음성 파일을 2~3개의 짧은 청크로 분할하여 업로드한 후, DB 상태 변경 및 최종 AI 차트 생성 여부 확인.
- **프로 플랜 예산 점검**: 10시간 기준 청크 업로드와 API 요청이 한도를 넘지 않는지 모니터링 시스템 구축.
