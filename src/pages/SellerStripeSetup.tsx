import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

type StripeStatus = "not_connected" | "pending" | "completed";

export default function SellerStripeSetup() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [status, setStatus] = useState<StripeStatus>("not_connected");

    // 🔵 On load: check redirect params + load status
    useEffect(() => {
        const init = async () => {
            const params = new URLSearchParams(window.location.search);
            const onboarded = params.get("stripe_onboarded");
            const refreshed = params.get("stripe_refresh");

            if (onboarded) {
                // Seller returned from Stripe → refresh status from Stripe
                await refreshStripeStatus();
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            if (refreshed) {
                toast({
                    title: "Onboarding incomplete",
                    description: "Please continue Stripe onboarding.",
                    variant: "destructive",
                });
            }

            await loadStripeStatus();
            setChecking(false);
        };

        init();
    }, []);

    // 🔹 Load Stripe status from DB
    const loadStripeStatus = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const supabaseAny = supabase as any;

        const { data, error } = await supabaseAny
            .from("stripe_accounts")
            .select("onboarding_status, charges_enabled, payouts_enabled")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) {
            console.error("Failed to load stripe status:", error);
            return;
        }

        if (!data) {
            setStatus("not_connected");
        } else if (data.charges_enabled && data.payouts_enabled) {
            setStatus("completed");
        } else {
            setStatus("pending");
        }
    };

    // 🟢 Start Stripe onboarding (ONLY if not completed)
    const handleConnectStripe = async () => {
        if (loading || status === "completed") return; // 🔴 HARD BLOCK

        try {
            setLoading(true);

            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            if (!token) throw new Error("Not authenticated");

            const res = await fetch(
                "https://wfjdbsusmplusovtytqf.supabase.co/functions/v1/stripe-connect-onboard",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        account_type: "seller",
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to start Stripe onboarding");
            }

            // Redirect seller to Stripe
            window.location.href = data.url;

        } catch (err: any) {
            console.error(err);
            toast({
                title: "Stripe connection failed",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // 🔴 Refresh Stripe status from backend after onboarding
    const refreshStripeStatus = async () => {
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            if (!token) return;

            await fetch(
                "https://wfjdbsusmplusovtytqf.supabase.co/functions/v1/stripe-connect-status",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            await loadStripeStatus();

            toast({
                title: "Stripe connected 🎉",
                description: "Your Stripe account is now verified and ready.",
            });

        } catch (err) {
            console.error("Failed to refresh Stripe status", err);
        }
    };

    // 🟡 While checking status
    if (checking) {
        return (
            <div className="p-6 rounded border">
                <p className="text-sm text-gray-500">Checking Stripe connection status...</p>
            </div>
        );
    }

    // 🟣 COMPLETED STATE — NO BUTTON SHOWN
    if (status === "completed") {
        return (
            <div className="p-6 rounded border bg-green-50">
                <h2 className="text-lg font-semibold text-green-700">Stripe Connected ✅</h2>
                <p className="text-sm text-gray-600 mt-2">
                    Your account is verified and ready to receive payments.
                </p>
            </div>
        );
    }

    // 🟡 PENDING STATE — allow resume onboarding
    if (status === "pending") {
        return (
            <div className="p-6 rounded border bg-yellow-50">
                <h2 className="text-lg font-semibold text-yellow-700">Stripe Setup In Progress ⏳</h2>
                <p className="text-sm text-gray-600 mt-2">
                    Please complete your Stripe onboarding to start selling tickets.
                </p>

                <button
                    onClick={handleConnectStripe}
                    disabled={loading}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                >
                    {loading ? "Opening Stripe..." : "Continue Stripe Setup"}
                </button>
            </div>
        );
    }

    // 🔵 NOT CONNECTED STATE — first time connect
    return (
        <div className="p-6 rounded border">
            <h2 className="text-lg font-semibold">Connect your Stripe Account</h2>
            <p className="text-sm text-gray-600 mt-2">
                To sell tickets and receive payouts, you must connect a Stripe account.
            </p>

            <button
                onClick={handleConnectStripe}
                disabled={loading}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
                {loading ? "Connecting..." : "Connect Stripe"}
            </button>
        </div>
    );
}
