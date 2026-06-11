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
    console.log("[Webhook Received]", JSON.stringify(body));

    const { imp_uid, merchant_uid, status, customer_uid } = body;

    if (!merchant_uid || !status) {
      return new Response(JSON.stringify({ error: "Missing merchant_uid or status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse userId and tier from merchant_uid if format is sub_{tier}_{userId}_{timestamp}
    let userId = "";
    let tier = "free";
    const parts = merchant_uid.split("_");
    if (parts.length >= 3 && parts[0] === "sub") {
      tier = parts[1]; // 'basic' or 'premium'
      userId = parts[2];
    } else {
      // If merchant_uid is not in the format, try to find existing subscription row
      const { data: subData, error: subQueryError } = await adminClient
        .from("subscriptions")
        .select("user_id")
        .eq("merchant_uid", merchant_uid)
        .maybeSingle();

      if (subQueryError) {
        console.error("Failed to query subscription by merchant_uid:", subQueryError);
      }
      if (subData) {
        userId = subData.user_id;
      }
    }

    if (!userId) {
      console.warn(`[Webhook warning] Could not resolve user_id for merchant_uid: ${merchant_uid}`);
      return new Response(JSON.stringify({ message: "Webhook received, but user not found/resolved." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set quota limit based on tier (Basic: 100 hours, Premium: 200 hours)
    let quotaLimit = 10;
    if (tier === "basic") {
      quotaLimit = 100 * 3600; // 100 hours in seconds = 360,000
    } else if (tier === "premium") {
      quotaLimit = 200 * 3600; // 200 hours in seconds = 720,000
    }

    if (status === "paid") {
      console.log(`[Webhook] Processing successful payment for user ${userId}, tier ${tier}`);

      const currentPeriodStart = new Date().toISOString();
      const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days period

      // Upsert subscription using merchant_uid
      const { data: sub, error: subErr } = await adminClient
        .from("subscriptions")
        .upsert({
          user_id: userId,
          status: "active",
          customer_uid: customer_uid || imp_uid || null,
          merchant_uid: merchant_uid,
          cancel_at_period_end: false,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
        }, { onConflict: "merchant_uid" })
        .select()
        .single();

      if (subErr) {
        console.error("Error upserting subscription:", subErr);
        throw subErr;
      }

      // Update profile. Clear quota_used (No Rollover), set tier/limit
      const { error: profErr } = await adminClient
        .from("profiles")
        .update({
          tier: tier,
          subscription_id: sub.id,
          quota_limit: quotaLimit,
          quota_used: 0,
          billing_cycle_anchor: currentPeriodStart,
        })
        .eq("id", userId);

      if (profErr) {
        console.error("Error updating profile:", profErr);
        throw profErr;
      }

      console.log(`[Webhook] Successfully updated user ${userId} profile to ${tier} tier.`);

    } else if (status === "failed") {
      console.log(`[Webhook] Processing failed payment for user ${userId}, setting status to past_due with 24h grace period`);

      const gracePeriodEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: subErr } = await adminClient
        .from("subscriptions")
        .upsert({
          user_id: userId,
          status: "past_due",
          merchant_uid: merchant_uid,
          current_period_end: gracePeriodEnd,
        }, { onConflict: "merchant_uid" });

      if (subErr) {
        console.error("Error updating subscription to past_due:", subErr);
        throw subErr;
      }

      console.log(`[Webhook] Successfully updated user ${userId} subscription status to past_due.`);

    } else if (status === "cancelled") {
      console.log(`[Webhook] Processing cancellation/refund for user ${userId}`);

      const { error: subErr } = await adminClient
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("merchant_uid", merchant_uid);

      if (subErr) {
        console.error("Error updating subscription to canceled:", subErr);
      }

      // Downgrade user profile back to free
      const { error: profErr } = await adminClient
        .from("profiles")
        .update({
          tier: "free",
          subscription_id: null,
          quota_limit: 10,
          quota_used: 10, // Revoke all credits by matching limit
        })
        .eq("id", userId);

      if (profErr) {
        console.error("Error downgrading profile to free:", profErr);
        throw profErr;
      }

      console.log(`[Webhook] Successfully downgraded user ${userId} to free.`);
    }

    return new Response(JSON.stringify({ status: "success" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
