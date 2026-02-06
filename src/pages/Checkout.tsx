import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Calendar as CalendarIcon, DollarSign, Trophy, Loader2, User, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DobSelect } from "@/components/DobSelect";

// Match backend fee percentage
const MARKETPLACE_FEE_PERCENTAGE = 8;

interface Ticket {
  id: string;
  tournament_name: string;
  venue: string;
  event_date: string;
  buy_in: number;
  asking_price: number;
  money_guarantee: number | null;
  description: string | null;
  seller_id: string;
}

interface TicketWithSeller extends Ticket {
  seller_username: string | null;
  seller_stripe_account_id: string | null;
  seller_charges_enabled: boolean | null;
  seller_payouts_enabled: boolean | null;
}

interface BuyerInfo {
  firstName: string;
  lastName: string;
  casinoAlias: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
}

const Checkout = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<TicketWithSeller | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    firstName: "",
    lastName: "",
    casinoAlias: "",
    dobDay: "",
    dobMonth: "",
    dobYear: "",
  });

  // Check for canceled checkout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("canceled") === "true") {
      toast({
        title: "Checkout Canceled",
        description: "Your purchase was not completed. The ticket is still available.",
      });
      // Clean URL
      window.history.replaceState({}, "", `/checkout/${ticketId}`);
    }
  }, [ticketId, toast]);

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);

      // Fetch profile to auto-fill buyer info
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, date_of_birth")
        .eq("id", user.id)
        .single();

      if (profile) {
        setBuyerInfo(prev => ({
          ...prev,
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          dobDay: profile.date_of_birth ? String(new Date(profile.date_of_birth).getDate()).padStart(2, "0") : "",
          dobMonth: profile.date_of_birth ? String(new Date(profile.date_of_birth).getMonth() + 1).padStart(2, "0") : "",
          dobYear: profile.date_of_birth ? String(new Date(profile.date_of_birth).getFullYear()) : "",
        }));
      }
    };
    checkAuth();
  }, [navigate]);

  // Fetch ticket
  useEffect(() => {
    const fetchTicket = async () => {
      if (!ticketId) {
        toast({
          title: "Invalid ticket",
          description: "No ticket ID provided in the URL.",
          variant: "destructive",
        });
        navigate("/browse");
        return;
      }

      try {
        // Fetch ticket
        const { data: ticketData, error: ticketError } = await supabase
          .from("tickets")
          .select("*")
          .eq("id", ticketId)
          .eq("status", "available")
          .maybeSingle();

        if (ticketError) throw ticketError;

        if (!ticketData) {
          toast({
            title: "Error",
            description: "Ticket not found or no longer available",
            variant: "destructive",
          });
          navigate("/browse");
          return;
        }

        // Fetch seller profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", ticketData.seller_id)
          .maybeSingle();

        // Fetch seller's Stripe account
        const { data: stripeData, error: stripeError } = await supabase
          .from("stripe_accounts")
          .select("stripe_account_id, charges_enabled, payouts_enabled")
          .eq("user_id", ticketData.seller_id)
          .eq("account_type", "seller")
          .maybeSingle();

        console.log("=== DEBUG CHECKOUT ===");
        console.log("Ticket ID:", ticketId);
        console.log("Ticket Seller ID:", ticketData.seller_id);
        console.log("Stripe Data:", stripeData);
        console.log("Stripe Error:", stripeError);
        console.log("======================");

        // ✅ CHECK SELLER STRIPE STATUS HERE
        if (!stripeData?.stripe_account_id) {
          toast({
            title: "Seller Not Ready",
            description: "This seller hasn't connected their payment account yet.",
            variant: "destructive",
          });
          navigate(-1);
          return;
        }

        if (!stripeData.charges_enabled || !stripeData.payouts_enabled) {
          toast({
            title: "Seller Not Ready",
            description: "This seller hasn't completed their payment setup. Please try another ticket.",
            variant: "destructive",
          });
          navigate(-1);
          return;
        }

        // ✅ Only set ticket if seller is ready
        setTicket({
          ...ticketData,
          seller_username: profileData?.username ?? null,
          seller_stripe_account_id: stripeData.stripe_account_id,
          seller_charges_enabled: stripeData.charges_enabled,
          seller_payouts_enabled: stripeData.payouts_enabled,
        });

      } catch (error: any) {
        console.error("Error loading ticket:", error);
        toast({
          title: "Error",
          description: "Failed to load ticket. Please try again.",
          variant: "destructive",
        });
        navigate("/browse");
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [ticketId, navigate, toast]);


  // // Validate seller can receive payments
  // useEffect(() => {
  //   // Only check if ticket is loaded AND we have Stripe data
  //   if (
  //     ticket &&
  //     ticket.seller_stripe_account_id !== null && // Stripe account exists
  //     (!ticket.seller_charges_enabled || !ticket.seller_payouts_enabled)
  //   ) {
  //     toast({
  //       title: "Seller Not Ready",
  //       description: "This seller hasn't completed their payment setup. Please try another ticket.",
  //       variant: "destructive",
  //     });
  //     navigate("/browse");
  //   }
  // }, [ticket, navigate, toast]);

  const handlePurchase = async () => {
    if (!user || !ticket) return;

    // Validate buyer info
    if (
      !buyerInfo.firstName.trim() ||
      !buyerInfo.lastName.trim() ||
      !buyerInfo.dobDay ||
      !buyerInfo.dobMonth ||
      !buyerInfo.dobYear
    ) {
      toast({
        title: "Missing Information",
        description: "Please enter your first name, last name, and date of birth.",
        variant: "destructive",
      });
      return;
    }

    // Prevent seller buying own ticket
    if (user.id === ticket.seller_id) {
      toast({
        title: "Cannot Purchase",
        description: "You cannot purchase your own ticket.",
        variant: "destructive",
      });
      return;
    }

    // Validate seller can receive payments
    if (!ticket.seller_charges_enabled || !ticket.seller_payouts_enabled) {
      toast({
        title: "Seller Not Ready",
        description: "This seller hasn't completed payment setup.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      // Use Supabase functions.invoke
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          ticket_id: ticket.id,
          buyer_info: {
            first_name: buyerInfo.firstName.trim(),
            last_name: buyerInfo.lastName.trim(),
            dob: `${buyerInfo.dobYear}-${buyerInfo.dobMonth}-${buyerInfo.dobDay}`,
            casino_alias: buyerInfo.casinoAlias.trim() || null,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.url) {
        throw new Error("No checkout URL received");
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;

    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  // Money values are stored in cents in the DB
  const askingPriceDollars = ticket.asking_price / 100;
  const buyInDollars = ticket.buy_in / 100;
  const moneyGuaranteeDollars = ticket.money_guarantee ? ticket.money_guarantee / 100 : null;

  // Calculate fee from cents
  const serviceFeeCents = Math.round(ticket.asking_price * (MARKETPLACE_FEE_PERCENTAGE / 100));
  const totalAmountCents = ticket.asking_price + serviceFeeCents;

  const serviceFee = serviceFeeCents / 100;
  const totalAmount = totalAmountCents / 100;

  const savingsAmount = buyInDollars - askingPriceDollars;
  const discountPercentage = Math.round((savingsAmount / buyInDollars) * 100);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-8">
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Checkout
          </span>
        </h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Ticket Details */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">{ticket.tournament_name}</h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{ticket.venue}</span>
              </div>

              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {new Date(ticket.event_date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Buy-in: ${buyInDollars.toLocaleString()}
                </span>
              </div>

              {moneyGuaranteeDollars && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-accent/20 to-primary/20 border-2 border-accent/30">
                  <Trophy className="h-6 w-6 text-accent shrink-0" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Guaranteed Prize Pool</span>
                    <span className="text-lg font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                      ${moneyGuaranteeDollars.toLocaleString()} GTD
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sold by: <span className="font-medium text-foreground">{ticket.seller_username || "Unknown"}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  toast({
                    title: "Contact Support",
                    description: "Support feature coming soon!",
                  });
                }}
              >
                Contact Support
              </Button>
            </div>
          </Card>

          {/* Buyer Info & Price Breakdown */}
          <div className="space-y-6">
            {/* Buyer Information Form */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Your Information</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                This information is required for the casino to transfer the ticket to you.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      placeholder="Enter your first name"
                      value={buyerInfo.firstName}
                      onChange={(e) => setBuyerInfo(prev => ({ ...prev, firstName: e.target.value }))}
                      disabled={processing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      placeholder="Enter your last name"
                      value={buyerInfo.lastName}
                      onChange={(e) => setBuyerInfo(prev => ({ ...prev, lastName: e.target.value }))}
                      disabled={processing}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="casinoAlias">Casino Alias (optional)</Label>
                  <Input
                    id="casinoAlias"
                    placeholder="Your casino player name, if any"
                    value={buyerInfo.casinoAlias}
                    onChange={(e) => setBuyerInfo(prev => ({ ...prev, casinoAlias: e.target.value }))}
                    disabled={processing}
                  />
                </div>
                <DobSelect
                  day={buyerInfo.dobDay}
                  month={buyerInfo.dobMonth}
                  year={buyerInfo.dobYear}
                  onDayChange={(value) => setBuyerInfo(prev => ({ ...prev, dobDay: value }))}
                  onMonthChange={(value) => setBuyerInfo(prev => ({ ...prev, dobMonth: value }))}
                  onYearChange={(value) => setBuyerInfo(prev => ({ ...prev, dobYear: value }))}
                  disabled={processing}
                  required
                />
              </div>
            </Card>

            {/* Price Breakdown */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Price Summary</h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ticket Price</span>
                  <span className="font-semibold">${askingPriceDollars.toLocaleString()}</span>
                </div>

                {discountPercentage > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Original Buy-in</span>
                    <span className="line-through text-muted-foreground">
                      ${buyInDollars.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground flex items-center gap-1 cursor-help">
                          Service Fee ({MARKETPLACE_FEE_PERCENTAGE}%)
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-sm">
                        <p>This fee helps us keep the platform running — covering secure hosting, customer support, payment processing, and ongoing development.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-semibold">${serviceFee.toLocaleString()}</span>
                </div>

                <Separator />

                <div className="flex justify-between items-center text-lg">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-primary">
                    ${totalAmount.toLocaleString()}
                  </span>
                </div>

                {discountPercentage > 0 && (
                  <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-2 rounded-md text-sm text-center font-semibold">
                    This ticket is listed at {discountPercentage}% off the original buy-in!
                  </div>
                )}
              </div>

              <Button
                className="w-full mt-6"
                size="lg"
                onClick={handlePurchase}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Complete Purchase - $${totalAmount.toLocaleString()}`
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                By completing this purchase, you agree to our{" "}
                <a href="/terms" target="_blank" className="text-primary hover:underline">
                  Terms & Conditions
                </a>
                .
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Checkout;