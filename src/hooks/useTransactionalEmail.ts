import { supabase } from "@/integrations/supabase/client";

export type EmailType = 
  | "ticket_submitted"
  | "purchase_confirmation" 
  | "ticket_approved" 
  | "ticket_rejected"
  | "casino_approved" 
  | "casino_declined"
  | "payout_completed"
  | "payout_failed";

export const sendTicketSubmittedNotification = async (
  sellerEmail: string,
  data: {
    sellerName: string;
    tournamentName: string;
    venue: string;
    eventDate: string;
    askingPrice: number;
  }
) => {
  return sendTransactionalEmail({
    type: "ticket_submitted",
    to: sellerEmail,
    data,
  });
};

interface SendEmailParams {
  type: EmailType;
  to: string;
  data: Record<string, any>;
}

export const sendTransactionalEmail = async ({ type, to, data }: SendEmailParams) => {
  try {
    const { data: response, error } = await supabase.functions.invoke("send-transactional-email", {
      body: { type, to, data },
    });

    if (error) {
      console.error("Failed to send email:", error);
      throw error;
    }

    console.log("Email sent successfully:", response);
    return response;
  } catch (error) {
    console.error("Error sending transactional email:", error);
    throw error;
  }
};

// Helper functions for specific email types
export const sendPurchaseConfirmation = async (
  buyerEmail: string,
  data: {
    buyerName: string;
    tournamentName: string;
    venue: string;
    eventDate: string;
    buyIn: number;
    ticketPrice: number;
    serviceFee: number;
    totalAmount: number;
  }
) => {
  return sendTransactionalEmail({
    type: "purchase_confirmation",
    to: buyerEmail,
    data,
  });
};

export const sendTicketApprovalNotification = async (
  sellerEmail: string,
  data: {
    sellerName: string;
    tournamentName: string;
    venue: string;
    eventDate: string;
    askingPrice: number;
  }
) => {
  return sendTransactionalEmail({
    type: "ticket_approved",
    to: sellerEmail,
    data,
  });
};

export const sendTicketRejectionNotification = async (
  sellerEmail: string,
  data: {
    sellerName: string;
    tournamentName: string;
    venue: string;
    reason?: string;
  }
) => {
  return sendTransactionalEmail({
    type: "ticket_rejected",
    to: sellerEmail,
    data,
  });
};

export const sendCasinoApprovalNotification = async (
  recipientEmail: string,
  data: {
    recipientName: string;
    tournamentName: string;
    venue: string;
    eventDate: string;
    isBuyer: boolean;
    amount?: number;
  }
) => {
  return sendTransactionalEmail({
    type: "casino_approved",
    to: recipientEmail,
    data,
  });
};

export const sendCasinoDeclineNotification = async (
  recipientEmail: string,
  data: {
    recipientName: string;
    tournamentName: string;
    venue: string;
    isBuyer: boolean;
    notes?: string;
  }
) => {
  return sendTransactionalEmail({
    type: "casino_declined",
    to: recipientEmail,
    data,
  });
};

export const sendPayoutCompletedNotification = async (
  userEmail: string,
  data: {
    userName: string;
    amount: number;
    method: string;
    completedAt: string;
  }
) => {
  return sendTransactionalEmail({
    type: "payout_completed",
    to: userEmail,
    data,
  });
};

export const sendPayoutFailedNotification = async (
  userEmail: string,
  data: {
    userName: string;
    amount: number;
    method: string;
    reason?: string;
  }
) => {
  return sendTransactionalEmail({
    type: "payout_failed",
    to: userEmail,
    data,
  });
};
