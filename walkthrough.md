# AI 음성 차팅 파이프라인 구현 워크스루
이 파일은 Supabase Edge Functions 및 30분 단위 오디오 청킹을 기반으로 새롭게 리팩터링된 AI 음성 차팅 시스템의 작업 내용 및 마이그레이션 가이드를 담고 있습니다.

---

## 🛠️ 작업 완료 내역

| 컴포넌트 | 변경 사항 | 상세 내용 |
|----------|-----------|-----------|
| **DB 마이그레이션** | [supabase_chunk_pipeline_migration.sql](file:///c:/Tools4thept/supabase_chunk_pipeline_migration.sql) 생성 | `chunks`, `transcriptions` 테이블 생성 DDL 및 RLS 보안 설정 정책 정의 |
| **Edge Function ①** | [process-chunk](file:///c:/Tools4thept/supabase/functions/process-chunk/index.ts) 신규 구현 | 30분 단위 오디오 public URL을 받아 Soniox STT 비동기 태스크를 등록하고 DB에 `job_id`를 적재 |
| **Edge Function ②** | [poll-jobs](file:///c:/Tools4thept/supabase/functions/poll-jobs/index.ts) 신규 구현 | 대기 중인 STT 작업을 모니터링하여 완료 시 GPT-4o-mini로 텍스트 정제, SOAP 차트 JSON 및 마크다운 가이드 생성 후 `results` 저장 |
| **설정 보완** | [config.toml](file:///c:/Tools4thept/supabase/config.toml) 업데이트 | 신규 2개 Edge Function(`process-chunk`, `poll-jobs`)의 Deno 엔트리포인트 등록 |
| **프론트엔드 연동** | [AudioUploadForm.tsx](file:///c:/Tools4thept/book/src/features/charting/components/AudioUploadForm.tsx) 리팩터링 | 브라우저 내 메모리 세이프한 30분 오디오 청킹 헬퍼 추가, 비동기 순차 업로드 및 진행 현황 그리드 보드 UI 구현 |

---

## ⚠️ 데이터베이스 적용 가이드 (필수)
현재 로컬 개발 환경에서 원격 Supabase DB(`hcgrhgjobemtyvkexppi.supabase.co`)를 직접 사용 중이므로, 다음 DDL 스크립트를 실행해 주셔야 새로운 테이블들이 생성되고 시스템이 정상 작동합니다.

1. **[supabase_chunk_pipeline_migration.sql](file:///c:/Tools4thept/supabase_chunk_pipeline_migration.sql)** 파일의 내용을 전체 복사합니다.
2. [Supabase Dashboard](https://supabase.com)에 로그인 후, 해당 프로젝트의 **SQL Editor**로 이동합니다.
3. 복사한 SQL 쿼리를 붙여넣고 **Run** 버튼을 클릭하여 실행합니다.

---

## 🔍 향후 검증 계획
1. 원격 DB 마이그레이션 쿼리가 정상 실행되었는지 확인합니다.
2. `npx supabase functions deploy process-chunk` 및 `npx supabase functions deploy poll-jobs` 명령어로 Edge Function들을 원격지에 배포합니다.
3. 30분 미만의 음성 및 대용량 음성을 프론트엔드에서 직접 올려 청크 분석 현황 보드가 실시간으로 업데이트되고 AI 차트 결과가 저장되는지 테스트합니다.
