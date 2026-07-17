// Supabase Edge Function: poll-jobs
// Soniox STT 비동기 작업의 완료 상태를 주기적으로 체크하여 완료 시 GPT 정제 및 SOAP 차트/가이드를 생성하고 DB에 기록합니다.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

interface Token {
  text: string;
  speaker?: string;
}

interface Segment {
  speaker: string;
  text: string;
}

// Soniox 토큰들을 화자별로 그룹화하는 헬퍼 함수
function groupTokensBySpeaker(transcript: any): Segment[] {
  if (transcript.segments && transcript.segments.length > 0) {
    return transcript.segments.map((seg: any) => ({
      speaker: seg.speaker || "1",
      text: seg.text || "",
    }));
  }

  const tokens: Token[] = transcript.tokens || [];
  if (tokens.length === 0) {
    const text = transcript.text || "";
    return text ? [{ speaker: "1", text }] : [];
  }

  const segments: Segment[] = [];
  let currentSpeaker = "";
  let currentWords: string[] = [];

  for (const token of tokens) {
    const speaker = token.speaker || "1";
    const text = token.text || "";

    if (speaker !== currentSpeaker) {
      if (currentWords.length > 0) {
        segments.push({
          speaker: currentSpeaker || "1",
          text: currentWords.join("").trim(),
        });
      }
      currentSpeaker = speaker;
      currentWords = [text];
    } else {
      currentWords.push(text);
    }
  }

  if (currentWords.length > 0) {
    segments.push({
      speaker: currentSpeaker || "1",
      text: currentWords.join("").trim(),
    });
  }

  return segments;
}

// 화자 구분이 들어간 텍스트로 포맷팅
function formatDiarizedTranscript(segments: Segment[]): string {
  const lines: string[] = [];
  let prevSpeaker = "";

  for (const seg of segments) {
    const speaker = seg.speaker || "알 수 없음";
    const text = (seg.text || "").trim();

    if (!text) continue;

    if (speaker !== prevSpeaker) {
      if (lines.length > 0) {
        lines.push("");
      }
      lines.push(`[화자 ${speaker}]`);
      prevSpeaker = speaker;
    }

    lines.push(text);
  }

  return lines.join("\n");
}

// 프롬프트 정의
const REFINE_SYSTEM_PROMPT = `당신은 재활운동센터 임상 환경에 특화된 한국어 음성 인식(STT) 교정 전문가입니다.
화자 라벨이 포함된 녹취록을 받아, 아래 규칙에 따라 보정하세요.

## 임상 기록 교정 규칙 (핵심)
1. **전문 용어 교정**: 발음이 뭉개지거나 비슷하게 잘못 인식된 단어를 해부학 및 운동 치료 문맥을 고려하여 교정하세요.
   - 예: "성모님 문침" → "승모근 뭉침"
   - 예: "물리집 아닌" → "물리치료 만약에"
   - 예: 통증 관련 문맥에서 "방사선" → "방사통"
   - 해부학 용어(구용어, 신용어) 및 재활 세션 기법을 적극적으로 유추하여 복원하세요.
2. **환자/치료 용어 필터링**: 기존의 '치료'는 '재활세션', '환자'는 '고객', '치료사'는 '강사', 'RE;MOVE' 명칭은 '운동센터'로 각각 순화하여 교정하세요.

## 일반 교정 규칙
3. **오역 수정**: 문맥상 잘못 인식된 일반 단어를 교정하세요. (예: "숙령 월이" → "생년월일")
4. **필러 제거**: "어...", "그...", "아...", "뭐..." 등 의미 없는 단어를 제거하세요.
   **단, 고객의 통증 호소나 동의를 나타내는 짧은 감탄사("아!", "악!", "네", "아파요")는 임상적 가치가 매우 높으므로 절대 제거하지 마세요.**
5. **문장 부호**: 적절한 마침표, 쉼표, 물음표를 사용하여 가독성을 높이세요.
6. **형식 유지**: [화자명] 형식의 라벨과 줄바꿈 구조는 절대 변경하지 마세요.

## 출력
보정된 전체 텍스트를 그대로 출력하세요. JSON이 아닌 일반 텍스트로 출력합니다.`;

function getChartPrompt(profession: string): string {
  const prof = (profession || "pt").toLowerCase();
  let profName = "물리재활";
  let objHint = "기능 검사(ROM, MMT 등) 및 평가 결과";
  let diagHint = "재활 운동 관점의 기능적 평가 진단명";

  if (prof === "pt") {
    profName = "물리재활";
    objHint = "기능 검사(ROM, MMT 등) 및 평가 결과";
    diagHint = "기능 운동 진단명";
  } else if (prof === "st") {
    profName = "언어재활";
    objHint = "조음, 유창성, 음성, 언어 이해/표현력 등 평가 결과";
    diagHint = "언어재활 기능 진단명";
  } else if (prof === "ot") {
    profName = "작업재활";
    objHint = "ADL, 소근육 기능, 인지 기능, 감각 통합 등 평가 결과";
    diagHint = "작업재활 기능 진단명";
  } else {
    profName = "기타 재활";
    objHint = "기능 검사 및 평가 결과";
    diagHint = "기능적 운동 평가명";
  }

  return `당신은 숙련된 ${profName} 임상 기록 전문가입니다.
강사(재활치료사)와 고객(환자)의 대화 녹취록(및 추가 제공된 수기 메모)을 분석하여 아래 JSON 형식으로 정리하세요.
모든 문서 명칭 및 설명에는 '치료' 대신 '재활세션', '치료사' 대신 '강사', '환자' 대신 '고객', 'RE;MOVE' 대신 '운동센터' 용어를 일관되게 사용하십시오.

## 출력 형식 (JSON)
{
  "clinical_record": {
    "subjective": {
      "chief_complaint": "주호소 및 증상 발생 시기",
      "pain_scale": "언급된 통증 수치(VAS 등)",
      "aggravating_easing_factors": "증상 악화 또는 완화 요인",
      "precautions_contraindications": "과거력 및 주의사항"
    },
    "objective": {
      "observation_posture": "시각적 관찰 소견",
      "physical_examination": "${objHint}"
    },
    "assessment": {
      "therapist_diagnosis": "녹취록 및 수기 메모에 명시된 강사의 관점 및 평가 결과",
      "ai_diagnosis_inferred": "전체 문맥을 기반으로 AI가 자체적으로 추론한 ${diagHint} 및 분석 관점",
      "clinical_impression": "종합적인 운동 재활 임상 추론",
      "progress": "상태 변화 및 호전 정도"
    },
    "plan": {
      "treatment_performed": "오늘 실시한 재활세션 중재 내용",
      "home_exercise": "지도한 자가 운동 및 교육 내용",
      "future_plan": "향후 재활세션 계획"
    }
  },
  "red_flags_detected": [
    "감지된 위험 징후 (없으면 빈 배열 [])"
  ],
  "rapport_data": {
    "personal_background": "가족 관계, 직업, 취미, 생활 환경 등 고객을 개인적으로 이해하고 기억하는 데 도움이 되는 배경 정보",
    "patient_preferences": "세션 진행 시 선호하는 방식, 대화 주제 등 특이사항",
    "psychosocial_factors": "심리적 상태, 사회적 지지 체계 등 심리사회적 요인",
    "compliance_attitude": "세션 참여도 및 태도",
    "upcoming_events": ["고객이 직접 언급한 향후 일정(여행, 행사 등). 없으면 빈 배열 []"],
    "follow_up_cues": ["다음 대화 시 아이스브레이킹으로 활용할 수 있는 구체적인 주제. 없으면 빈 배열 []"]
  }
}

## 규칙
- 의학 및 운동재활 용어는 필요한 경우 영어 원문을 병기하세요.
- 대화나 메모에서 언급되지 않은 항목은 "언급 없음"으로 기록하거나 빈 배열([])로 두세요. 추측으로 채우지 마세요.
- 수기 메모에 담긴 구체적인 수치가 녹취록 내용보다 우선순위가 높습니다.`;
}

function getGuidePrompt(profession: string): string {
  const prof = (profession || "pt").toLowerCase();
  let profName = "물리재활";
  if (prof === "pt") profName = "물리재활";
  else if (prof === "st") profName = "언어재활";
  else if (prof === "ot") profName = "작업재활";
  else profName = "기타 재활";

  return `당신은 친절한 ${profName} 세션 안내 도우미입니다.
강사와 고객의 대화 녹취록 및 수기 기록을 분석하여, 고객이 쉽게 이해할 수 있는 재활세션 요약문을 작성하세요.
모든 텍스트에서 '치료'->'재활세션', '치료사'->'강사', '환자'->'고객', 'RE;MOVE'->'운동센터' 단어로 바꾸어 작성하십시오.

## 출력 형식 (마크다운)

### 오늘의 재활세션 요약
(오늘 어떤 재활운동과 관리를 받았는지 전문 용어 없이 쉽게 설명)

### 일상에서 주의할 점
(고객님이 일상생활에서 지켜야 할 자세나 스트레칭 등을 구체적으로 설명)

### 다음 방문 안내
(다음 재활세션 일정과 진행할 내용을 간략히 안내)

## 규칙
- 정중한 존댓말을 사용하세요.
- 전문 용어는 피하고 친절하고 쉽게 설명하세요.
- 언급되지 않은 내용은 절대로 임의로 추가하지 마세요.`;
}

Deno.serve(async (req) => {
  // CORS 대응
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sonioxApiKey = Deno.env.get("SONIOX_API_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[poll-jobs] Scanning for pending transcriptions...");

    // 1. 대기 상태의 transcription 작업들을 가져옴 (한번에 최대 10개)
    const { data: pendingJobs, error: fetchErr } = await adminClient
      .from("transcriptions")
      .select("id, chunk_id, job_id, status")
      .eq("status", "pending")
      .limit(10);

    if (fetchErr) {
      throw new Error(`Failed to fetch pending jobs: ${fetchErr.message}`);
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log("[poll-jobs] No pending transcriptions found.");
      return new Response(JSON.stringify({ status: "success", processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    let processedCount = 0;

    for (const job of pendingJobs) {
      console.log(`[poll-jobs] Checking status for job: ${job.job_id} (Chunk: ${job.chunk_id})`);

      // Soniox 비동기 전사 결과 조회
      const sonioxRes = await fetch(`https://api.soniox.com/v1/transcriptions/${job.job_id}`, {
        headers: {
          "Authorization": `Bearer ${sonioxApiKey}`,
        },
      });

      if (!sonioxRes.ok) {
        console.error(`[poll-jobs] Soniox API fetch failed for job ${job.job_id}: ${sonioxRes.status}`);
        continue;
      }

      const transcriptData = await sonioxRes.json();
      const jobStatus = transcriptData.status;

      if (jobStatus === "completed") {
        console.log(`[poll-jobs] Job ${job.job_id} completed. Starting analysis...`);

        try {
          // 1) 화자별 텍스트 파싱
          const segments = groupTokensBySpeaker(transcriptData);
          const rawFormatted = formatDiarizedTranscript(segments);

          if (!rawFormatted.trim()) {
            throw new Error("STT returned empty transcript.");
          }

          // chunks에 물린 session 및 메타 정보 획득
          const { data: chunkData } = await adminClient
            .from("chunks")
            .select("session_id, file_path")
            .eq("id", job.chunk_id)
            .single();

          if (!chunkData) {
            throw new Error(`Chunk ${job.chunk_id} not found in database.`);
          }

          const { data: session } = await adminClient
            .from("sessions")
            .select("user_id, profession, memo")
            .eq("id", chunkData.session_id)
            .single();

          if (!session) {
            throw new Error(`Session ${chunkData.session_id} not found.`);
          }

          // 2) OpenAI API를 이용한 보정 & 차트/가이드 생성
          // ① 텍스트 정제
          const refineRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: REFINE_SYSTEM_PROMPT },
                { role: "user", content: rawFormatted },
              ],
              temperature: 0.3,
            }),
          });
          if (!refineRes.ok) throw new Error("OpenAI Refine error: " + (await refineRes.text()));
          const refineJson = await refineRes.json();
          const refinedTranscript = refineJson.choices[0].message.content.trim();

          // ② SOAP 차트 데이터 생성
          const chartUserContent = `아래는 ${session.profession.toUpperCase()} 세션의 녹취록입니다.\n\n${refinedTranscript}${
            session.memo ? `\n\n[추가 수기 메모]\n${session.memo}` : ""
          }`;
          
          const chartRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: getChartPrompt(session.profession) },
                { role: "user", content: chartUserContent },
              ],
              temperature: 0.1,
              response_format: { type: "json_object" },
            }),
          });
          if (!chartRes.ok) throw new Error("OpenAI SOAP Chart error: " + (await chartRes.text()));
          const chartJson = await chartRes.json();
          const chartData = JSON.parse(chartJson.choices[0].message.content.trim());

          // ③ 환자용 가이드 생성
          const guideRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: getGuidePrompt(session.profession) },
                { role: "user", content: chartUserContent },
              ],
              temperature: 0.3,
            }),
          });
          if (!guideRes.ok) throw new Error("OpenAI Patient Guide error: " + (await guideRes.text()));
          const guideJson = await guideRes.json();
          const guideContent = guideJson.choices[0].message.content.trim();

          // 3) 결과 DB 저장 (results 및 chunks/transcriptions 상태 변경)
          await adminClient.from("results").insert({
            session_id: chunkData.session_id,
            chunk_id: job.chunk_id,
            raw_transcript: rawFormatted,
            refined_transcript: refinedTranscript,
            chart_data: chartData,
            guide_content: guideContent,
          });

          await adminClient
            .from("transcriptions")
            .update({
              raw_transcript: rawFormatted,
              speaker_labels: transcriptData.tokens ? JSON.stringify(transcriptData.tokens) : null,
              status: "completed"
            })
            .eq("id", job.id);

          await adminClient
            .from("chunks")
            .update({ status: "done" })
            .eq("id", job.chunk_id);

          // 4) 임시 스토리지 청크 파일 즉시 삭제 (보안 조치)
          try {
            // file_path에서 파일명 추출 (예: 'audio_chunks/uuid.wav' -> 'uuid.wav')
            const pathParts = chunkData.file_path.split("/");
            const fileName = pathParts[pathParts.length - 1];
            console.log(`[poll-jobs] Cleaning up temporary storage file: ${fileName}`);
            await adminClient.storage.from("audio-records").remove([`${session.user_id}/${fileName}`]);
          } catch (storageErr) {
            console.error("[poll-jobs] Failed to delete audio from storage:", storageErr);
          }

          // 5) Soniox 파일 및 전사 자원 삭제
          try {
            await fetch(`https://api.soniox.com/v1/transcriptions/${job.job_id}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${sonioxApiKey}` },
            });
            if (transcriptData.file_id) {
              await fetch(`https://api.soniox.com/v1/files/${transcriptData.file_id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${sonioxApiKey}` },
              });
            }
          } catch (sonioxErr) {
            console.error("[poll-jobs] Soniox resource cleanup failed:", sonioxErr);
          }

          processedCount++;

        } catch (err: any) {
          console.error(`[poll-jobs] OpenAI pipeline failed for job ${job.job_id}:`, err);
          
          await adminClient
            .from("transcriptions")
            .update({ status: "failed", error_message: err.message })
            .eq("id", job.id);

          await adminClient
            .from("chunks")
            .update({ status: "failed" })
            .eq("id", job.chunk_id);
        }

      } else if (jobStatus === "failed") {
        console.error(`[poll-jobs] Soniox transcription failed for job: ${job.job_id}`);
        
        await adminClient
          .from("transcriptions")
          .update({ status: "failed", error_message: "Soniox transcription failed" })
          .eq("id", job.id);

        await adminClient
          .from("chunks")
          .update({ status: "failed" })
          .eq("id", job.chunk_id);
      }
    }

    return new Response(JSON.stringify({ status: "success", processed: processedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[poll-jobs] Critical error:", error);
    return new Response(JSON.stringify({ detail: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
