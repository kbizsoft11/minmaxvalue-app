import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import TicketCard from "@/components/TicketCard";
import { Loader2, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Ticket {
  id: string;
  tournament_name: string;
  venue: string;
  event_date: string;
  buy_in: number;
  asking_price: number;
  money_guarantee: number | null;
  description: string | null;
  status: string;
}

interface TicketWithSeller extends Ticket {
  seller_username: string;
}

const Watchlist = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to view your watchlist");
        navigate("/auth");
        return;
      }
      setUser(user);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const fetchWatchlist = async () => {
      if (!user) return;

      try {
        const { data: watcherData, error: watcherError } = await supabase
          .from("ticket_watchers")
          .select("ticket_id")
          .eq("user_id", user.id);

        if (watcherError) throw watcherError;

        if (!watcherData || watcherData.length === 0) {
          setTickets([]);
          setLoading(false);
          return;
        }

        const ticketIds = watcherData.map((w) => w.ticket_id);

        const { data: ticketsData, error: ticketsError } = await supabase
          .from("tickets")
          .select("*")
          .in("id", ticketIds)
          .eq("status", "available");

        if (ticketsError) throw ticketsError;

        if (!ticketsData) {
          setTickets([]);
          setLoading(false);
          return;
        }

        // Fetch seller usernames for each ticket
        const ticketsWithSellers = await Promise.all(
          ticketsData.map(async (ticket) => {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", ticket.seller_id)
              .single();

            return {
              ...ticket,
              seller_username: profileData?.username || "Unknown",
            };
          })
        );

        setTickets(ticketsWithSellers);
      } catch (error) {
        console.error("Error fetching watchlist:", error);
        toast.error("Failed to load watchlist");
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, [user]);

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-primary fill-current" />
            <h1 className="text-3xl md:text-4xl font-bold">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                My Watchlist
              </span>
            </h1>
          </div>
          <p className="text-muted-foreground">
            {tickets.length === 0
              ? "You haven't added any tickets to your watchlist yet"
              : `${tickets.length} ticket${tickets.length === 1 ? "" : "s"} in your watchlist`}
          </p>
        </div>

        {tickets.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">No watched tickets yet</h2>
            <p className="text-muted-foreground mb-8">
              Start browsing and add tickets to your watchlist
            </p>
            <button
              onClick={() => navigate("/browse")}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            >
              Browse Tickets
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tickets.map((ticket) => (
              <TicketCard 
                key={ticket.id}
                id={ticket.id}
                tournament={ticket.tournament_name}
                venue={ticket.venue}
                date={new Date(ticket.event_date).toLocaleDateString()}
                buyIn={ticket.buy_in / 100}
                moneyGuarantee={ticket.money_guarantee ? ticket.money_guarantee / 100 : undefined}
                seller={ticket.seller_username}
                price={ticket.asking_price / 100}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Watchlist;
