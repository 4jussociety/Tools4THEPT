import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface Token {
  text: string;
  speaker?: string;
}

interface Segment {
  speaker: string;
  text: string;
}

// Helper to group Soniox tokens/segments
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

// Helper to format diarized segments into printable transcript
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

// System prompts from original Python code
const REFINE_SYSTEM_PROMPT = `당신은 물리치료 임상 환경에 특화된 한국어 음성 인식(STT) 교정 전문가입니다.
화자 라벨이 포함된 녹취록을 받아, 아래 규칙에 따라 보정하세요.

## 물리치료 임상 기록 교정 규칙 (핵심)
1. **전문 용어 교정**: 발음이 뭉개지거나 비슷하게 잘못 인식된 단어를 물리치료/해부학 문맥을 고려하여 교정하세요.
   - 예: "성모님 문침" → "승모근 뭉침"
   - 예: "물리집 아닌" → "물리치료 만약에"
   - 예: 통증 관련 문맥에서 "방사선" → "방사통"
   - 해부학 용어(구용어, 신용어) 및 치료 기법(도수치료, 체외충격파, TENS, 고주파 등)을 적극적으로 유추하여 복원하세요.

## 일반 교정 규칙
2. **오역 수정**: 문맥상 잘못 인식된 일반 단어를 교정하세요. (예: "숙령 월이" → "생년월일")
3. **필러 제거**: "어...", "그...", "아...", "뭐..." 등 의미 없는 단어를 제거하세요.
   **단, 환자의 통증 호소나 동의를 나타내는 짧은 감탄사("아!", "악!", "네", "아파요")는 임상적 가치가 매우 높으므로 절대 제거하지 마세요.**
4. **반복 제거**: 말을 더듬어 의미 없이 반복된 부분은 한 번만 남기세요.
5. **문장 부호**: 적절한 마침표, 쉼표, 물음표를 사용하여 가독성을 높이세요.
6. **형식 유지**: [화자명] 형식의 라벨과 줄바꿈 구조는 절대 변경하지 마세요.
7. **사실 왜곡 금지**: 발음을 기반으로 교정하되, 대화에 없는 내용을 새롭게 창작하지 마세요.

## 출력
보정된 전체 텍스트를 그대로 출력하세요. JSON이 아닌 일반 텍스트로 출력합니다.`;

function getChartPrompt(profession: string): string {
  const prof = (profession || "pt").toLowerCase();
  let profName = "물리치료";
  let objHint = "기능 검사(ROM, MMT 등) 및 평가 결과";
  let diagHint = "물리치료적 진단명";

  if (prof === "pt") {
    profName = "물리치료";
    objHint = "기능 검사(ROM, MMT 등) 및 평가 결과";
    diagHint = "물리치료적 진단명";
  } else if (prof === "st") {
    profName = "언어재활";
    objHint = "조음, 유창성, 음성, 언어 이해/표현력, 연하 기능 등 평가 결과";
    diagHint = "언어재활적 진단명";
  } else if (prof === "ot") {
    profName = "작업치료";
    objHint = "ADL, 소근육 기능, 인지 기능, 감각 통합 등 평가 결과";
    diagHint = "작업치료적 진단명";
  } else {
    profName = "재활치료";
    objHint = "기능 검사 및 평가 결과";
    diagHint = "기능적 진단명";
  }

  return `당신은 숙련된 ${profName} 임상 기록 전문가입니다.
${profName}사와 환자의 대화 녹취록(및 추가 제공된 수기 메모)을 분석하여 아래 JSON 형식으로 정리하세요.

## 출력 형식 (JSON)
{
  "clinical_record": {
    "subjective": {
      "chief_complaint": "주호소 및 증상 발생 시기",
      "pain_scale": "언급된 통증 수치",
      "aggravating_easing_factors": "증상 악화 또는 완화 요인",
      "precautions_contraindications": "과거력 및 주의사항"
    },
    "objective": {
      "observation_posture": "시각적 관찰 소견",
      "physical_examination": "${objHint}"
    },
    "assessment": {
      "therapist_diagnosis": "녹취록 및 수기 메모에 명시된 치료사의 관점 및 진단 내용",
      "ai_diagnosis_inferred": "전체 문맥(녹취+수기)을 기반으로 AI가 자체적으로 추론한 ${diagHint} 및 분석 관점",
      "clinical_impression": "종합적인 임상 추론",
      "progress": "상태 변화 및 호전 정도"
    },
    "plan": {
      "treatment_performed": "오늘 실시한 치료 중재",
      "home_exercise": "지도한 자가 운동 및 교육 내용",
      "future_plan": "향후 치료 계획"
    }
  },
  "red_flags_detected": [
    "감지된 위험 징후 (없으면 빈 배열 [])"
  ],
  "rapport_data": {
    "personal_background": "가족 관계, 직업, 취미, 생활 환경 등 환자를 개인적으로 이해하고 기억하는 데 도움이 되는 배경 정보",
    "patient_preferences": "치료 시 선호하는 방식, 대화 주제 등 특이사항",
    "psychosocial_factors": "심리적 상태, 사회적 지지 체계 등 심리사회적 요인",
    "compliance_attitude": "치료 순응도 및 태도",
    "upcoming_events": ["환자가 직접 언급한 향후 일정(여행, 행사 등). 없으면 빈 배열 []"],
    "follow_up_cues": ["다음 대화 시 아이스브레이킹으로 활용할 수 있는 구체적인 주제. 없으면 빈 배열 []"]
  }
}

## 규칙
- 의학 용어는 필요한 경우 영어 원문을 병기하세요.
- 대화나 메모에서 명시적으로 언급되지 않은 항목은 "언급 없음"으로 기록하거나 빈 배열([])로 두세요. 절대로 추측하여 내용을 채우지 마세요.
- 수기 메모에 담긴 구체적인 수치가 녹취록 내용보다 우선순위가 높습니다.
- rapport_data는 환자와의 신뢰 구축을 위해 실제 언급된 구체적인 정보를 기반으로 추출하세요.`;
}

function getGuidePrompt(profession: string): string {
  const prof = (profession || "pt").toLowerCase();
  let profName = "물리치료";
  if (prof === "pt") profName = "물리치료";
  else if (prof === "st") profName = "언어재활";
  else if (prof === "ot") profName = "작업치료";
  else profName = "재활치료";

  return `당신은 친절한 ${profName} 안내 도우미입니다.
${profName}사와 환자의 대화 녹취록 및 수기 기록을 분석하여, 환자가 쉽게 이해할 수 있는 치료 요약문을 작성하세요.

## 출력 형식 (마크다운)

### 오늘의 치료 요약
(오늘 어떤 치료를 받았는지 전문 용어 없이 쉽게 설명)

### 집에서 주의할 점
(환자가 일상에서 지켜야 할 사항을 구체적으로)

### 다음 방문 안내
(다음 치료 일정과 진행할 내용을 간략히)

## 규칙
- 존댓말을 사용하세요.
- 전문 용어는 피하고 쉽게 설명하세요.
- 언급되지 않은 내용은 절대로 추측하거나 포함하지 마세요.`;
}

// Deno.serve handler
Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const isWebhook = url.searchParams.get("webhook") === "true";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sonioxApiKey = Deno.env.get("SONIOX_API_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    // Initialize admin client (bypasses RLS for writing results/profiles)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    if (isWebhook) {
      // 1. Soniox Webhook Callback handling
      const sessionId = url.searchParams.get("session_id");
      if (!sessionId) {
        return new Response("Missing session_id in query parameters", { status: 400 });
      }

      const { id: transcriptionId, status } = await req.json();
      console.log(`[Webhook] Received callback for session ${sessionId}. Transcription: ${transcriptionId}, status: ${status}`);

      // Fetch session details from db
      const { data: session, error: sessionErr } = await adminClient
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionErr || !session) {
        console.error(`[Webhook] Session not found or error: ${sessionErr?.message}`);
        return new Response("Session not found", { status: 404 });
      }

      // 공통 환불 처리 함수
      const refundQuota = async () => {
        try {
          const { data: prof, error: profErr } = await adminClient
            .from("profiles")
            .select("tier, quota_used")
            .eq("id", session.user_id)
            .single();

          if (profErr || !prof) {
            console.error(`[Refund] Failed to load profile for user ${session.user_id}`);
            return;
          }

          const tier = prof.tier || 'free';
          const refundAmount = tier === 'free' ? 1 : Math.ceil((session.duration || 0) / 60) * 60;
          const newQuotaUsed = Math.max(0, prof.quota_used - refundAmount);

          await adminClient
            .from("profiles")
            .update({ quota_used: newQuotaUsed })
            .eq("id", session.user_id);

          console.log(`[Refund] Webhook refunded ${refundAmount} credits/seconds to user ${session.user_id}. Used: ${prof.quota_used} -> ${newQuotaUsed}`);
        } catch (refundErr) {
          console.error("[Refund] Exception during webhook refund process:", refundErr);
        }
      };

      if (status === "completed") {
        try {
          // Get transcript from Soniox API
          const sonioxRes = await fetch(`https://api.soniox.com/v1/transcriptions/${transcriptionId}`, {
            headers: {
              "Authorization": `Bearer ${sonioxApiKey}`,
            },
          });

          if (!sonioxRes.ok) {
            const errText = await sonioxRes.text();
            throw new Error(`Soniox fetch failed: ${sonioxRes.status} - ${errText}`);
          }

          const transcriptData = await sonioxRes.json();
          const segments = groupTokensBySpeaker(transcriptData);
          const rawFormatted = formatDiarizedTranscript(segments);

          if (!rawFormatted.trim()) {
            throw new Error("STT returned empty transcript.");
          }

          // OpenAI pipeline
          // 1) Refine Transcript
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

          // 2) Generate SOAP Chart Data
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

          // 3) Generate Patient Guide
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

          // Write results
          const { error: resultsErr } = await adminClient.from("results").insert({
            session_id: sessionId,
            raw_transcript: rawFormatted,
            refined_transcript: refinedTranscript,
            chart_data: chartData,
            guide_content: guideContent,
          });

          if (resultsErr) throw resultsErr;

          // Update session to completed
          await adminClient
            .from("sessions")
            .update({ status: "completed" })
            .eq("id", sessionId);

          console.log(`[Webhook] Success! Results saved and session ${sessionId} completed.`);

        } catch (err) {
          console.error(`[Webhook] Process failed for session ${sessionId}:`, err);
          await adminClient
            .from("sessions")
            .update({ status: "failed" })
            .eq("id", sessionId);
          
          // 오류 발생 시 크레딧 환불
          await refundQuota();
        } finally {
          // Cleanup audio file from storage (user requested deletion after analysis)
          try {
            const filePath = `${session.user_id}/${sessionId}_processed_audio.wav`;
            console.log(`[Cleanup] Deleting storage file: ${filePath}`);
            await adminClient.storage.from("audio-records").remove([filePath]);
          } catch (storageErr) {
            console.error("[Cleanup] Failed to delete audio from storage:", storageErr);
          }

          // Cleanup Soniox resources
          try {
            console.log(`[Cleanup] Deleting Soniox transcription ${transcriptionId}`);
            await fetch(`https://api.soniox.com/v1/transcriptions/${transcriptionId}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${sonioxApiKey}` },
            });
            
            if (transcriptData?.file_id) {
              console.log(`[Cleanup] Deleting Soniox file ${transcriptData.file_id}`);
              await fetch(`https://api.soniox.com/v1/files/${transcriptData.file_id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${sonioxApiKey}` },
              });
            }
          } catch (sonioxErr) {
            console.error("[Cleanup] Failed to clean up Soniox resources:", sonioxErr);
          }
        }
      } else {
        console.error(`[Webhook] Soniox transcription failed for session ${sessionId}.`);
        await adminClient
          .from("sessions")
          .update({ status: "failed" })
          .eq("id", sessionId);

        // 분석 실패 시 크레딧 환불
        await refundQuota();

        // Delete audio from storage even if failed
        try {
          const filePath = `${session.user_id}/${sessionId}_processed_audio.wav`;
          await adminClient.storage.from("audio-records").remove([filePath]);
        } catch (err) {}
      }

      return new Response("OK", { headers: corsHeaders });
    } else {
      // 2. Client-triggered analysis request (POST /analyze)
      // Extract Authorization header to verify user session
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ detail: "Authorization header is missing" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ detail: "Invalid token or unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { session_id, duration, file_ext } = await req.json();
      if (!session_id || duration === undefined) {
        return new Response(JSON.stringify({ detail: "Missing session_id or duration in payload" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load session details from DB to verify owner
      const { data: session, error: sessionErr } = await adminClient
        .from("sessions")
        .select("*")
        .eq("id", session_id)
        .single();

      if (sessionErr || !session) {
        return new Response(JSON.stringify({ detail: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (session.user_id !== user.id) {
        return new Response(JSON.stringify({ detail: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Quota check & decrement with optimistic locking retry loop
      let quotaDeducted = false;
      const maxRetries = 3;
      let profile: any = null;
      let deductAmount = 0;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const { data: prof, error: profErr } = await adminClient
          .from("profiles")
          .select("tier, quota_limit, quota_used, subscription_id, subscriptions(status, current_period_end)")
          .eq("id", user.id)
          .single();

        if (profErr || !prof) {
          return new Response(JSON.stringify({ detail: "User profile not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        profile = prof;
        let tier = prof.tier || 'free';
        let sub: any = prof.subscriptions;
        if (Array.isArray(sub)) {
          sub = sub[0];
        }

        // Check subscription status and handle grace period dynamically
        if (sub) {
          if (sub.status === "past_due") {
            const isExpired = new Date() > new Date(sub.current_period_end);
            if (isExpired) {
              console.log(`[Grace Period Expired] Downgrading user ${user.id} due to past_due subscription expired.`);
              await adminClient.from("subscriptions").update({ status: "canceled" }).eq("id", prof.subscription_id);
              await adminClient.from("profiles").update({
                tier: "free",
                subscription_id: null,
                quota_limit: 10,
                quota_used: 10,
              }).eq("id", user.id);
              prof.tier = "free";
              prof.quota_limit = 10;
              prof.quota_used = 10;
              tier = "free";
            }
          } else if (sub.status === "canceled" && tier !== "free") {
            console.log(`[Subscription Canceled] Downgrading user ${user.id} to free tier.`);
            await adminClient.from("profiles").update({
              tier: "free",
              subscription_id: null,
              quota_limit: 10,
              quota_used: 10,
            }).eq("id", user.id);
            prof.tier = "free";
            prof.quota_limit = 10;
            prof.quota_used = 10;
            tier = "free";
          }
        }

        if (tier === 'free') {
          if (duration > 1800) {
            return new Response(JSON.stringify({ detail: "Free 등급은 1회 최대 30분까지만 분석이 가능합니다." }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          deductAmount = 1;
        } else {
          if (duration > 18000) { // 5시간으로 변경
            return new Response(JSON.stringify({ detail: "유료 등급은 1회 최대 5시간까지만 분석이 가능합니다." }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          deductAmount = Math.ceil(duration / 60) * 60;
        }

        if (prof.quota_limit - prof.quota_used < deductAmount) {
          return new Response(
            JSON.stringify({ detail: "사용 가능한 크레딧(시간)이 부족합니다. 구독 서비스 결제가 필요합니다." }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: updateData, error: updateErr } = await adminClient
          .from("profiles")
          .update({ quota_used: prof.quota_used + deductAmount })
          .eq("id", user.id)
          .eq("quota_used", prof.quota_used)
          .select();

        if (updateData && updateData.length > 0) {
          quotaDeducted = true;
          console.log(`[Quota] Deducted ${deductAmount} for ${user.email} (${tier}). Used: ${prof.quota_used} -> ${prof.quota_used + deductAmount}`);
          break;
        }
      }

      if (!quotaDeducted) {
        return new Response(JSON.stringify({ detail: "동시 요청이 감지되었습니다. 잠시 후 다시 시도해 주세요." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update session status to processing
      await adminClient
        .from("sessions")
        .update({ status: "processing" })
        .eq("id", session_id);

      // Download audio file from Storage
      const ext = file_ext || 'wav';
      const storagePath = `${user.id}/${session_id}_processed_audio.${ext}`;
      console.log(`[Storage] Downloading audio from bucket: audio-records, path: ${storagePath}`);
      
      const { data: audioBlob, error: downloadError } = await adminClient
        .storage
        .from("audio-records")
        .download(storagePath);

      if (downloadError || !audioBlob) {
        console.error(`[Storage] Download error: ${downloadError?.message}`);
        await adminClient.from("profiles").update({ quota_used: profile.quota_used }).eq("id", user.id);
        await adminClient.from("sessions").update({ status: "failed" }).eq("id", session_id);
        
        return new Response(JSON.stringify({ detail: "오디오 파일을 스토리지에서 다운로드할 수 없습니다." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload file to Soniox
      try {
        console.log(`[Soniox] Uploading audio to Soniox Files API...`);
        const sonioxUploadRes = await fetch("https://api.soniox.com/v1/files", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sonioxApiKey}`,
            "Content-Type": "application/octet-stream",
          },
          body: audioBlob,
        });

        if (!sonioxUploadRes.ok) {
          const errText = await sonioxUploadRes.text();
          throw new Error(`Soniox file upload failed: ${sonioxUploadRes.status} - ${errText}`);
        }

        const { id: fileId } = await sonioxUploadRes.json();
        console.log(`[Soniox] Upload successful. File ID: ${fileId}`);

        // Call Soniox asynchronous transcription with Webhook url
        const webhookUrl = `${supabaseUrl}/functions/v1/analyze?webhook=true&session_id=${session_id}&file_ext=${ext}`;
        console.log(`[Soniox] Creating async transcription with Webhook: ${webhookUrl}`);
        
        const transRes = await fetch("https://api.soniox.com/v1/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sonioxApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "stt-async-v4",
            file_id: fileId,
            config: {
              enable_speaker_diarization: true,
              language_hints: ["ko"],
              webhook_url: webhookUrl,
            },
          }),
        });

        if (!transRes.ok) {
          const errText = await transRes.text();
          throw new Error(`Soniox transcription creation failed: ${transRes.status} - ${errText}`);
        }

        const transData = await transRes.json();
        const jobId = transData.id;
        console.log(`[Soniox] Transcription task created: ${jobId}`);

        // [실시간 최적화] Edge Function 내부에서 Soniox 작업 완료를 실시간 폴링하여 대기
        // 오디오 크기에 관계 없이 사용자 화면 대기 시간을 최소화하기 위해 최대 100초간 대기합니다.
        let jobCompleted = false;
        let transcriptResult: any = null;
        const maxPollRetries = 25; // 25 * 4초 = 100초
        
        for (let attempt = 0; attempt < maxPollRetries; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 4000));
          
          const pollRes = await fetch(`https://api.soniox.com/v1/transcriptions/${jobId}`, {
            headers: { "Authorization": `Bearer ${sonioxApiKey}` },
          });
          
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.status === "completed") {
              jobCompleted = true;
              transcriptResult = pollData;
              break;
            } else if (pollData.status === "failed") {
              throw new Error("Soniox transcription failed at STT engine.");
            }
          }
        }

        // 만약 100초 안에 완료되었다면, 즉시 GPT 정제 및 차트/가이드 생성 수행 후 200 반환
        if (jobCompleted && transcriptResult) {
          console.log(`[process-instant] STT completed within limit. Generating GPT outputs...`);
          
          const segments = groupTokensBySpeaker(transcriptResult);
          const rawFormatted = formatDiarizedTranscript(segments);

          if (!rawFormatted.trim()) {
            throw new Error("STT returned empty transcript.");
          }

          // OpenAI 정제 (1단계)
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

          const chartUserContent = `아래는 ${session.profession.toUpperCase()} 세션의 녹취록입니다.\n\n${refinedTranscript}${
            session.memo ? `\n\n[추가 수기 메모]\n${session.memo}` : ""
          }`;

          // [병렬 처리 최적화] SOAP 차트와 가이드 작성을 동시에 호출 (약 15초 단축)
          const [chartResponse, guideResponse] = await Promise.all([
            fetch("https://api.openai.com/v1/chat/completions", {
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
            }),
            fetch("https://api.openai.com/v1/chat/completions", {
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
            })
          ]);

          if (!chartResponse.ok) throw new Error("OpenAI SOAP Chart error: " + (await chartResponse.text()));
          if (!guideResponse.ok) throw new Error("OpenAI Patient Guide error: " + (await guideResponse.text()));

          const chartJson = await chartResponse.json();
          const guideJson = await guideResponse.json();

          const chartData = JSON.parse(chartJson.choices[0].message.content.trim());
          const guideContent = guideJson.choices[0].message.content.trim();

          // DB 저장
          const { error: resultsErr } = await adminClient.from("results").insert({
            session_id: session_id,
            raw_transcript: rawFormatted,
            refined_transcript: refinedTranscript,
            chart_data: chartData,
            guide_content: guideContent,
          });
          if (resultsErr) throw resultsErr;

          await adminClient.from("sessions").update({ status: "completed" }).eq("id", session_id);
          console.log(`[Instant Completion] Session ${session_id} successfully finalized in real-time.`);

          // Storage 파일 삭제
          try {
            await adminClient.storage.from("audio-records").remove([storagePath]);
          } catch (e) {}

          // Soniox 자원 정리
          try {
            await fetch(`https://api.soniox.com/v1/transcriptions/${jobId}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${sonioxApiKey}` },
            });
            if (transcriptResult.file_id) {
              await fetch(`https://api.soniox.com/v1/files/${transcriptResult.file_id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${sonioxApiKey}` },
              });
            }
          } catch (e) {}

          return new Response(
            JSON.stringify({
              status: "success",
              instant: true,
              message: "분석이 실시간으로 완료되었습니다.",
              session_id: session_id,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // 100초 초과 시 202를 주어 Webhook 백그라운드 위임
        console.log(`[analyze] Timeout limit reached. Entrusting rest to Webhook callback...`);
        return new Response(
          JSON.stringify({
            status: "accepted",
            instant: false,
            message: "분석이 백그라운드에서 진행 중입니다. 완료 시 대시보드에 업데이트됩니다.",
            session_id: session_id,
          }),
          {
            status: 202,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );

      } catch (err) {
        console.error("[Soniox] Failed during process initialization:", err);
        await adminClient.from("profiles").update({ quota_used: profile.quota_used }).eq("id", user.id);
        await adminClient.from("sessions").update({ status: "failed" }).eq("id", session_id);
        
        return new Response(JSON.stringify({ detail: "STT 연동 도중 에러가 발생했습니다: " + err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  } catch (error) {
    console.error("Critical error in analyze function:", error);
    return new Response(JSON.stringify({ detail: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
