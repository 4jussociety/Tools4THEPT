# AI 음성 차팅 단일 파일 실시간 파이프라인 구축 계획
이 파일은 30분 단위 청킹 로직을 걷어내고, Supabase Storage 및 단일 Edge Function(analyze)에 실시간 완료 대기를 이식하여 성능과 안정성을 극대화하는 계획을 담고 있습니다.

---

## 1. 개요 및 복원 배경
- 사용자 요청에 따라 복잡하고 오디오 컨테이너 손상 위험이 있는 30분 단위 브라우저 청킹 로직을 완전히 걷어냅니다.
- 대신 Supabase Pro 플랜의 파일 크기 확장 한도(최대 5GB)를 활용해 원본 파일 전체를 스토리지에 통째로 한 번에 업로드합니다.
- 기존의 안정적인 단일 파일 분석 Edge Function `analyze`를 기반으로 하되, STT 완료를 함수 내부에서 실시간 대기(최대 100초)하는 하이브리드 지연 단축 로직을 적용하여 실시간 피드백을 제공합니다.

## 2. 세부 구현 계획

### 2-1. 프론트엔드 (`AudioUploadForm.tsx`)
- `sliceWavFile` 및 청킹 관련 상태 변수(`chunkStatuses` 등)를 모두 제거하고 원래의 직관적인 UI로 롤백합니다.
- 단일 오디오 파일을 `audio-records` 버킷에 `${session.user.id}/${sessionId}_processed_audio.${fileExt}` 경로로 다이렉트 업로드합니다.
- 업로드 성공 후 Supabase Edge Function `analyze`를 호출하고, 분석 상태 및 결과를 단일로 수집하여 표시합니다.

### 2-2. Edge Function (`analyze/index.ts` 보완)
- 기존의 클라이언트 호출부(`POST /analyze`)에 **실시간 완료 대기 폴러(최대 100초 대기)**를 이식합니다.
- 100초 이내에 Soniox STT가 완료되면 GPT 텍스트 정제, SOAP 차트 및 가이드 생성을 즉시 연속 실행하여 결과를 DB에 저장하고 200 OK로 반환합니다 (실시간 완료).
- 100초를 초과하는 매우 긴 음성의 경우, 타임아웃 전에 202 Accepted를 반환하고 기존의 **Soniox Webhook Callback**을 통해 백그라운드에서 분석을 완결하도록 이중 보장(하이브리드)합니다.

### 2-3. DB 스키마 롤백 및 정리
- 새로 생성했던 `chunks` 및 `transcriptions` 테이블은 사용하지 않으므로 DDL 마이그레이션 대상에서 제외하거나 필요 시 스키마를 드롭하여 단순함을 유지합니다.
