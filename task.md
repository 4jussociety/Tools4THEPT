# AI 음성 차팅 단일 파일 파이프라인 구현 할 일 목록
이 파일은 단일 파일 오디오 전송 방식과 Edge Function(analyze)의 실시간 완료 대기 기능을 이식하기 위한 세부 구현 및 검증 작업 체크리스트입니다.

---

- `[/]` 프론트엔드 `AudioUploadForm.tsx` 롤백 및 단순화
  - `[ ]` 청킹 로직(`sliceWavFile`) 및 청크 상태 그리드 UI 제거
  - `[ ]` 단일 오디오 파일 direct 업로드 및 `analyze` Edge Function 단일 호출 구현
  - `[ ]` 단일 분석 실시간 진행 피드백 복원
- `[ ]` Edge Function `analyze/index.ts` 최적화 구현
  - `[ ]` 클라이언트 분석 트리거 로직 내에 Soniox 실시간 완료 대기 폴러(최대 100초) 이식
  - `[ ]` 100초 초과 시 202 Accepted 및 Webhook 백그라운드 위임 이중화 처리 검증
- `[ ]` DB 정리 및 최종 통합 테스트
  - `[ ]` `chunks`, `transcriptions` 미사용 테이블 정리
  - `[ ]` 단일 오디오 업로드 실시간 완료 및 5시간 이하 파일 정상 차팅 검증
