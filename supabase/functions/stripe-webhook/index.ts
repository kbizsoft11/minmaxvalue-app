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

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing required environment variables");
    return new Response("Server configuration error", { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2023-10-16",
  });

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;
  const body = await req.text();

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
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
        await handleCheckoutCompleted(supabaseClient, stripe, session);
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

async function handleAccountUpdated(supabaseClient: any, account: Stripe.Account) {
  console.log(`Processing account.updated for ${account.id}`);

  // Determine onboarding status
  let onboardingStatus = "pending";
  if (account.details_submitted && account.charges_enabled) {
    onboardingStatus = "complete";
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
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  console.log(`Processing checkout.session.completed for ${session.id}`);

  const metadata = session.metadata || {};
  const ticketId = metadata.ticket_id;
  const buyerId = metadata.buyer_id;

  if (!ticketId || !buyerId) {
    console.error("Missing ticket_id or buyer_id in session metadata");
    return;
  }

  // Update stripe_payments record
  const paymentIntentId = session.payment_intent as string;

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

  // Create purchase record
  const ticketPrice = parseInt(metadata.ticket_price || "0");
  const serviceFee = parseInt(metadata.service_fee || "0");

  const { error: purchaseError } = await supabaseClient
    .from("purchases")
    .insert({
      ticket_id: ticketId,
      buyer_id: buyerId,
      ticket_price: ticketPrice,
      service_fee: serviceFee,
      total_amount: ticketPrice + serviceFee,
      buyer_first_name: metadata.buyer_first_name || null,
      buyer_last_name: metadata.buyer_last_name || null,
      buyer_dob: metadata.buyer_dob || null,
      buyer_casino_alias: metadata.buyer_casino_alias || null,
    });

  if (purchaseError) {
    console.error("Error creating purchase record:", purchaseError);
    throw purchaseError;
  }

  console.log(`Checkout completed for ticket ${ticketId}`);
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
    throw error;
  }
}

async function handlePaymentFailed(supabaseClient: any, paymentIntent: Stripe.PaymentIntent) {
  console.log(`Processing payment_intent.payment_failed for ${paymentIntent.id}`);

  // Get the payment record to find the ticket
  const { data: payment } = await supabaseClient
    .from("stripe_payments")
    .select("ticket_id")
    .eq("payment_intent_id", paymentIntent.id)
    .maybeSingle();

  // Update payment status
  const { error: paymentError } = await supabaseClient
    .from("stripe_payments")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("payment_intent_id", paymentIntent.id);

  if (paymentError) {
    console.error("Error updating payment status:", paymentError);
  }

  // Revert ticket to available
  if (payment?.ticket_id) {
    const { error: ticketError } = await supabaseClient
      .from("tickets")
      .update({
        status: "available",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.ticket_id);

    if (ticketError) {
      console.error("Error reverting ticket status:", ticketError);
    }
  }
}

async function handlePayoutPaid(supabaseClient: any, payout: Stripe.Payout) {
  console.log(`Processing payout.paid for ${payout.id}`);

  // Note: Stripe payouts are different from our transfers to connected accounts
  // This handles payouts FROM connected accounts to their bank accounts
  // We track transfers separately in stripe_payouts table
}

async function handlePayoutFailed(supabaseClient: any, payout: Stripe.Payout) {
  console.log(`Processing payout.failed for ${payout.id}`);

  // Note: Similar to payout.paid, this is for connected account payouts to banks
}

async function handleTransferCreated(supabaseClient: any, transfer: Stripe.Transfer) {
  console.log(`Processing transfer.created for ${transfer.id}`);

  // Update stripe_payouts record with transfer ID
  const { error } = await supabaseClient
    .from("stripe_payouts")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_transfer_id", transfer.id);

  if (error) {
    // Transfer might not be in our system yet, that's okay
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
