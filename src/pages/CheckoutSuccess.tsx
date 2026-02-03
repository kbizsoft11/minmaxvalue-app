import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // 🔒 Block direct access
    if (!sessionId) {
      navigate("/browse", { replace: true });
    }
  }, [sessionId, navigate]);

  // Prevent UI flicker before redirect
  if (!sessionId) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            Payment Successful
          </h1>

          <p className="text-muted-foreground max-w-xl">
            Your payment has been received successfully. The ticket is now
            pending venue verification. You’ll be notified as soon as the
            verification process is complete.
          </p>

          <div className="w-full max-w-xl rounded-lg border bg-card p-6 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Status
              </span>
              <span className="text-sm font-semibold text-yellow-600">
                Pending Verification
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Next Step
              </span>
              <span className="text-sm font-medium">
                Partner approval & admin confirmation
              </span>
            </div>
          </div>

          <Button onClick={() => navigate("/browse")}>
            Browse More Tickets
          </Button>

          <p className="text-xs text-muted-foreground pt-6">
            If you have any questions, feel free to contact our support team.
          </p>
        </div>
      </main>
    </div>
  );
}
