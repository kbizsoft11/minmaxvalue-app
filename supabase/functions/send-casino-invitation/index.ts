import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  organizationName: string;
  invitationId: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-casino-invitation function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the user is an admin
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: adminRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!adminRole) {
      console.error("User is not an admin");
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, organizationName, invitationId }: InvitationRequest = await req.json();
    
    console.log(`Sending invitation email to ${email} for organization ${organizationName}`);

    const siteUrl = Deno.env.get("SITE_URL") || "https://your-app-url.lovable.app";

    const emailResponse = await resend.emails.send({
      from: "Casino Marketplace <invites@minmaxvalue.com>",
      to: [email],
      subject: `You've been invited to join ${organizationName} on Casino Marketplace`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; background-color: #0a1628;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a1628; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background: linear-gradient(145deg, #0f2035, #0a1628); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.4);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1de9b6, #a8e063); padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #0a1628; letter-spacing: -0.5px;">Casino Verification Invitation</h1>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px; color: #e8f0f2;">
                      <p style="margin: 0 0 20px; font-size: 16px;">Hello,</p>
                      <p style="margin: 0 0 20px; font-size: 16px;">You have been invited to join <strong style="color: #1de9b6;">${organizationName}</strong> as a Casino User on our marketplace platform.</p>
                      <p style="margin: 0 0 16px; font-size: 16px;">As a Casino User, you'll be able to:</p>
                      <ul style="margin: 0 0 24px; padding-left: 20px; color: #a8b5c2;">
                        <li style="margin-bottom: 8px;">Verify ticket transactions for your organization</li>
                        <li style="margin-bottom: 8px;">Access the casino verification dashboard</li>
                        <li style="margin-bottom: 8px;">View transaction history</li>
                      </ul>
                      <p style="margin: 0 0 30px; font-size: 16px;">To accept this invitation, please sign up or log in using this email address: <strong style="color: #1de9b6;">${email}</strong></p>
                      <!-- Button -->
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                        <tr>
                          <td style="border-radius: 12px; background: linear-gradient(135deg, #1de9b6, #a8e063); box-shadow: 0 4px 20px rgba(29, 233, 182, 0.3);">
                            <a href="${siteUrl}/auth" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #0a1628; text-decoration: none; letter-spacing: 0.5px;">Accept Invitation</a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 30px 0 0; font-size: 14px; color: #6b7b8a;">If you didn't expect this invitation, you can safely ignore this email.</p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 30px; text-align: center; border-top: 1px solid #1a3050;">
                      <p style="margin: 0; font-size: 13px; color: #4a5a6a;">This invitation was sent by Casino Marketplace</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-casino-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
