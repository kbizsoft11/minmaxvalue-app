import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet, TrendingUp, DollarSign, Calendar, MapPin, CheckCircle2, Clock, AlertCircle, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SoldTicket {
  id: string;
  purchase_id: string;
  ticket_price: number;
  tournament_name: string;
  venue: string;
  event_date: string;
  sold_at: string;
  ticket_status: string;
  verification_status: string | null;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
}

type DeliveryStatus = "delivered" | "pending" | "need_help";

const getDeliveryStatus = (ticket: SoldTicket): DeliveryStatus => {
  if (ticket.verification_status === "approved" || ticket.ticket_status === "sold") {
    return "delivered";
  }
  if (ticket.verification_status === "declined") {
    return "need_help";
  }
  return "pending";
};

const getStatusBadge = (ticket: SoldTicket) => {
  const status = getDeliveryStatus(ticket);
  
  switch (status) {
    case "delivered":
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Ticket delivered
        </Badge>
      );
    case "need_help":
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Need Help
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
          <Clock className="h-3 w-3 mr-1" />
          Pending delivery
        </Badge>
      );
  }
};

const SellerDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [soldTickets, setSoldTickets] = useState<SoldTicket[]>([]);

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    await Promise.all([
      fetchWallet(user.id),
      fetchSoldTickets(user.id),
      fetchTotalEarnings(user.id),
    ]);
    setLoading(false);
  };

  const fetchWallet = async (userId: string) => {
    const { data } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    setWalletBalance(data?.balance || 0);
  };

  const fetchTotalEarnings = async (userId: string) => {
    const { data } = await supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("type", "sale");

    const total = data?.reduce((sum, t) => sum + t.amount, 0) || 0;
    setTotalEarnings(total);
  };

  const fetchSoldTickets = async (userId: string) => {
    const { data } = await supabase
      .from("tickets")
      .select(`
        id,
        tournament_name,
        venue,
        event_date,
        asking_price,
        status,
        purchases(
          id,
          purchased_at,
          buyer_first_name,
          buyer_last_name,
          casino_verifications(status)
        )
      `)
      .eq("seller_id", userId)
      .in("status", ["pending", "sold"])
      .order("updated_at", { ascending: false });

    if (data) {
      const tickets: SoldTicket[] = data
        .filter((t: any) => t.purchases && t.purchases.length > 0)
        .map((t: any) => {
          const purchase = t.purchases[0];
          return {
            id: t.id,
            purchase_id: purchase.id,
            ticket_price: t.asking_price,
            tournament_name: t.tournament_name,
            venue: t.venue,
            event_date: t.event_date,
            sold_at: purchase.purchased_at,
            ticket_status: t.status,
            verification_status: purchase.casino_verifications?.[0]?.status || null,
            buyer_first_name: purchase.buyer_first_name,
            buyer_last_name: purchase.buyer_last_name,
          };
        });
      setSoldTickets(tickets);
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-8">
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Seller Dashboard
          </span>
        </h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">${(walletBalance / 100).toLocaleString()}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Earnings</p>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold">${(totalEarnings / 100).toLocaleString()}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Tickets Sold</p>
              <DollarSign className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold">{soldTickets.length}</p>
          </Card>
        </div>

        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Request Payout</h2>
          <p className="text-muted-foreground mb-4">
            Withdraw your earnings to your bank account or PayPal.
          </p>
          <Button
            onClick={() => {
              toast({
                title: "Coming Soon",
                description: "Payout request feature is under development.",
              });
            }}
            disabled={walletBalance === 0}
          >
            Request Payout
          </Button>
        </Card>

        {/* Sold Tickets History */}
        <h2 className="text-2xl font-bold mb-4">Sold Tickets</h2>
        
        {soldTickets.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">You haven't sold any tickets yet.</p>
            <Link to="/list-ticket" className="text-primary hover:underline">
              List a ticket for sale
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {soldTickets.map((ticket) => (
              <Card key={ticket.id} className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-3">{ticket.tournament_name}</h3>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {ticket.venue}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(ticket.event_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">
                          ${(ticket.ticket_price / 100).toLocaleString()}
                        </span>
                        {ticket.buyer_first_name && (
                          <span className="text-xs text-muted-foreground">
                            • Sold to {ticket.buyer_first_name} {ticket.buyer_last_name?.[0]}.
                          </span>
                        )}
                      </div>

                      <Link 
                        to={`/order/${ticket.purchase_id}?help=true`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
                      >
                        <HelpCircle className="h-3 w-3" />
                        Need help?
                      </Link>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-start md:items-end justify-between gap-3">
                    {getStatusBadge(ticket)}
                    
                    <div className="flex flex-col items-start md:items-end gap-2">
                      <p className="text-xs text-muted-foreground">
                        Sold {new Date(ticket.sold_at).toLocaleDateString()}
                      </p>
                      <Button 
                        size="sm" 
                        onClick={() => navigate(`/order/${ticket.purchase_id}`)}
                      >
                        View order
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SellerDashboard;
