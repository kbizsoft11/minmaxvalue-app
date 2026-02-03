import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, MapPin, DollarSign, CheckCircle2, Clock, AlertCircle, HelpCircle } from "lucide-react";

interface Purchase {
  id: string;
  ticket_price: number;
  service_fee: number;
  total_amount: number;
  purchased_at: string;
  tournament_name: string;
  venue: string;
  event_date: string;
  ticket_status: string;
  verification_status: string | null;
}

type DeliveryStatus = "delivered" | "pending" | "need_help";

const getDeliveryStatus = (purchase: Purchase): DeliveryStatus => {
  if (purchase.verification_status === "approved" || purchase.ticket_status === "sold") {
    return "delivered";
  }
  if (purchase.verification_status === "declined") {
    return "need_help";
  }
  return "pending";
};

const getStatusBadge = (purchase: Purchase) => {
  const status = getDeliveryStatus(purchase);
  
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

const TicketHistory = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    await fetchPurchases(user.id);
  };

  const fetchPurchases = async (userId: string) => {
    const { data } = await supabase
      .from("purchases")
      .select(`
        id,
        ticket_price,
        service_fee,
        total_amount,
        purchased_at,
        tickets!inner(
          tournament_name,
          venue,
          event_date,
          status
        ),
        casino_verifications(status)
      `)
      .eq("buyer_id", userId)
      .order("purchased_at", { ascending: false });

    if (data) {
      setPurchases(
        data.map((p: any) => ({
          id: p.id,
          ticket_price: p.ticket_price,
          service_fee: p.service_fee,
          total_amount: p.total_amount,
          purchased_at: p.purchased_at,
          tournament_name: p.tickets.tournament_name,
          venue: p.tickets.venue,
          event_date: p.tickets.event_date,
          ticket_status: p.tickets.status,
          verification_status: p.casino_verifications?.[0]?.status || null,
        }))
      );
    }
    setLoading(false);
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
            Ticket History
          </span>
        </h1>

        {purchases.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">You haven't purchased any tickets yet.</p>
            <a href="/browse" className="text-primary hover:underline">
              Browse available tickets
            </a>
          </Card>
        ) : (
          <div className="space-y-4">
            {purchases.map((purchase) => (
              <Card key={purchase.id} className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-3">{purchase.tournament_name}</h3>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {purchase.venue}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(purchase.event_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">
                          ${(purchase.total_amount / 100).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (ticket: ${(purchase.ticket_price / 100).toLocaleString()} + 
                          fee: ${(purchase.service_fee / 100).toLocaleString()})
                        </span>
                      </div>

                      <Link 
                        to={`/order/${purchase.id}?help=true`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
                      >
                        <HelpCircle className="h-3 w-3" />
                        Need help?
                      </Link>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-start md:items-end justify-between gap-3">
                    {getStatusBadge(purchase)}
                    
                    <div className="flex flex-col items-start md:items-end gap-2">
                      <p className="text-xs text-muted-foreground">
                        {new Date(purchase.purchased_at).toLocaleDateString()}
                      </p>
                      <Button 
                        size="sm" 
                        onClick={() => navigate(`/order/${purchase.id}`)}
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

export default TicketHistory;
