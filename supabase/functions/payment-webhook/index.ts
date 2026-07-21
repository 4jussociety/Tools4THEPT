import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("[Groble Webhook Received] Raw Body:", JSON.stringify(body, null, 2));

    // 그로블 웹훅 페이로드 추출 (임시 추정 포맷, 로그 확인 후 수정 가능)
    const { event_type, order_id, buyer_email, amount, status } = body;

    // 만약 groble 측에서 다른 포맷(예: type, data 객체 등)으로 보낸다면 
    // 위 로그("Raw Body")를 통해 확인 후 대응할 수 있습니다.
    
    // 그로블의 정확한 페이로드를 아직 모르기 때문에, 테스트 전송 로그를 남긴 후 early return 처리
    if (event_type === "TEST" || body.test === true || !buyer_email) {
       console.log("[Groble Webhook] Test payload or missing buyer_email. Skipping DB update.");
       return new Response(JSON.stringify({ status: "success", message: "Test received" }), {
         status: 200,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
    }

    // 이메일로 사용자 찾기
    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", buyer_email)
      .maybeSingle();

    if (profileErr || !profile) {
      console.warn(`[Webhook warning] Could not resolve user_id for buyer_email: ${buyer_email}`);
      return new Response(JSON.stringify({ message: "Webhook received, but user not found/resolved." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = profile.id;
    let tier = "basic"; // 기본값
    let quotaLimit = 100 * 3600; // 100 hours in seconds = 360,000

    // 결제 금액 또는 상품명으로 tier 구분 로직 (임시)
    if (amount === 59900 || amount === '59900') {
      tier = "premium";
      quotaLimit = 200 * 3600; // 200 hours in seconds = 720,000
    } else if (amount === 99000 || amount === '99000') { // Enterprise (예시)
      tier = "enterprise";
      quotaLimit = 500 * 3600; 
    }

    // Groble 이벤트 상태 판별 (PAYMENT_COMPLETED, SUCCESS 등)
    // 실제 들어오는 status나 event_type 값에 따라 조건을 수정하세요.
    const isSuccess = status === "paid" || status === "SUCCESS" || event_type === "PAYMENT_COMPLETED" || event_type === "SUBSCRIPTION_PAYMENT_COMPLETED";
    const isCanceled = status === "cancelled" || status === "CANCELED" || event_type === "PAYMENT_CANCELED" || event_type === "SUBSCRIPTION_CANCELED";
    const isFailed = status === "failed" || status === "FAILED" || event_type === "PAYMENT_FAILED";

    if (isSuccess) {
      console.log(`[Webhook] Processing successful payment for user ${userId}, tier ${tier}`);

      const currentPeriodStart = new Date().toISOString();
      const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days period

      // Upsert subscription using groble_order_id or groble_buyer_email
      const { data: sub, error: subErr } = await adminClient
        .from("subscriptions")
        .upsert({
          user_id: userId,
          status: "active",
          tier: tier,
          groble_order_id: order_id || `groble_${Date.now()}`,
          groble_buyer_email: buyer_email,
          cancel_at_period_end: false,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
        }, { onConflict: "groble_buyer_email" }) // 중복 방지를 위한 conflict target (DB 설정 필요)
        .select()
        .single();

      if (subErr) {
        console.error("Error upserting subscription:", subErr);
        // 만약 groble_buyer_email에 unique 제약이 없다면 단순 insert나 eq('user_id') 기반 upsert 권장
      }

      // Update profile. Clear quota_used (No Rollover), set tier/limit
      const { error: profUpdateErr } = await adminClient
        .from("profiles")
        .update({
          tier: tier,
          subscription_id: sub?.id,
          quota_limit: quotaLimit,
          quota_used: 0,
          billing_cycle_anchor: currentPeriodStart,
        })
        .eq("id", userId);

      if (profUpdateErr) {
        console.error("Error updating profile:", profUpdateErr);
        throw profUpdateErr;
      }

      console.log(`[Webhook] Successfully updated user ${userId} profile to ${tier} tier.`);

    } else if (isFailed) {
      console.log(`[Webhook] Processing failed payment for user ${userId}, setting status to past_due`);
      const gracePeriodEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await adminClient.from("subscriptions").update({ status: "past_due", current_period_end: gracePeriodEnd }).eq("user_id", userId);
    } else if (isCanceled) {
      console.log(`[Webhook] Processing cancellation for user ${userId}`);
      await adminClient.from("subscriptions").update({ status: "canceled" }).eq("user_id", userId);
      await adminClient.from("profiles").update({ tier: "free", subscription_id: null, quota_limit: 10, quota_used: 10 }).eq("id", userId);
    }

    return new Response(JSON.stringify({ status: "success" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
