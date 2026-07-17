// Supabase Edge Function: process-chunk
// 30분 단위 음성 청크의 Storage URL을 수신하여 Soniox STT 비동기 처리를 등록하고 job_id를 DB에 저장합니다.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // CORS Preflight 대응
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sonioxApiKey = Deno.env.get("SONIOX_API_KEY")!;

    // 서비스 롤 토큰으로 어드민 클라이언트 생성 (RLS 우회 쓰기 보장)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 요청 본문 파싱
    const { chunk_id, file_path } = await req.json();
    if (!chunk_id || !file_path) {
      return new Response(
        JSON.stringify({ detail: "Missing chunk_id or file_path in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-chunk] Initiating STT job for chunk: ${chunk_id}, URL: ${file_path}`);

    // 1. Soniox API 호출 (비동기 전사 생성)
    // audio_url 파라미터를 사용하여 Soniox가 Storage 파일에서 바로 읽어오게 처리
    const sonioxRes = await fetch("https://api.soniox.com/v1/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sonioxApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "stt-async-v4",
        audio_url: file_path,
        config: {
          enable_speaker_diarization: true,
          language_hints: ["ko"],
        },
      }),
    });

    if (!sonioxRes.ok) {
      const errText = await sonioxRes.text();
      throw new Error(`Soniox API error: ${sonioxRes.status} - ${errText}`);
    }

    const sonioxData = await sonioxRes.json();
    const jobId = sonioxData.id;
    console.log(`[process-chunk] Soniox job successfully registered. Job ID: ${jobId}`);

    // 2. DB chunks 상태 및 transcriptions 데이터 생성
    // chunks 상태를 queued로 변경
    const { error: chunkUpdateErr } = await adminClient
      .from("chunks")
      .update({ status: "queued" })
      .eq("id", chunk_id);

    if (chunkUpdateErr) {
      throw new Error(`Failed to update chunk status: ${chunkUpdateErr.message}`);
    }

    // transcriptions 레코드 추가
    const { error: transInsertErr } = await adminClient
      .from("transcriptions")
      .insert({
        chunk_id: chunk_id,
        job_id: jobId,
        status: "pending",
      });

    if (transInsertErr) {
      throw new Error(`Failed to insert transcription record: ${transInsertErr.message}`);
    }

    return new Response(
      JSON.stringify({
        status: "success",
        message: "STT 비동기 작업이 성공적으로 등록되었습니다.",
        job_id: jobId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("[process-chunk] Error processing chunk:", error);
    return new Response(
      JSON.stringify({ detail: error.message || "알 수 없는 에러가 발생했습니다." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
