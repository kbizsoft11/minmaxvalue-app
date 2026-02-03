import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_PERCENT = 8;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:5173";

        if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
            throw new Error("Missing required environment variables");
        }

        // 🔵 Get user from auth header
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

        const { ticket_id, buyer_info } = await req.json();

        if (!ticket_id) {
            return new Response(JSON.stringify({ error: "Ticket ID required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }


        // 🔹 Load ticket + seller
        const { data: ticket, error: ticketError } = await supabaseClient
            .from("tickets")
            .select("*")
            .eq("id", ticket_id)
            .maybeSingle();

        console.log("Fetched ticket:", ticket);
        console.log("Ticket error:", ticketError);

        if (ticketError || !ticket) {
            return new Response(JSON.stringify({ error: "Ticket not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }


        if (ticket.status !== "available") {
            return new Response(JSON.stringify({ error: "Ticket is not available" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (ticket.seller_id === user.id) {
            return new Response(JSON.stringify({ error: "Cannot purchase your own ticket" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 🔴 Load seller Stripe account securely
        const { data: stripeAccount, error: stripeAccountError } = await supabaseClient
            .from("stripe_accounts")
            .select("stripe_account_id, charges_enabled, payouts_enabled")
            .eq("user_id", ticket.seller_id)
            .eq("account_type", "seller")
            .single();

        if (stripeAccountError || !stripeAccount) {
            return new Response(JSON.stringify({ error: "Seller is not connected with Stripe" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!stripeAccount.charges_enabled || !stripeAccount.payouts_enabled) {
            return new Response(JSON.stringify({ error: "Seller has not completed Stripe verification" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const sellerStripeAccountId = stripeAccount.stripe_account_id;

        // 🔹 Calculate amounts (ALREADY IN CENTS)
        const ticketPriceCents = ticket.asking_price;
        const platformFee = Math.round(ticketPriceCents * (PLATFORM_FEE_PERCENT / 100));

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: "2023-10-16",
        });

        // 🟢 CREATE STRIPE CONNECT CHECKOUT SESSION (SPLIT PAYMENT)
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],

            // ONLY TICKET PRICE (NO SERVICE FEE LINE ITEM)
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: ticket.tournament_name,
                            description: `${ticket.venue} - ${ticket.event_date}`,
                        },
                        unit_amount: ticketPriceCents,
                    },
                    quantity: 1,
                },
            ],

            // 🔴 STRIPE CONNECT SPLIT MAGIC
            payment_intent_data: {
                application_fee_amount: platformFee, // PLATFORM 8%
                transfer_data: {
                    destination: sellerStripeAccountId, // SELLER GETS REST
                },
            },

            metadata: {
                ticket_id,
                buyer_id: user.id,
                seller_id: ticket.seller_id,
                ticket_price: ticketPriceCents.toString(),
                platform_fee: platformFee.toString(),
                buyer_first_name: buyer_info?.first_name || "",
                buyer_last_name: buyer_info?.last_name || "",
                buyer_dob: buyer_info?.dob || "",
                buyer_casino_alias: buyer_info?.casino_alias || "",
            },

            success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${siteUrl}/ticket/${ticket_id}?canceled=true`,
            expires_at: Math.floor(Date.now() / 1000) + 1800,
        });

        // 🔹 Mark ticket as pending
        const { error: updateError } = await supabaseClient
            .from("tickets")
            .update({ status: "pending", updated_at: new Date().toISOString() })
            .eq("id", ticket_id)
            .eq("status", "available");

        if (updateError) {
            console.error("Failed to mark ticket as pending:", updateError);
        }

        // 🔹 Insert payment record
        const { error: paymentError } = await supabaseClient
            .from("stripe_payments")
            .insert({
                payment_intent_id: session.payment_intent as string,
                checkout_session_id: session.id,
                buyer_id: user.id,
                ticket_id,
                amount: ticketPriceCents + platformFee,
                currency: "USD",
                status: "pending",
            });

        if (paymentError) {
            console.error("Failed to insert payment record:", paymentError);
        }

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
        console.error("Error in create-checkout-session:", error);
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
