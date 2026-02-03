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

    // Get admin user from auth header
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

    // Verify admin role
    const { data: isAdmin } = await supabaseClient.rpc("is_admin", { _user_id: user.id });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payout_id, action } = await req.json();

    if (!payout_id || !["approve", "decline"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get payout record
    const { data: payout, error: payoutError } = await supabaseClient
      .from("payouts")
      .select("*, user:profiles!payouts_user_id_fkey(id, email)")
      .eq("id", payout_id)
      .single();

    if (payoutError || !payout) {
      return new Response(JSON.stringify({ error: "Payout not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payout.status !== "pending") {
      return new Response(JSON.stringify({ error: "Payout is not pending" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "decline") {
      // Update payout status to cancelled
      const { error: updateError } = await supabaseClient
        .from("payouts")
        .update({
          status: "cancelled",
          processed_at: new Date().toISOString(),
          notes: `Declined by admin ${user.email}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payout_id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, status: "cancelled" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get seller's Stripe connected account
    const { data: stripeAccount, error: accountError } = await supabaseClient
      .from("stripe_accounts")
      .select("*")
      .eq("user_id", payout.user_id)
      .eq("account_type", "seller")
      .single();

    if (accountError || !stripeAccount) {
      return new Response(
        JSON.stringify({ error: "Seller has no connected Stripe account" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!stripeAccount.payouts_enabled) {
      return new Response(
        JSON.stringify({ error: "Seller's Stripe account cannot receive payouts" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Mark payout as processing
    await supabaseClient
      .from("payouts")
      .update({
        status: "processing",
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout_id);

    // Create Stripe transfer
    const transfer = await stripe.transfers.create({
      amount: payout.amount,
      currency: "usd",
      destination: stripeAccount.stripe_account_id,
      description: `Payout for user ${payout.user_id}`,
      metadata: {
        payout_id: payout.id,
        user_id: payout.user_id,
      },
    });

    // Create stripe_payouts record
    const { error: stripePayoutError } = await supabaseClient
      .from("stripe_payouts")
      .insert({
        stripe_transfer_id: transfer.id,
        seller_id: payout.user_id,
        payout_id: payout.id,
        amount: payout.amount,
        currency: "USD",
        status: "completed",
        admin_approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      });

    if (stripePayoutError) {
      console.error("Error creating stripe_payouts record:", stripePayoutError);
    }

    // Update payout as completed
    const { error: completeError } = await supabaseClient
      .from("payouts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        notes: `Transfer ID: ${transfer.id}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout_id);

    if (completeError) {
      console.error("Error completing payout:", completeError);
    }

    // Deduct from wallet
    const { data: wallet } = await supabaseClient
      .from("wallets")
      .select("balance")
      .eq("user_id", payout.user_id)
      .single();

    if (wallet) {
      const newBalance = wallet.balance - payout.amount;
      await supabaseClient
        .from("wallets")
        .update({
          balance: Math.max(0, newBalance),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", payout.user_id);

      // Record transaction
      await supabaseClient
        .from("transactions")
        .insert({
          user_id: payout.user_id,
          type: "payout",
          amount: -payout.amount,
          balance_after: Math.max(0, newBalance),
          reference_id: payout.id,
          reference_type: "payout",
          description: `Payout to Stripe account`,
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: transfer.id,
        status: "completed",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in execute-payout:", error);
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
