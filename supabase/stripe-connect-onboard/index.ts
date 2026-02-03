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
    const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:5173";

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

    const { account_type, organization_id } = await req.json();

    // Validate account type
    if (!["seller", "organization"].includes(account_type)) {
      return new Response(JSON.stringify({ error: "Invalid account type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For organization accounts, verify user has access
    if (account_type === "organization" && !organization_id) {
      return new Response(JSON.stringify({ error: "Organization ID required for organization accounts" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if account already exists
    let existingQuery = supabaseClient
      .from("stripe_accounts")
      .select("*");

    if (account_type === "seller") {
      existingQuery = existingQuery.eq("user_id", user.id).eq("account_type", "seller");
    } else {
      existingQuery = existingQuery.eq("organization_id", organization_id).eq("account_type", "organization");
    }

    const { data: existingAccount } = await existingQuery.maybeSingle();

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    let stripeAccountId: string;

    if (existingAccount?.stripe_account_id) {
      // Account exists, create new account link for continuing onboarding
      stripeAccountId = existingAccount.stripe_account_id;
    } else {
      // Get user email for the connected account
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .single();

      // Create new Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: "express",
        email: profile?.email || user.email,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true }
        },
        settings: {
          payouts: {
            schedule: {
              interval: "manual",
            },
          },
        },
      });

      stripeAccountId = account.id;

      // Insert into stripe_accounts table
      const insertData: Record<string, unknown> = {
        stripe_account_id: stripeAccountId,
        account_type,
        onboarding_status: "pending",
        charges_enabled: false,
        payouts_enabled: false,
      };

      if (account_type === "seller") {
        insertData.user_id = user.id;
      } else {
        insertData.organization_id = organization_id;
      }

      const { error: insertError } = await supabaseClient
        .from("stripe_accounts")
        .insert(insertData);

      if (insertError) {
        console.error("Error inserting stripe account:", insertError);
        throw new Error("Failed to save Stripe account");
      }
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}/seller-dashboard?stripe_refresh=true`,
      return_url: `${siteUrl}/seller-dashboard?stripe_onboarded=true`,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({
        url: accountLink.url,
        stripe_account_id: stripeAccountId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in stripe-connect-onboard:", error);
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
