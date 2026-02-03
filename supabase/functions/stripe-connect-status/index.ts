import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") || ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's stripe account
    const { data: stripeAccount, error: accountError } = await supabaseClient
      .from("stripe_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("account_type", "seller")
      .maybeSingle();

    if (accountError) {
      throw new Error("Failed to fetch Stripe account");
    }

    if (!stripeAccount) {
      return new Response(
        JSON.stringify({
          connected: false,
          onboarding_status: null,
          charges_enabled: false,
          payouts_enabled: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch latest status from Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);

    // Determine onboarding status
    let onboardingStatus = stripeAccount.onboarding_status;
    if (account.details_submitted && account.charges_enabled) {
      onboardingStatus = "complete";
    } else if (account.details_submitted) {
      onboardingStatus = "pending_verification";
    } else {
      onboardingStatus = "pending";
    }

    // Update local record if status changed
    if (
      onboardingStatus !== stripeAccount.onboarding_status ||
      account.charges_enabled !== stripeAccount.charges_enabled ||
      account.payouts_enabled !== stripeAccount.payouts_enabled
    ) {
      await supabaseClient
        .from("stripe_accounts")
        .update({
          onboarding_status: onboardingStatus,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", stripeAccount.id);
    }

    return new Response(
      JSON.stringify({
        connected: true,
        stripe_account_id: stripeAccount.stripe_account_id,
        onboarding_status: onboardingStatus,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in stripe-connect-status:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
