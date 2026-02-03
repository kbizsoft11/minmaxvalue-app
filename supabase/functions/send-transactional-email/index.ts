import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SITE_URL = Deno.env.get("SITE_URL") || "https://minmaxvalue.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EmailType = 
  | "ticket_submitted"
  | "purchase_confirmation" 
  | "ticket_approved" 
  | "ticket_rejected"
  | "casino_approved" 
  | "casino_declined"
  | "payout_completed"
  | "payout_failed";

interface EmailRequest {
  type: EmailType;
  to: string;
  data: Record<string, any>;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function getEmailContent(type: EmailType, data: Record<string, any>): { subject: string; html: string } {
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
      .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
      .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .detail-row { padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
      .detail-label { color: #6b7280; font-size: 14px; }
      .detail-value { font-weight: 600; }
      .success { color: #16a34a; }
      .warning { color: #f97316; }
      .error { color: #dc2626; }
    </style>
  `;

  switch (type) {
    case "ticket_submitted":
      return {
        subject: `Ticket Submitted for Review - ${data.tournamentName}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>🎟️ Ticket Submitted!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.sellerName},</p>
              <p>Your ticket listing has been submitted and is pending review by our team.</p>
              
              <h3>Listing Details</h3>
              <div class="detail-row">
                <span class="detail-label">Tournament:</span>
                <span class="detail-value">${data.tournamentName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Venue:</span>
                <span class="detail-value">${data.venue}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Event Date:</span>
                <span class="detail-value">${data.eventDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Asking Price:</span>
                <span class="detail-value">${formatCurrency(data.askingPrice)}</span>
              </div>
              
              <p class="warning">⏳ We'll notify you once your listing has been reviewed. This usually takes less than 24 hours.</p>
              
              <a href="${SITE_URL}/my-listings" class="button">View Your Listings</a>
            </div>
            <div class="footer">
              <p>MinMaxValue - Your Poker Ticket Marketplace</p>
            </div>
          </div>
        `
      };

    case "purchase_confirmation":
      return {
        subject: `Purchase Confirmed - ${data.tournamentName}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>🎟️ Purchase Confirmed!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.buyerName},</p>
              <p>Your ticket purchase has been confirmed and is now pending casino verification.</p>
              
              <h3>Order Details</h3>
              <div class="detail-row">
                <span class="detail-label">Tournament:</span>
                <span class="detail-value">${data.tournamentName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Venue:</span>
                <span class="detail-value">${data.venue}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Event Date:</span>
                <span class="detail-value">${data.eventDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Buy-in:</span>
                <span class="detail-value">${formatCurrency(data.buyIn)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Ticket Price:</span>
                <span class="detail-value">${formatCurrency(data.ticketPrice)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Service Fee:</span>
                <span class="detail-value">${formatCurrency(data.serviceFee)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label"><strong>Total Paid:</strong></span>
                <span class="detail-value"><strong>${formatCurrency(data.totalAmount)}</strong></span>
              </div>
              
              <p class="warning">⏳ Your ticket is pending casino verification. You'll receive another email once the transfer is approved.</p>
              
              <a href="${SITE_URL}/ticket-history" class="button">View Your Orders</a>
            </div>
            <div class="footer">
              <p>MinMaxValue - Your Poker Ticket Marketplace</p>
            </div>
          </div>
        `
      };

    case "ticket_approved":
      return {
        subject: `Your Ticket Listing is Now Live! - ${data.tournamentName}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>✅ Listing Approved!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.sellerName},</p>
              <p class="success">Great news! Your ticket listing has been approved and is now live on the marketplace.</p>
              
              <h3>Listing Details</h3>
              <div class="detail-row">
                <span class="detail-label">Tournament:</span>
                <span class="detail-value">${data.tournamentName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Venue:</span>
                <span class="detail-value">${data.venue}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Event Date:</span>
                <span class="detail-value">${data.eventDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Asking Price:</span>
                <span class="detail-value">${formatCurrency(data.askingPrice)}</span>
              </div>
              
              <a href="${SITE_URL}/my-listings" class="button">View Your Listings</a>
            </div>
            <div class="footer">
              <p>MinMaxValue - Your Poker Ticket Marketplace</p>
            </div>
          </div>
        `
      };

    case "ticket_rejected":
      return {
        subject: `Listing Not Approved - ${data.tournamentName}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #dc2626, #b91c1c);">
              <h1>❌ Listing Not Approved</h1>
            </div>
            <div class="content">
              <p>Hi ${data.sellerName},</p>
              <p>Unfortunately, your ticket listing was not approved.</p>
              
              <h3>Listing Details</h3>
              <div class="detail-row">
                <span class="detail-label">Tournament:</span>
                <span class="detail-value">${data.tournamentName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Venue:</span>
                <span class="detail-value">${data.venue}</span>
              </div>
              
              ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
              
              <p>If you believe this was a mistake, please contact our support team.</p>
              
              <a href="${SITE_URL}/contact" class="button">Contact Support</a>
            </div>
            <div class="footer">
              <p>MinMaxValue - Your Poker Ticket Marketplace</p>
            </div>
          </div>
        `
      };

    case "casino_approved":
      return {
        subject: `Transfer Approved! - ${data.tournamentName}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #16a34a, #15803d);">
              <h1>🎉 Transfer Approved!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.recipientName},</p>
              <p class="success">The casino has verified and approved the ticket transfer!</p>
              
              <h3>Transaction Details</h3>
              <div class="detail-row">
                <span class="detail-label">Tournament:</span>
                <span class="detail-value">${data.tournamentName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Venue:</span>
                <span class="detail-value">${data.venue}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Event Date:</span>
                <span class="detail-value">${data.eventDate}</span>
              </div>
              
              ${data.isBuyer ? `
                <p>🎟️ Your ticket is now confirmed. Good luck at the tournament!</p>
                <a href="${SITE_URL}/ticket-history" class="button">View Your Tickets</a>
              ` : `
                <p>💰 The sale proceeds have been added to your wallet balance.</p>
                <div class="detail-row">
                  <span class="detail-label">Amount Credited:</span>
                  <span class="detail-value success">${formatCurrency(data.amount)}</span>
                </div>
                <a href="${SITE_URL}/seller-dashboard" class="button">View Your Dashboard</a>
              `}
            </div>
            <div class="footer">
              <p>MinMaxValue - Your Poker Ticket Marketplace</p>
            </div>
          </div>
        `
      };

    case "casino_declined":
      return {
        subject: `Transfer Declined - ${data.tournamentName}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #dc2626, #b91c1c);">
              <h1>❌ Transfer Declined</h1>
            </div>
            <div class="content">
              <p>Hi ${data.recipientName},</p>
              <p class="error">Unfortunately, the casino has declined the ticket transfer.</p>
              
              <h3>Transaction Details</h3>
              <div class="detail-row">
                <span class="detail-label">Tournament:</span>
                <span class="detail-value">${data.tournamentName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Venue:</span>
                <span class="detail-value">${data.venue}</span>
              </div>
              
              ${data.notes ? `<p><strong>Casino Notes:</strong> ${data.notes}</p>` : ''}
              
              ${data.isBuyer ? `
                <p>Your payment will not be processed. The ticket is now available for other buyers.</p>
              ` : `
                <p>Your ticket listing has been returned to available status.</p>
              `}
              
              <a href="${SITE_URL}/contact" class="button">Contact Support</a>
            </div>
            <div class="footer">
              <p>MinMaxValue - Your Poker Ticket Marketplace</p>
            </div>
          </div>
        `
      };

    case "payout_completed":
      return {
        subject: `Payout Completed - ${formatCurrency(data.amount)}`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #16a34a, #15803d);">
              <h1>💸 Payout Completed!</h1>
            </div>
            <div class="content">
              <p>Hi ${data.userName},</p>
              <p class="success">Your payout request has been completed successfully!</p>
              
              <h3>Payout Details</h3>
              <div class="detail-row">
                <span class="detail-label">Amount:</span>
                <span class="detail-value success">${formatCurrency(data.amount)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Method:</span>
                <span class="detail-value">${data.method}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Completed At:</span>
                <span class="detail-value">${data.completedAt}</span>
              </div>
              
              <p>The funds should arrive in your account within 1-3 business days depending on your payment method.</p>
              
              <a href="${SITE_URL}/seller-dashboard" class="button">View Dashboard</a>
            </div>
            <div class="footer">
              <p>MinMaxValue - Your Poker Ticket Marketplace</p>
            </div>
          </div>
        `
      };

    case "payout_failed":
      return {
        subject: `Payout Failed - Action Required`,
        html: `
          ${baseStyles}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #dc2626, #b91c1c);">
              <h1>⚠️ Payout Failed</h1>
            </div>
            <div class="content">
              <p>Hi ${data.userName},</p>
              <p class="error">Unfortunately, your payout request could not be processed.</p>
              
              <h3>Payout Details</h3>
              <div class="detail-row">
                <span class="detail-label">Amount:</span>
                <span class="detail-value">${formatCurrency(data.amount)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Method:</span>
                <span class="detail-value">${data.method}</span>
              </div>
              
              ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
              
              <p>Please verify your payment details and try again, or contact our support team for assistance.</p>
              
              <a href="${SITE_URL}/contact" class="button">Contact Support</a>
            </div>
            <div class="footer">
              <p>MinMaxValue - Your Poker Ticket Marketplace</p>
            </div>
          </div>
        `
      };

    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, to, data }: EmailRequest = await req.json();
    
    console.log(`Sending ${type} email to ${to}`, data);

    const { subject, html } = getEmailContent(type, data);

    const emailResponse = await resend.emails.send({
      from: "MinMaxValue <no-reply@minmaxvalue.com>",
      to: [to],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
