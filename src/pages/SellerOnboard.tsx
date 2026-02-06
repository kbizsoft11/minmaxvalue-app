import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";

const SellerOnboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    onboarding_status: string | null;
    charges_enabled: boolean;
    payouts_enabled: boolean;
  } | null>(null);

  // Check current Stripe status
  const checkStatus = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-status", {
        body: { account_type: "seller" },
      });

      if (error) throw error;
      console.log(data);
      setStatus(data);
    } catch (error: any) {
      console.error("Error checking status:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to check status",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  // Start Stripe onboarding
  const startOnboarding = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { account_type: "seller" },
      });

      if (error) throw error;

      if (data.already_complete) {
        toast({
          title: "Already Onboarded",
          description: "Your Stripe account is already set up!",
        });
        checkStatus();
        return;
      }

      if (data.url) {
        // Redirect to Stripe onboarding
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Error starting onboarding:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start onboarding",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check status on mount
  useState(() => {
    checkStatus();
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-16 max-w-2xl">
        <h1 className="text-4xl font-bold mb-8">
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Seller Dashboard
          </span>
        </h1>

        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Stripe Connect Setup</h2>
          <p className="text-muted-foreground mb-6">
            Connect your Stripe account to receive payments when you sell tickets.
          </p>

          {/* Status Display */}
          {status && (
            <div className="mb-6 p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-3">Account Status</h3>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {status.connected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span>Connected: {status.connected ? "Yes" : "No"}</span>
                </div>

                <div className="flex items-center gap-2">
                  {status.charges_enabled ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  <span>Can Accept Payments: {status.charges_enabled ? "Yes" : "No"}</span>
                </div>

                <div className="flex items-center gap-2">
                  {status.payouts_enabled ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  <span>Can Receive Payouts: {status.payouts_enabled ? "Yes" : "No"}</span>
                </div>

                <div className="text-sm text-muted-foreground mt-2">
                  Status: <span className="font-medium">{status.onboarding_status || "Not started"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={startOnboarding}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : status?.connected ? (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Update Stripe Account
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect Stripe Account
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={checkStatus}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh Status"
              )}
            </Button>
          </div>

          {/* Test Mode Notice */}
          <div className="mt-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              <strong>🧪 Test Mode:</strong> Use Stripe test data for onboarding. 
              No real bank account needed.
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default SellerOnboard;