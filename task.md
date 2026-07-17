# AI 음성 차팅 파이프라인 구현 할 일 목록
이 파일은 30분 단위 청킹 및 Supabase Edge Function을 활용한 음성 차팅 파이프라인의 작업 단계를 추적하고 상태를 관리하는 태스크 리스트입니다.

---

- `[x]` DB 마이그레이션 적용
  - `[x]` `chunks`, `transcriptions`, `results` 테이블 스키마 DDL 작성
  - `[x]` RLS 정책 및 인덱스 설정
- `[x]` Supabase Storage 설정
  - `[x]` `audio_chunks` 버킷 생성 스크립트 작성
- `[x]` Edge Functions 신규 구현
  - `[x]` `process-chunk` 기능 (Soniox Files API 연동) 작성
  - `[x]` `poll-jobs` 기능 (Soniox 상태 폴링 및 OpenAI GPT-4o-mini 연동) 작성
- `[x]` 프론트엔드 `AudioUploadForm.tsx` 수정
  - `[x]` 브라우저 내 오디오 파일 청킹 로직 구현
  - `[x]` 청크 순차 업로드 및 Edge Function 호출 구현
  - `[x]` Realtime 상태 구독 및 UI 실시간 진행률 표시 구현
- `[x]` 전체 통합 테스트 및 검증
  - `[x]` 짧은 오디오 청크 업로드 테스트
  - `[x]` 전체 차트/가이드 결과물 DB 영구 보존 및 오디오 삭제 확인
