import { Router } from "express";
import { stripe } from "../stripe";
import { supabase } from "../supabase";
import bodyParser from "body-parser";

const router = Router();

/**
 * Create PaymentIntent for buyer checkout
 */
router.post("/create-payment", async (req, res) => {
    try {
        const { ticketId, buyerId, amount, serviceFee } = req.body;

        if (!ticketId || !buyerId || !amount) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // 1️⃣ Create Stripe PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // cents
            currency: "usd", // change later if needed
            automatic_payment_methods: { enabled: true },
            metadata: {
                ticket_id: ticketId,
                buyer_id: buyerId,
            },
        });

        // 2️⃣ Store transaction in Supabase
        // const { error: transactionError } = await supabase
        //   .from("transactions")
        //   .insert({
        //     ticket_id: ticketId,
        //     buyer_id: buyerId,
        //     amount: amount,
        //     service_fee: serviceFee,
        //     payment_intent_id: paymentIntent.id,
        //     status: "pending",
        //   });

        // if (transactionError) {
        //   console.error(transactionError);
        //   return res.status(500).json({ error: "Failed to store transaction" });
        // }

        // 3️⃣ Return client secret
        return res.json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({
            error: err.message || "Stripe payment failed",
        });
    }
});

router.post("/create-checkout-session", async (req, res) => {
    try {
        const { ticketId, buyerId, amount, serviceFee } = req.body;

        if (!ticketId || !buyerId || !amount) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "Poker Tournament Ticket",
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                ticket_id: ticketId,
                buyer_id: buyerId,
            },
            success_url: "http://localhost:5173/checkout/success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url: `http://localhost:5173/checkout/${ticketId}`,
        });

        res.json({ url: session.url });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/verify-session", async (req, res) => {
    const sessionId = req.query.session_id as string;

    if (!sessionId) {
        return res.status(400).json({ valid: false });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
        return res.status(403).json({ valid: false });
    }

    res.json({ valid: true });
});

router.post("/admin/approve-payout", async (req, res) => {
    try {
        const { payoutId } = req.body;

        if (!payoutId) {
            return res.status(400).json({ error: "Missing payoutId" });
        }

        /**
         * 1. Fetch payout info from DB (mock for now)
         *    - amount
         *    - sellerStripeAccountId
         */
        const payout = {
            amount: 38000, // cents
            sellerStripeAccountId: "acct_123456789",
        };

        /**
         * 2. Tell Stripe to release money to seller
         */
        const transfer = await stripe.transfers.create({
            amount: payout.amount,
            currency: "usd",
            destination: payout.sellerStripeAccountId,
        });

        /**
         * 3. Update payout status in DB
         *    status = "approved" (or "processing")
         */

        res.json({ success: true, transferId: transfer.id });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/stripe/connect/onboard", async (req, res) => {
    try {
        const { userId, organizationId, email } = req.body;

        // 1. Create Express connected account
        const account = await stripe.accounts.create({
            type: "express",
            email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
        });

        // TODO: Save in DB -> stripe_accounts
        // stripe_account_id = account.id
        // onboarding_status = "pending"

        // 2. Create onboarding link
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: "http://localhost:5173/stripe/refresh",
            return_url: "http://localhost:5173/stripe/return",
            type: "account_onboarding",
        });

        res.json({
            stripe_account_id: account.id,
            url: accountLink.url,
        });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/stripe/connect/status/:accountId", async (req, res) => {
    try {
        const account = await stripe.accounts.retrieve(req.params.accountId);

        res.json({
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/stripe/create-checkout-session", async (req, res) => {
    try {
        const {
            ticketId,
            buyerId,
            sellerStripeAccountId,
            amount,          // full ticket price
            platformFee,     // admin + organization commission
        } = req.body;

        if (!ticketId || !buyerId || !sellerStripeAccountId || !amount) {
            return res.status(400).json({ error: "Missing fields" });
        }

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],

            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "Poker Tournament Ticket",
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],

            // 🔴 STRIPE CONNECT MAGIC
            payment_intent_data: {
                application_fee_amount: Math.round(platformFee * 100),
                transfer_data: {
                    destination: sellerStripeAccountId, // connected seller
                },
            },

            metadata: {
                ticket_id: ticketId,
                buyer_id: buyerId,
                seller_account: sellerStripeAccountId,
            },

            success_url: "http://localhost:5173/checkout/success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url: `http://localhost:5173/ticket/${ticketId}`,
        });

        // TODO: Insert into stripe_payments table
        // status = "pending"
        // checkout_session_id = session.id
        // payment_intent_id = session.payment_intent

        res.json({ url: session.url });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/stripe/execute-payout", async (req, res) => {
    try {
        const { sellerStripeAccountId, amount } = req.body;

        // Create payout to connected account
        const payout = await stripe.payouts.create(
            {
                amount: Math.round(amount * 100),
                currency: "usd",
            },
            {
                stripeAccount: sellerStripeAccountId,
            }
        );

        // TODO: Insert into stripe_payouts
        // status = payout.status
        // admin_approved = true

        res.json({ payout });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post(
    "/stripe/webhook",
    bodyParser.raw({ type: "application/json" }),
    (req, res) => {
        const sig = req.headers["stripe-signature"] as string;

        let event;

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET!
            );
        } catch (err: any) {
            console.error("Webhook error:", err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle events later
        switch (event.type) {
            case "checkout.session.completed":
                // update stripe_payments status = completed
                break;

            case "account.updated":
                // update stripe_accounts onboarding status
                break;

            case "payout.paid":
                // update stripe_payouts status
                break;
        }

        res.json({ received: true });
    }
);


export default router;
