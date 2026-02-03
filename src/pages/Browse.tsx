import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import TicketCard from "@/components/TicketCard";
import BrowseFilters from "@/components/BrowseFilters";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { DateRange } from "react-day-picker";

// Mock data for demonstration
const mockTickets = [
  {
    id: "1",
    tournament: "WSOP Main Event",
    venue: "Rio All-Suite Hotel, Las Vegas",
    date: "July 15, 2024",
    buyIn: 10000,
    moneyGuarantee: 10000000,
    seller: "PokerPro123",
    price: 8500, // 15% discount
  },
  {
    id: "2",
    tournament: "EPT Barcelona",
    venue: "Casino Barcelona, Spain",
    date: "August 22, 2024",
    buyIn: 5300,
    moneyGuarantee: 5000000,
    seller: "CardShark42",
    price: 4240, // 20% discount
  },
  {
    id: "3",
    tournament: "WPT Championship",
    venue: "Wynn Las Vegas",
    date: "December 10, 2024",
    buyIn: 10400,
    moneyGuarantee: 15000000,
    seller: "AllInAce",
    price: 9360, // 10% discount
  },
  {
    id: "4",
    tournament: "Aussie Millions",
    venue: "Crown Melbourne, Australia",
    date: "January 20, 2025",
    buyIn: 10600,
    moneyGuarantee: 7500000,
    seller: "DownUnder88",
    price: 7420, // 30% discount
  },
  {
    id: "5",
    tournament: "partypoker MILLIONS",
    venue: "King's Casino, Czech Republic",
    date: "September 5, 2024",
    buyIn: 10300,
    moneyGuarantee: 10000000,
    seller: "CzechMate",
    price: 7725, // 25% discount
  },
  {
    id: "6",
    tournament: "Triton Poker Series",
    venue: "Jeju, South Korea",
    date: "October 12, 2024",
    buyIn: 50000,
    moneyGuarantee: 25000000,
    seller: "HighRoller99",
    price: 32500, // 35% discount
  },
];

const Browse = () => {
  const location = useLocation();
  const [tickets, setTickets] = useState<any[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(50000);
  const [filters, setFilters] = useState<{
    dateRange?: DateRange;
    location?: string;
    priceRange: [number, number];
  }>({
    priceRange: [0, 50000],
  });

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .in("status", ["available", "pending"])
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch seller usernames separately
      const sellerIds = [...new Set(data.map(t => t.seller_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", sellerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || []);

      const formattedTickets = data.map((ticket) => ({
        id: ticket.id,
        tournament: ticket.tournament_name,
        venue: ticket.venue,
        date: new Date(ticket.event_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        buyIn: ticket.buy_in / 100,
        moneyGuarantee: ticket.money_guarantee ? ticket.money_guarantee / 100 : null,
        seller: profileMap.get(ticket.seller_id) || 'Unknown',
        price: ticket.asking_price / 100,
        status: ticket.status,
        updatedAt: ticket.updated_at,
      }));
      setTickets(formattedTickets);
      setFilteredTickets(formattedTickets);
      
      // Calculate min and max prices
      if (formattedTickets.length > 0) {
        const prices = formattedTickets.map(t => t.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        setMinPrice(min);
        setMaxPrice(max);
        setFilters(prev => ({ ...prev, priceRange: [min, max] }));
      }
    }
    setLoading(false);
  };

  // Refetch on mount, when navigating to this page, and when page becomes visible
  useEffect(() => {
    fetchTickets();
  }, [location.pathname]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTickets();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    let filtered = [...tickets];

    // Filter by date range
    if (filters.dateRange?.from) {
      filtered = filtered.filter((ticket) => {
        const ticketDate = new Date(ticket.date);
        const fromDate = filters.dateRange!.from!;
        const toDate = filters.dateRange!.to;
        
        if (toDate) {
          // If both dates are selected, check if ticket date is within range
          return ticketDate >= fromDate && ticketDate <= toDate;
        } else {
          // If only start date is selected, check if ticket date matches
          return ticketDate.toDateString() === fromDate.toDateString();
        }
      });
    }

    // Filter by location
    if (filters.location) {
      filtered = filtered.filter((ticket) =>
        ticket.venue.toLowerCase().includes(filters.location!.toLowerCase())
      );
    }

    // Filter by price range
    filtered = filtered.filter(
      (ticket) =>
        ticket.price >= filters.priceRange[0] &&
        ticket.price <= filters.priceRange[1]
    );

    setFilteredTickets(filtered);
  }, [filters, tickets]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Browse Tickets
            </span>
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Find your perfect tournament entry from sellers around the world
          </p>
          <BrowseFilters 
            onFilterChange={setFilters} 
            minPrice={minPrice}
            maxPrice={maxPrice}
          />
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {tickets.length === 0
                ? "No tickets available at the moment."
                : "No tickets match your filters. Try adjusting your search."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTickets.map((ticket) => (
              <TicketCard key={ticket.id} {...ticket} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Browse;
