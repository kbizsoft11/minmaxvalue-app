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

    // Get payout record with related data
    const { data: payout, error: payoutError } = await supabaseClient
      .from("payouts")
      .select(`
        *,
        user:profiles!payouts_user_id_fkey(id, email),
        purchase:purchases(
          ticket_id,
          org_fee,
          tickets(
            organizations(
              id,
              name,
              stripe_account_id
            )
          )
        )
      `)
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

    // Handle decline
    if (action === "decline") {
      const { error: updateError } = await supabaseClient
        .from("payouts")
        .update({
          status: "cancelled",
          processed_at: new Date().toISOString(),
          processed_by: user.id,
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
    const { data: sellerStripeAccount, error: accountError } = await supabaseClient
      .from("stripe_accounts")
      .select("*")
      .eq("user_id", payout.user_id)
      .eq("account_type", "seller")
      .single();

    if (accountError || !sellerStripeAccount) {
      return new Response(
        JSON.stringify({ error: "Seller has no connected Stripe account" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!sellerStripeAccount.payouts_enabled) {
      return new Response(
        JSON.stringify({ error: "Seller's Stripe account cannot receive payouts" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate wallet balance
    const { data: wallet } = await supabaseClient
      .from("wallets")
      .select("balance, pending_balance")
      .eq("user_id", payout.user_id)
      .single();

    if (!wallet || wallet.balance < payout.amount) {
      return new Response(
        JSON.stringify({
          error: "Insufficient wallet balance",
          wallet_balance: wallet?.balance || 0,
          payout_amount: payout.amount,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Check platform balance
    const platformBalance = await stripe.balance.retrieve();
    const availableBalance = platformBalance.available.find(b => b.currency === "usd")?.amount || 0;

    const totalTransferAmount = payout.amount + (payout.purchase?.org_fee || 0);

    if (availableBalance < totalTransferAmount) {
      return new Response(
        JSON.stringify({
          error: "Insufficient platform balance for payout",
          available: availableBalance,
          required: totalTransferAmount,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Mark payout as processing
    await supabaseClient
      .from("payouts")
      .update({
        status: "processing",
        processed_at: new Date().toISOString(),
        processed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout_id);

    try {
      // 1. Transfer to SELLER
      const sellerTransfer = await stripe.transfers.create({
        amount: payout.amount,
        currency: "usd",
        destination: sellerStripeAccount.stripe_account_id,
        description: `Payout for ticket sale`,
        metadata: {
          payout_id: payout.id,
          user_id: payout.user_id,
          type: "seller_payout",
        },
      }, {
        idempotencyKey: `seller_payout_${payout.id}`,
      });

      // Record seller payout
      await supabaseClient
        .from("stripe_payouts")
        .insert({
          stripe_transfer_id: sellerTransfer.id,
          seller_id: payout.user_id,
          payout_id: payout.id,
          amount: payout.amount,
          currency: "USD",
          status: "completed",
          payout_type: "seller",
          admin_approved: true,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      // 2. Transfer to ORGANIZATION (if applicable)
      let orgTransferId = null;
      const orgFee = payout.purchase?.org_fee || 0;
      const orgStripeAccountId = payout.purchase?.tickets?.organizations?.stripe_account_id;

      if (orgFee > 0 && orgStripeAccountId) {
        const orgTransfer = await stripe.transfers.create({
          amount: orgFee,
          currency: "usd",
          destination: orgStripeAccountId,
          description: `Organization commission`,
          metadata: {
            payout_id: payout.id,
            organization_id: payout.purchase?.tickets?.organizations?.id,
            type: "org_commission",
          },
        }, {
          idempotencyKey: `org_payout_${payout.id}`,
        });

        orgTransferId = orgTransfer.id;

        // Record org payout
        await supabaseClient
          .from("stripe_payouts")
          .insert({
            stripe_transfer_id: orgTransfer.id,
            organization_id: payout.purchase?.tickets?.organizations?.id,
            payout_id: payout.id,
            amount: orgFee,
            currency: "USD",
            status: "completed",
            payout_type: "organization",
            admin_approved: true,
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }

      // Update payout as completed
      await supabaseClient
        .from("payouts")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          notes: `Seller transfer: ${sellerTransfer.id}${orgTransferId ? `, Org transfer: ${orgTransferId}` : ""}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payout_id);

      // Deduct from wallet
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
          created_at: new Date().toISOString(),
        });

      // Update ticket status to payout_completed
      if (payout.purchase?.ticket_id) {
        await supabaseClient
          .from("tickets")
          .update({
            status: "payout_completed",
            payout_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", payout.purchase.ticket_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          seller_transfer_id: sellerTransfer.id,
          org_transfer_id: orgTransferId,
          status: "completed",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    } catch (stripeError: unknown) {
      console.error("Stripe transfer failed:", stripeError);

      // Revert payout status
      await supabaseClient
        .from("payouts")
        .update({
          status: "failed",
          notes: `Transfer failed: ${stripeError instanceof Error ? stripeError.message : "Unknown error"}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payout_id);

      throw stripeError;
    }

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