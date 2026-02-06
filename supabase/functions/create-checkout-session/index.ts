import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform fee charged to buyer (8%)
const PLATFORM_FEE_PERCENT = 8;

serve(async (req) => {
  console.log("========== EDGE FUNCTION START ==========");
  console.log("Request method:", req.method);
  console.log("Request URL:", req.url);

  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========== STEP 1: ENV VARIABLES ==========
    console.log("STEP 1: Checking environment variables...");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:5173";

    console.log("STRIPE_SECRET_KEY exists:", !!stripeSecretKey);
    console.log("SUPABASE_URL:", supabaseUrl);
    console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!supabaseServiceKey);
    console.log("SITE_URL:", siteUrl);

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      console.error("STEP 1 FAILED: Missing environment variables");
      throw new Error("Missing required environment variables");
    }
    console.log("STEP 1 PASSED: All env variables present");

    // ========== STEP 2: AUTH CHECK ==========
    console.log("STEP 2: Checking authorization...");
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header exists:", !!authHeader);

    if (!authHeader) {
      console.error("STEP 2 FAILED: No authorization header");
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
    console.log("Token extracted (first 20 chars):", token.substring(0, 20) + "...");

    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    console.log("User ID:", user?.id);
    console.log("Auth error:", authError);

    if (authError || !user) {
      console.error("STEP 2 FAILED: Auth error or no user");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("STEP 2 PASSED: User authenticated");

    // ========== STEP 3: PARSE REQUEST BODY ==========
    console.log("STEP 3: Parsing request body...");
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body, null, 2));

    const { ticket_id, buyer_info } = body;
    console.log("ticket_id:", ticket_id);
    console.log("buyer_info:", buyer_info);

    if (!ticket_id) {
      console.error("STEP 3 FAILED: No ticket_id");
      return new Response(JSON.stringify({ error: "Ticket ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("STEP 3 PASSED: Request body parsed");

    // ========== STEP 4: FETCH TICKET ==========
    console.log("STEP 4: Fetching ticket...");
    console.log("Query: tickets.select(*).eq(id, " + ticket_id + ").eq(status, available)");

    const { data: ticket, error: ticketError } = await supabaseClient
      .from("tickets")
      .select("*")
      .eq("id", ticket_id)
      .eq("status", "available")
      .maybeSingle();

    console.log("Ticket query complete");
    console.log("Ticket data:", JSON.stringify(ticket, null, 2));
    console.log("Ticket error:", ticketError);

    if (ticketError) {
      console.error("STEP 4 FAILED: Ticket query error");
      console.error("Error details:", JSON.stringify(ticketError, null, 2));
      throw new Error("Failed to fetch ticket");
    }

    if (!ticket) {
      console.error("STEP 4 FAILED: Ticket not found");
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Ticket found:");
    console.log("- ID:", ticket.id);
    console.log("- Status:", ticket.status);
    console.log("- Seller ID:", ticket.seller_id);
    console.log("- Asking Price:", ticket.asking_price);
    console.log("STEP 4 PASSED: Ticket fetched");

    // ========== STEP 5: VALIDATE TICKET ==========
    console.log("STEP 5: Validating ticket...");

    if (ticket.status !== "available") {
      console.error("STEP 5 FAILED: Ticket not available, status:", ticket.status);
      return new Response(JSON.stringify({ error: "Ticket is not available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ticket.seller_id === user.id) {
      console.error("STEP 5 FAILED: Buyer is the seller");
      return new Response(JSON.stringify({ error: "Cannot purchase your own ticket" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("STEP 5 PASSED: Ticket validated");

    // ========== STEP 6: FETCH SELLER STRIPE ACCOUNT ==========
    console.log("STEP 6: Fetching seller Stripe account...");
    console.log("Query: stripe_accounts.select(...).eq(user_id, " + ticket.seller_id + ").eq(account_type, seller)");

    const { data: sellerStripeAccount, error: stripeAccountError } = await supabaseClient
      .from("stripe_accounts")
      .select("stripe_account_id, charges_enabled, payouts_enabled")
      .eq("user_id", ticket.seller_id)
      .eq("account_type", "seller")
      .maybeSingle();

    console.log("Stripe account query complete");
    console.log("Stripe account data:", JSON.stringify(sellerStripeAccount, null, 2));
    console.log("Stripe account error:", stripeAccountError);

    if (stripeAccountError || !sellerStripeAccount) {
      console.error("STEP 6 FAILED: Seller not connected with Stripe");
      return new Response(JSON.stringify({ error: "Seller is not connected with Stripe" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sellerStripeAccount.charges_enabled || !sellerStripeAccount.payouts_enabled) {
      console.error("STEP 6 FAILED: Seller Stripe not fully enabled");
      console.log("- charges_enabled:", sellerStripeAccount.charges_enabled);
      console.log("- payouts_enabled:", sellerStripeAccount.payouts_enabled);
      return new Response(JSON.stringify({ error: "Seller has not completed Stripe verification" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("STEP 6 PASSED: Seller Stripe account verified");

    // ========== STEP 7: CALCULATE AMOUNTS ==========
    console.log("STEP 7: Calculating amounts...");
    const ticketPriceCents = ticket.asking_price;
    const platformFeeCents = Math.round(ticketPriceCents * (PLATFORM_FEE_PERCENT / 100));
    const orgCommissionRate = 0; // No organization for now
    const sellerGrossCents = ticketPriceCents;
    const orgFeeCents = Math.round(sellerGrossCents * (orgCommissionRate / 100));
    const sellerNetCents = sellerGrossCents - orgFeeCents;
    const totalAmountCents = ticketPriceCents + platformFeeCents;

    console.log("- Ticket Price (cents):", ticketPriceCents);
    console.log("- Platform Fee (cents):", platformFeeCents);
    console.log("- Org Fee (cents):", orgFeeCents);
    console.log("- Seller Net (cents):", sellerNetCents);
    console.log("- Total Amount (cents):", totalAmountCents);
    console.log("STEP 7 PASSED: Amounts calculated");

    // ========== STEP 8: UPDATE TICKET TO PENDING ==========
    console.log("STEP 8: Marking ticket as pending...");

    const { data: updateResult, error: updateError } = await supabaseClient
      .from("tickets")
      .update({
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket_id)
      .eq("status", "available")
      .select();

    console.log("Update result:", JSON.stringify(updateResult, null, 2));
    console.log("Update error:", updateError);

    if (updateError || !updateResult || updateResult.length === 0) {
      console.error("STEP 8 FAILED: Could not update ticket");
      return new Response(
        JSON.stringify({ error: "Ticket is no longer available" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("STEP 8 PASSED: Ticket marked as pending");

    // ========== STEP 9: CREATE STRIPE SESSION ==========
    console.log("STEP 9: Creating Stripe checkout session...");

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const sessionParams = {
      mode: "payment" as const,
      payment_method_types: ["card" as const],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: ticket.tournament_name || "Tournament Ticket",
              description: `${ticket.venue || "Venue TBD"} - ${ticket.event_date ? new Date(ticket.event_date).toLocaleDateString() : "Date TBD"}`,
            },
            unit_amount: ticketPriceCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Service Fee",
              description: "Marketplace service fee",
            },
            unit_amount: platformFeeCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        ticket_id,
        buyer_id: user.id,
        seller_id: ticket.seller_id,
        ticket_price: ticketPriceCents.toString(),
        platform_fee: platformFeeCents.toString(),
        org_fee: orgFeeCents.toString(),
        seller_net: sellerNetCents.toString(),
        total_amount: totalAmountCents.toString(),
        buyer_first_name: buyer_info?.first_name || "",
        buyer_last_name: buyer_info?.last_name || "",
        buyer_dob: buyer_info?.dob || "",
        buyer_casino_alias: buyer_info?.casino_alias || "",
      },
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/${ticket_id}?canceled=true`,
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    };

    console.log("Stripe session params:", JSON.stringify(sessionParams, null, 2));

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("Stripe session created:");
    console.log("- Session ID:", session.id);
    console.log("- Session URL:", session.url);
    console.log("STEP 9 PASSED: Stripe session created");

    // ========== STEP 10: INSERT PAYMENT RECORD ==========
    console.log("STEP 10: Inserting payment record...");

    const paymentRecord = {
      checkout_session_id: session.id,
      payment_intent_id: null,
      buyer_id: user.id,
      seller_id: ticket.seller_id,
      ticket_id,
      amount: totalAmountCents,
      ticket_price: ticketPriceCents,
      platform_fee: platformFeeCents,
      org_fee: orgFeeCents,
      seller_net: sellerNetCents,
      currency: "USD",
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("Payment record:", JSON.stringify(paymentRecord, null, 2));

    const { error: paymentError } = await supabaseClient
      .from("stripe_payments")
      .insert(paymentRecord);

    if (paymentError) {
      console.error("STEP 10 WARNING: Failed to insert payment record");
      console.error("Payment error:", JSON.stringify(paymentError, null, 2));
    } else {
      console.log("STEP 10 PASSED: Payment record inserted");
    }

    // ========== SUCCESS ==========
    console.log("========== SUCCESS ==========");
    console.log("Returning checkout URL:", session.url);

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: unknown) {
    console.error("========== ERROR ==========");
    console.error("Error type:", typeof error);
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Error message:", message);

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});