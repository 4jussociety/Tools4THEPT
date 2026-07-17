// 차트 매핑 Edge Function
// 예약 ID와 차트 ID 매핑 조회 및 차트 상세 정보 반환

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const authHeader = req.headers.get("Authorization") ?? "";
  const user = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );

  if (!user.data.user) return new Response("Unauthorized", { status: 401 });

  try {
    // 1️⃣ 예약 ID 로 차트 리스트 조회
    if (req.method === "GET" && path.startsWith("/chart-mapping/appointment/")) {
      const appointmentId = path.split("/").pop()!;
      const { data: appt, error: apptErr } = await supabase
        .from("appointments")
        .select("user_id")
        .eq("id", appointmentId)
        .single();
      if (apptErr) throw apptErr;
      if (appt!.user_id !== user.data.user.id) {
        return new Response("Forbidden", { status: 403 });
      }

      const { data: map, error: mapErr } = await supabase
        .from("appointment_chart_map")
        .select("chart_id, linked_at")
        .eq("appointment_id", appointmentId);
      if (mapErr) throw mapErr;
      if (!map?.length) return new Response(JSON.stringify([]), { status: 200 });

      const chartIds = map.map((r) => r.chart_id);
      const { data: charts, error: chartErr } = await supabase
        .from("charts")
        .select("id, title, created_at, metadata")
        .in("id", chartIds);
      if (chartErr) throw chartErr;

      return new Response(JSON.stringify(charts), { status: 200 });
    }

    // 2️⃣ 차트 ID 로 상세 조회 (예약 ID 포함)
    if (req.method === "GET" && path.startsWith("/chart-mapping/")) {
      const chartId = path.split("/").pop()!;
      const { data: chart, error: chartErr } = await supabase
        .from("charts")
        .select("*")
        .eq("id", chartId)
        .single();
      if (chartErr) throw chartErr;

      const { data: session, error: sessErr } = await supabase
        .from("sessions")
        .select("user_id, appointment_id")
        .eq("id", chart.session_id)
        .single();
      if (sessErr) throw sessErr;
      if (session!.user_id !== user.data.user.id) {
        return new Response("Forbidden", { status: 403 });
      }

      const result = { ...chart, appointment_id: session!.appointment_id };
      return new Response(JSON.stringify(result), { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
