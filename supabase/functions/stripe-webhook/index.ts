import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing required environment variables");
    return new Response("Server configuration error", { status: 500 });
  }

  // ✅ Add httpClient for Deno compatibility
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;
  const body = await req.text();

  try {
    // ✅ Use SubtleCryptoProvider for Deno
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  console.log(`Processing webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(supabaseClient, account);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabaseClient, session);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(supabaseClient, session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(supabaseClient, paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(supabaseClient, paymentIntent);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(supabaseClient, charge);
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeCreated(supabaseClient, dispute);
        break;
      }

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferCreated(supabaseClient, transfer);
        break;
      }

      case "transfer.failed": {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferFailed(supabaseClient, transfer);
        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutPaid(supabaseClient, payout);
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutFailed(supabaseClient, payout);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// ============ HANDLER FUNCTIONS ============

async function handleAccountUpdated(supabaseClient: any, account: Stripe.Account) {
  console.log(`Processing account.updated for ${account.id}`);

  let onboardingStatus = "pending";
  if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
    onboardingStatus = "complete";
  } else if (account.details_submitted && account.charges_enabled) {
    onboardingStatus = "pending_payouts";
  } else if (account.details_submitted) {
    onboardingStatus = "pending_verification";
  } else if (account.requirements?.currently_due?.length === 0) {
    onboardingStatus = "pending_verification";
  }

  const { error } = await supabaseClient
    .from("stripe_accounts")
    .update({
      onboarding_status: onboardingStatus,
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id);

  if (error) {
    console.error("Error updating stripe account:", error);
    throw error;
  }

  console.log(`Updated account ${account.id} to status: ${onboardingStatus}`);
}

async function handleCheckoutCompleted(
  supabaseClient: any,
  session: Stripe.Checkout.Session
) {
  console.log(`Processing checkout.session.completed for ${session.id}`);

  const metadata = session.metadata || {};
  const ticketId = metadata.ticket_id;
  const buyerId = metadata.buyer_id;
  const sellerId = metadata.seller_id;

  if (!ticketId || !buyerId) {
    console.error("Missing ticket_id or buyer_id in session metadata");
    return;
  }

  // Idempotency check
  const { data: existingPurchase } = await supabaseClient
    .from("purchases")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existingPurchase) {
    console.log(`Session ${session.id} already processed, skipping`);
    return;
  }

  const paymentIntentId = session.payment_intent as string;

  // Update stripe_payments record
  const { error: paymentError } = await supabaseClient
    .from("stripe_payments")
    .update({
      payment_intent_id: paymentIntentId,
      status: "succeeded",
      updated_at: new Date().toISOString(),
    })
    .eq("checkout_session_id", session.id);

  if (paymentError) {
    console.error("Error updating payment record:", paymentError);
  }

  // Parse amounts from metadata
  const ticketPrice = parseInt(metadata.ticket_price || "0");
  const platformFee = parseInt(metadata.platform_fee || "0");
  const orgFee = parseInt(metadata.org_fee || "0");
  const sellerNet = parseInt(metadata.seller_net || "0");
  const totalAmount = parseInt(metadata.total_amount || "0");

  // Create purchase record
  const { error: purchaseError } = await supabaseClient
    .from("purchases")
    .insert({
      ticket_id: ticketId,
      buyer_id: buyerId,
      seller_id: sellerId,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      ticket_price: ticketPrice,
      platform_fee: platformFee,
      org_fee: orgFee,
      seller_net: sellerNet,
      total_amount: totalAmount,
      buyer_first_name: metadata.buyer_first_name || null,
      buyer_last_name: metadata.buyer_last_name || null,
      buyer_dob: metadata.buyer_dob || null,
      buyer_casino_alias: metadata.buyer_casino_alias || null,
      status: "pending_org_approval", // Waiting for org approval
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (purchaseError) {
    console.error("Error creating purchase record:", purchaseError);
    throw purchaseError;
  }

  // Update ticket status to pending organization approval
  const { error: ticketError } = await supabaseClient
    .from("tickets")
    .update({
      status: "pending_org_approval",
      buyer_id: buyerId,
      payment_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (ticketError) {
    console.error("Error updating ticket status:", ticketError);
    throw ticketError;
  }

  // Credit seller's wallet (held until payout approved)
  const { data: wallet } = await supabaseClient
    .from("wallets")
    .select("id, balance, pending_balance")
    .eq("user_id", sellerId)
    .maybeSingle();

  if (wallet) {
    await supabaseClient
      .from("wallets")
      .update({
        pending_balance: (wallet.pending_balance || 0) + sellerNet,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id);
  } else {
    // Create wallet if doesn't exist
    await supabaseClient
      .from("wallets")
      .insert({
        user_id: sellerId,
        balance: 0,
        pending_balance: sellerNet,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
  }

  console.log(`Checkout completed for ticket ${ticketId}, pending org approval`);
}

async function handleCheckoutExpired(supabaseClient: any, session: Stripe.Checkout.Session) {
  console.log(`Processing checkout.session.expired for ${session.id}`);

  const metadata = session.metadata || {};
  const ticketId = metadata.ticket_id;

  if (!ticketId) {
    console.log("No ticket_id in expired session metadata");
    return;
  }

  // Revert ticket to available
  const { error: ticketError } = await supabaseClient
    .from("tickets")
    .update({
      status: "available",
      pending_buyer_id: null,
      pending_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .eq("status", "pending");

  if (ticketError) {
    console.error("Error reverting ticket status:", ticketError);
  }

  // Update payment record
  const { error: paymentError } = await supabaseClient
    .from("stripe_payments")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("checkout_session_id", session.id);

  if (paymentError) {
    console.log("No payment record found for expired session");
  }

  console.log(`Ticket ${ticketId} reverted to available after checkout expiry`);
}

async function handlePaymentSucceeded(supabaseClient: any, paymentIntent: Stripe.PaymentIntent) {
  console.log(`Processing payment_intent.succeeded for ${paymentIntent.id}`);

  const { error } = await supabaseClient
    .from("stripe_payments")
    .update({
      status: "succeeded",
      updated_at: new Date().toISOString(),
    })
    .eq("payment_intent_id", paymentIntent.id);

  if (error) {
    console.error("Error updating payment status:", error);
  }
}

async function handlePaymentFailed(supabaseClient: any, paymentIntent: Stripe.PaymentIntent) {
  console.log(`Processing payment_intent.payment_failed for ${paymentIntent.id}`);

  const { data: payment } = await supabaseClient
    .from("stripe_payments")
    .select("ticket_id")
    .eq("payment_intent_id", paymentIntent.id)
    .maybeSingle();

  await supabaseClient
    .from("stripe_payments")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("payment_intent_id", paymentIntent.id);

  if (payment?.ticket_id) {
    await supabaseClient
      .from("tickets")
      .update({
        status: "available",
        pending_buyer_id: null,
        pending_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.ticket_id);
  }
}

async function handleChargeRefunded(supabaseClient: any, charge: Stripe.Charge) {
  console.log(`Processing charge.refunded for ${charge.id}`);

  const paymentIntentId = charge.payment_intent as string;

  const { data: payment } = await supabaseClient
    .from("stripe_payments")
    .select("ticket_id, seller_id, seller_net")
    .eq("payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (!payment) {
    console.error("Payment not found for refund:", paymentIntentId);
    return;
  }

  // Update payment status
  await supabaseClient
    .from("stripe_payments")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("payment_intent_id", paymentIntentId);

  // Update ticket back to available
  await supabaseClient
    .from("tickets")
    .update({
      status: "available",
      buyer_id: null,
      pending_buyer_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.ticket_id);

  // Update purchase record
  await supabaseClient
    .from("purchases")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("ticket_id", payment.ticket_id);

  // Deduct from seller's pending balance
  if (payment.seller_id && payment.seller_net) {
    const { data: wallet } = await supabaseClient
      .from("wallets")
      .select("id, pending_balance")
      .eq("user_id", payment.seller_id)
      .maybeSingle();

    if (wallet) {
      await supabaseClient
        .from("wallets")
        .update({
          pending_balance: Math.max(0, (wallet.pending_balance || 0) - payment.seller_net),
          updated_at: new Date().toISOString(),
        })
        .eq("id", wallet.id);
    }
  }

  console.log(`Refund processed for ticket ${payment.ticket_id}`);
}

async function handleDisputeCreated(supabaseClient: any, dispute: Stripe.Dispute) {
  console.log(`Processing charge.dispute.created for ${dispute.id}`);

  const paymentIntentId = dispute.payment_intent as string;

  await supabaseClient
    .from("stripe_payments")
    .update({
      status: "disputed",
      dispute_id: dispute.id,
      disputed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("payment_intent_id", paymentIntentId);

  // Get ticket and update status
  const { data: payment } = await supabaseClient
    .from("stripe_payments")
    .select("ticket_id")
    .eq("payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (payment?.ticket_id) {
    await supabaseClient
      .from("tickets")
      .update({
        status: "disputed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.ticket_id);

    await supabaseClient
      .from("purchases")
      .update({
        status: "disputed",
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_id", payment.ticket_id);
  }

  console.log(`Dispute created for payment ${paymentIntentId}`);
}

async function handleTransferCreated(supabaseClient: any, transfer: Stripe.Transfer) {
  console.log(`Processing transfer.created for ${transfer.id}`);

  const { error } = await supabaseClient
    .from("stripe_payouts")
    .update({
      status: "completed",
      transfer_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_transfer_id", transfer.id);

  if (error) {
    console.log("Transfer not found in stripe_payouts:", transfer.id);
  }
}

async function handleTransferFailed(supabaseClient: any, transfer: Stripe.Transfer) {
  console.log(`Processing transfer.failed for ${transfer.id}`);

  const { error } = await supabaseClient
    .from("stripe_payouts")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_transfer_id", transfer.id);

  if (error) {
    console.error("Error updating payout status:", error);
  }
}

async function handlePayoutPaid(supabaseClient: any, payout: Stripe.Payout) {
  console.log(`Processing payout.paid for ${payout.id}`);
  // This is for connected account payouts to their bank
  // Usually handled separately
}

async function handlePayoutFailed(supabaseClient: any, payout: Stripe.Payout) {
  console.log(`Processing payout.failed for ${payout.id}`);
  // This is for connected account payouts to their bank
}