import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin, DollarSign, Users, ArrowLeft, Loader2, Heart, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  status: string;
}

interface TicketWithSeller extends Ticket {
  seller_username: string;
}

const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketWithSeller | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWatching, setIsWatching] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchTicket = async () => {
      if (!id) {
        toast.error("No ticket ID provided");
        navigate("/browse");
        return;
      }

      try {
        // First try to fetch the ticket - allow seller to see their own pending tickets
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        // Fetch ticket without status filter first to check ownership
        const { data: ticketData, error: ticketError } = await supabase
          .from("tickets")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (ticketError) throw ticketError;

        if (!ticketData) {
          toast.error("Ticket not found");
          navigate("/browse");
          return;
        }

        // Check if ticket is viewable: either available, or owned by current user
        const isOwner = currentUser && ticketData.seller_id === currentUser.id;
        const isAvailable = ticketData.status === "available";
        
        if (!isAvailable && !isOwner) {
          toast.error("Ticket not found or no longer available");
          navigate("/browse");
          return;
        }

        // Fetch seller profile - show as anonymous for guests
        let sellerUsername = "Anonymous Seller";
        if (user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", ticketData.seller_id)
            .maybeSingle();

          if (profileData) {
            sellerUsername = profileData.username;
          }
        }

        setTicket({
          ...ticketData,
          seller_username: sellerUsername,
        });

        // Check if user is watching this ticket
        if (user) {
          const { data: watchData } = await supabase
            .from("ticket_watchers")
            .select("id")
            .eq("ticket_id", id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (watchData) {
            setIsWatching(true);
            setWatchId(watchData.id);
          }
        }
      } catch (error) {
        console.error("Error fetching ticket:", error);
        toast.error("Failed to load ticket details");
        navigate("/browse");
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [id, navigate, user]);

  const handlePurchase = () => {
    if (!ticket) return;
    console.log("TicketDetail: navigating to checkout for", id);
    navigate(`/checkout/${id}`);
  };

  const handleWatchlist = async () => {
    if (!user) {
      toast.error("Please log in to add to watchlist");
      navigate("/auth");
      return;
    }

    if (!ticket) return;

    try {
      if (isWatching && watchId) {
        // Remove from watchlist
        const { error } = await supabase
          .from("ticket_watchers")
          .delete()
          .eq("id", watchId);

        if (error) throw error;

        setIsWatching(false);
        setWatchId(null);
        toast.success("Removed from watchlist");
      } else {
        // Add to watchlist
        const { data, error } = await supabase
          .from("ticket_watchers")
          .insert({
            ticket_id: id!,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        setIsWatching(true);
        setWatchId(data.id);
        toast.success("Added to watchlist");
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
      toast.error("Failed to update watchlist");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  const buyInDollars = ticket.buy_in / 100;
  const askingPriceDollars = ticket.asking_price / 100;
  const moneyGuaranteeDollars = ticket.money_guarantee ? ticket.money_guarantee / 100 : null;
  const discount = Math.round(((buyInDollars - askingPriceDollars) / buyInDollars) * 100);
  const hasDiscount = askingPriceDollars < buyInDollars;

  const isPendingApproval = ticket.status === "pending_approval";
  const isRejected = ticket.status === "rejected";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/browse")}
          className="mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Browse
        </Button>

        <div className="max-w-4xl mx-auto">
          {/* Pending Approval Alert */}
          {isPendingApproval && (
            <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
              <AlertTitle className="text-amber-500 font-semibold">Pending Review</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                Your ticket is currently under review by our team. Once approved, it will be visible to buyers in the marketplace. This usually takes 24-48 hours.
              </AlertDescription>
            </Alert>
          )}

          {/* Rejected Alert */}
          {isRejected && (
            <Alert className="mb-6 border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <AlertTitle className="text-destructive font-semibold">Listing Rejected</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                Unfortunately, your ticket listing was not approved. Please check your email for more details or contact support.
              </AlertDescription>
            </Alert>
          )}

          <Card className="p-8 bg-card/50 backdrop-blur border-2 border-border">
            <div className="space-y-8">
              {/* Header */}
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-4">
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {ticket.tournament_name}
                  </span>
                </h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-5 h-5" />
                  <span className="text-lg">{ticket.venue}</span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-y border-border/50">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Event Date</p>
                      <p className="text-lg font-semibold">
                        {format(new Date(ticket.event_date), "MMMM d, yyyy")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Original Buy-in</p>
                      <p className="text-lg font-semibold">${buyInDollars.toLocaleString()}</p>
                    </div>
                  </div>

                  {moneyGuaranteeDollars && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Money Guarantee</p>
                        <p className="text-lg font-semibold">${moneyGuaranteeDollars.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Seller</p>
                      <p className="text-lg font-semibold">{ticket.seller_username}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-muted-foreground">Your Price</p>
                      {hasDiscount && discount > 0 && (
                        <span className="text-sm font-semibold text-green-500">{discount}% off</span>
                      )}
                    </div>
                    <p className="text-3xl font-bold text-primary">${askingPriceDollars.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-2">+ service fees</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {ticket.description && (
                <div>
                  <h3 className="text-xl font-bold mb-3">About This Ticket</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {ticket.description}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                {ticket.status === "available" ? (
                  <>
                    <Button size="lg" onClick={handlePurchase} className="flex-1">
                      Purchase Ticket - ${askingPriceDollars.toLocaleString()}
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleWatchlist}
                    >
                      <Heart className={`w-4 h-4 mr-2 ${isWatching ? 'fill-current' : ''}`} />
                      {isWatching ? 'Remove from Watchlist' : 'Add to Watchlist'}
                    </Button>
                  </>
                ) : (
                  <Button size="lg" variant="outline" onClick={() => navigate("/my-listings")} className="flex-1">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to My Listings
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default TicketDetail;
