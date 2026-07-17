# Edge Function 기반 30분 청크 음성 차팅 파이프라인 설계
이 파일은 Supabase Edge Functions 및 Storage를 기반으로 대용량 음성 녹음을 30분 단위로 청킹하여 처리하는 서버리스 파이프라인 설계 기획안을 포함합니다.

---

## 1️⃣ 목표  
- 30분(≈ 15 MB Opus) 청크 기반으로 **최대 10시간(20 청크)** 녹음 처리  
- **Supabase Edge Functions, Storage, PostgreSQL** 만 사용  
- **Sonox STT + 다이아리제이션** → **OpenAI GPT-4o-mini** 로 텍스트 정제·차트·가이드 생성  
- 원본 음성 파일은 **저장하지 않으며** 7일 후 자동 삭제 (프라이버시 보호)  

## 2️⃣ 전체 흐름 (Mermaid)  

```mermaid
graph LR
    A[클라이언트] -->|1. 30분 청크 업로드| B[Supabase Storage (audio_chunks/)]
    B -->|2. 메타 저장| C[Supabase DB: chunks 테이블]
    C -->|3. Edge Function 호출| D[processChunk (HTTP POST)]
    D -->|4. Sonox Files API (비동기) | E[Sonox 서버]
    E -->|5. job_id 반환| D
    D -->|6. transcriptions 테이블에 job_id 저장| F[Supabase DB: transcriptions]
    F -->|7a. Webhook OR 7b. cron polling| G[Edge Function: jobResult / pollJobs]
    G -->|8. GPT-4o-mini 호출| H[OpenAI API]
    H -->|9. 차트·가이드 결과| I[Supabase DB: results 테이블]
    I -->|10. Realtime 구독| J[클라이언트 UI (진행 바·결과 표시)]
```  

## 3️⃣ 핵심 컴포넌트  

| 컴포넌트 | 역할 | 비고 |
|----------|------|------|
| **클라이언트** | MediaRecorder → 30분 청크 자동 생성 및 업로드 | Opus ≈ 15 MB, 업로드 후 Public URL 확보 |
| **Supabase Storage** | `audio_chunks/` 버킷, public URL 관리 | Lifecycle Rule 적용: **7일 자동 삭제**로 보관 기간 최소화 |
| **DB – `chunks`** | 청크 메타데이터(`batch_id`, `segment_index`, `file_path`, `status`) | `status`: uploaded → queued → processing → done / failed |
| **Edge Function `processChunk`** | POST `/processChunk` 호출 수신<br>• Sonox Files API 호출 (audio_url, diarization 지정)<br>• `job_id`를 `transcriptions`에 매핑 후 저장<br>• `chunks.status` = queued 변경 | 150초 실행 제한을 피하기 위해 **비동기 요청 후 즉시 응답** |
| **DB – `transcriptions`** | Sonox `job_id` ↔ `chunk_id` 매핑 및 전사/화자 구분 결과 저장 | `job_id`, `raw_transcript`, `speaker_labels`, `status` 기록 |
| **결과 수집** | **옵션 A**: Webhook (`jobResult` Endpoint)<br>**옵션 B**: Cron (`pollJobs` Function, 5분 주기로 실행) | Webhook 사용 시 실시간 완료 처리 가능, Cron 사용 시 주기적 동기화 |
| **Edge Function `jobResult` / `pollJobs`** | • 완료된 `job_id`의 전사 데이터 수집<br>• **OpenAI GPT-4o-mini** 호출 → 정제 텍스트, 차트 JSON, 가이드 MD 생성<br>• `results` 테이블 저장 및 `chunks.status` = done 업데이트 | 분석 파이프라인의 최종 처리 및 서버리스 인프라 완결 |
| **DB – `results`** | 정제 텍스트, SOAP 차트, 환자/강사용 가이드 저장 | `refined_transcript`, `chart_json`, `guide_md` 보관 (영구 저장) |
| **Realtime UI** | Supabase Realtime을 통한 데이터베이스 상태 구독 | 사용자의 화면에 청크별 상태, 전체 분석 진행률을 실시간 업데이트 |

## 4️⃣ 데이터 스키마 (SQL)  

```sql
-- 청크 메타
create table chunks (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid not null,               -- 하루 전체 녹음 ID
  segment_index int not null,           -- 0-based 구간 순번
  file_path text not null,              -- public URL
  status text not null default 'uploaded', -- uploaded|queued|processing|done|failed
  created_at timestamp with time zone default now()
);

-- Sonox 작업 매핑 및 원본 전사 저장
create table transcriptions (
  id uuid primary key default uuid_generate_v4(),
  chunk_id uuid references chunks(id) on delete cascade,
  job_id text not null,                 -- Sonox 파일 ID
  raw_transcript text,                  -- 원본 전사 텍스트
  speaker_labels jsonb,                 -- [{speaker:"spk_1", start:0, end:12.3}, …]
  status text not null default 'pending', -- pending|completed|failed
  error_message text,
  created_at timestamp with time zone default now()
);

-- 최종 차트·가이드 결과 및 보정된 텍스트 저장
create table results (
  id uuid primary key default uuid_generate_v4(),
  chunk_id uuid references chunks(id) on delete cascade,
  refined_transcript text,               -- AI 보정 전사 텍스트
  chart_json jsonb,                     -- SOAP 차트 결과
  guide_md text,                        -- 환자 가이드라인
  created_at timestamp with time zone default now()
);
```

> [!NOTE]  
> - 테이블 설계에 `user_id`를 추가하고 Row-Level Security(RLS) 정책을 활성화하여 사용자의 데이터 보안을 충족합니다.
> - 음성 원본 파일은 Storage에 일시 저장 후 Lifecycle Rule에 의해 자동 파기되지만, 텍스트 형태의 **전사 내용**, **AI 보정 내용**, **차트/가이드 결과**는 데이터베이스에 안전하게 영구 저장됩니다.

## 5️⃣ 비용 및 한도 시뮬레이션 (Supabase Pro Plan 기준)  

| 구분 | 예상 사용량 (하루 10시간 = 20청크 기준) | Pro Plan 기본 한도 대비 비율 |
|------|---------------------------------------|----------------------------|
| **Storage 저장 용량** | 300 MB (20 청크 × 15 MB) | 5 GB 중 **6%** |
| **Edge Function 호출** | processChunk 20회 + pollJobs 288회 + jobResult 20회 ≈ 328회 | 500k 호출 중 **0.07%** |
| **Egress (네트워크 전송량)** | Storage → Sonox + 결과 전송 ≈ 600 MB | 2 GB 중 **30%** |
| **DB I/O 및 저장 용량** | 20개 청크 레코드 생성 (수십 KB) | 무제한에 가까움 (충분) |

---
*개발(코딩 및 배포)은 진행하지 않고, 설계 및 스키마 구조 기록용으로 작성되었습니다.*
