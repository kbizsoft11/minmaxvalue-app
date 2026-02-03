import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const results: Record<string, number> = {};

  try {
    console.log("Starting cleanup job at", new Date().toISOString());

    // 1. Revert pending tickets older than 24 hours back to available
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Get tickets that have been pending for more than 24 hours
    const { data: expiredPendingTickets, error: ticketFetchError } = await supabase
      .from("tickets")
      .select("id")
      .eq("status", "pending")
      .lt("updated_at", twentyFourHoursAgo);

    if (ticketFetchError) {
      console.error("Error fetching expired pending tickets:", ticketFetchError);
    } else if (expiredPendingTickets && expiredPendingTickets.length > 0) {
      const ticketIds = expiredPendingTickets.map(t => t.id);
      
      const { error: ticketUpdateError } = await supabase
        .from("tickets")
        .update({ status: "available", updated_at: new Date().toISOString() })
        .in("id", ticketIds);

      if (ticketUpdateError) {
        console.error("Error reverting expired pending tickets:", ticketUpdateError);
      } else {
        results.revertedTickets = ticketIds.length;
        console.log(`Reverted ${ticketIds.length} expired pending tickets to available`);
      }
    } else {
      results.revertedTickets = 0;
    }

    // 2. Clean up old rate limit records (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: deletedRateLimits, error: rateLimitError } = await supabase
      .from("rate_limits")
      .delete()
      .lt("window_start", oneHourAgo)
      .select("id");

    if (rateLimitError) {
      console.error("Error cleaning up rate limits:", rateLimitError);
    } else {
      results.deletedRateLimits = deletedRateLimits?.length || 0;
      console.log(`Deleted ${results.deletedRateLimits} expired rate limit records`);
    }

    // 3. Clean up expired casino invitations (expired and not accepted)
    const { data: deletedInvitations, error: invitationError } = await supabase
      .from("casino_invitations")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .neq("status", "accepted")
      .select("id");

    if (invitationError) {
      console.error("Error cleaning up expired invitations:", invitationError);
    } else {
      results.deletedInvitations = deletedInvitations?.length || 0;
      console.log(`Deleted ${results.deletedInvitations} expired casino invitations`);
    }

    // 4. Update casino verifications that are expired (24hrs without action) - mark as expired
    const { data: expiredVerifications, error: verificationFetchError } = await supabase
      .from("casino_verifications")
      .select("id, purchase_id")
      .eq("status", "pending")
      .lt("created_at", twentyFourHoursAgo);

    if (verificationFetchError) {
      console.error("Error fetching expired verifications:", verificationFetchError);
    } else if (expiredVerifications && expiredVerifications.length > 0) {
      // Mark verifications as expired (admins will be notified)
      const verificationIds = expiredVerifications.map(v => v.id);
      
      const { error: verificationUpdateError } = await supabase
        .from("casino_verifications")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .in("id", verificationIds);

      if (verificationUpdateError) {
        console.error("Error updating expired verifications:", verificationUpdateError);
      } else {
        results.expiredVerifications = verificationIds.length;
        console.log(`Marked ${verificationIds.length} casino verifications as expired`);
      }
    } else {
      results.expiredVerifications = 0;
    }

    console.log("Cleanup job completed:", results);

    return new Response(
      JSON.stringify({ success: true, results, timestamp: new Date().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Cleanup job failed:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
