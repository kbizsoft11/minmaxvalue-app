import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Info, CalendarIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ticketSchema } from "@/lib/validation";
import { z } from "zod";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DobSelect } from "@/components/DobSelect";
import { sendTicketSubmittedNotification } from "@/hooks/useTransactionalEmail";

interface ActiveOrganization {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
}

const ListTicket = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [organizations, setOrganizations] = useState<ActiveOrganization[]>([]);
  const [formData, setFormData] = useState({
    tournament: "",
    firstName: "",
    lastName: "",
    casinoAlias: "",
    dobDay: "",
    dobMonth: "",
    dobYear: "",
    venue: "",
    date: "",
    buyIn: "",
    price: "",
    moneyGuarantee: "",
    description: "",
  });
  const [showCustomVenue, setShowCustomVenue] = useState(false);
  const [customVenueName, setCustomVenueName] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Calculate discount validation
  const buyInValue = parseFloat(formData.buyIn) || 0;
  const priceValue = parseFloat(formData.price) || 0;
  const maxAllowedPrice = buyInValue * 0.80; // 20% minimum discount
  const hasDiscountError = buyInValue > 0 && priceValue > 0 && priceValue > maxAllowedPrice;
  const currentDiscount = buyInValue > 0 && priceValue > 0 
    ? Math.round(((buyInValue - priceValue) / buyInValue) * 100) 
    : 0;

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to list a ticket");
        navigate("/auth");
        return;
      }
      setUser(user);

      // Fetch profile to auto-fill seller info
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, date_of_birth")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFormData(prev => ({
          ...prev,
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          dobDay: profile.date_of_birth ? String(new Date(profile.date_of_birth).getDate()).padStart(2, "0") : "",
          dobMonth: profile.date_of_birth ? String(new Date(profile.date_of_birth).getMonth() + 1).padStart(2, "0") : "",
          dobYear: profile.date_of_birth ? String(new Date(profile.date_of_birth).getFullYear()) : "",
        }));
      }

      // Fetch active organizations
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, city, country")
        .eq("status", "active")
        .order("name");

      if (orgs) {
        setOrganizations(orgs);
      }

      setLoading(false);
    };
    initialize();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    // Determine venue name based on selection mode
    let venueName = formData.venue;
    let organizationId: string | null = null;
    
    if (showCustomVenue) {
      // Custom venue - validate fields
      if (!customVenueName.trim() || !customCity.trim() || !customCountry.trim()) {
        toast.error("Please fill in venue name, city, and country");
        return;
      }
      venueName = `${customVenueName.trim()}, ${customCity.trim()}, ${customCountry.trim()}`;
    } else {
      // Existing venue selected
      if (!formData.venue) {
        toast.error("Please select a venue");
        return;
      }
      // Find the organization_id for the selected venue
      const selectedOrg = organizations.find(org => {
        const orgVenue = org.city && org.country 
          ? `${org.name}, ${org.city}, ${org.country}`
          : org.name;
        return orgVenue === formData.venue;
      });
      organizationId = selectedOrg?.id || null;
    }
    
    if (!termsAccepted) {
      toast.error("Please accept the Terms & Conditions");
      return;
    }

    // Validate 20% minimum discount
    if (hasDiscountError) {
      toast.error(`Your price must be at most $${maxAllowedPrice.toLocaleString()} (20% minimum discount required)`);
      return;
    }
    
    setSubmitting(true);

    try {
      // Validate input - convert dollars to cents for storage
      const buyInCents = parseInt(formData.buyIn) * 100;
      const askingPriceCents = parseInt(formData.price) * 100;
      const moneyGuaranteeCents = formData.moneyGuarantee ? parseInt(formData.moneyGuarantee) * 100 : null;

      const validatedData = ticketSchema.parse({
        tournament_name: formData.tournament,
        venue: venueName,
        event_date: formData.date,
        buy_in: buyInCents,
        money_guarantee: moneyGuaranteeCents,
        asking_price: askingPriceCents,
        description: formData.description || null,
      });

      // If custom venue, create venue request as a lead
      if (showCustomVenue) {
        await supabase
          .from("venue_requests")
          .insert({
            user_id: user.id,
            venue_name: customVenueName.trim(),
            city: customCity.trim(),
            country: customCountry.trim(),
          });
      }

      // Create the ticket (pending approval)
      const { error } = await supabase
        .from("tickets")
        .insert({
          seller_id: user.id,
          tournament_name: validatedData.tournament_name,
          venue: validatedData.venue,
          event_date: validatedData.event_date,
          buy_in: validatedData.buy_in,
          money_guarantee: validatedData.money_guarantee,
          asking_price: validatedData.asking_price,
          description: validatedData.description,
          organization_id: organizationId,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          casino_alias: formData.casinoAlias.trim() || null,
          seller_dob: formData.dobDay && formData.dobMonth && formData.dobYear 
            ? `${formData.dobYear}-${formData.dobMonth}-${formData.dobDay}` 
            : null,
          // status defaults to 'pending_approval' in database
        });

      if (error) throw error;

      // Send confirmation email to seller
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name, username")
          .eq("id", user.id)
          .single();

        if (profile?.email) {
          await sendTicketSubmittedNotification(profile.email, {
            sellerName: profile.first_name || formData.firstName || profile.username,
            tournamentName: validatedData.tournament_name,
            venue: validatedData.venue,
            eventDate: format(new Date(validatedData.event_date), "MMMM d, yyyy"),
            askingPrice: validatedData.asking_price,
          });
        }
      } catch (emailError) {
        console.error("Failed to send ticket submitted email:", emailError);
      }

      toast.success("Ticket submitted for approval!");
      setTimeout(() => navigate("/my-listings"), 1500);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to list ticket");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleVenueChange = (value: string) => {
    if (value === "request_new") {
      setShowCustomVenue(true);
      setFormData({ ...formData, venue: "" });
    } else {
      setShowCustomVenue(false);
      setCustomVenueName("");
      setCustomCity("");
      setCustomCountry("");
      setFormData({ ...formData, venue: value });
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
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-2xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                List Your Ticket
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Sell your tournament entry to another player
            </p>
          </div>

          <Card className="p-8 bg-card/50 backdrop-blur border-2 border-border">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tournament">Tournament Name *</Label>
                <Input
                  id="tournament"
                  name="tournament"
                  placeholder="e.g., WSOP Main Event"
                  value={formData.tournament}
                  onChange={handleChange}
                  required
                  className="bg-background/50"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="casinoAlias">Casino Alias</Label>
                  <Input
                    id="casinoAlias"
                    name="casinoAlias"
                    placeholder="JDPoker99"
                    value={formData.casinoAlias}
                    onChange={handleChange}
                    className="bg-background/50"
                  />
                </div>
              </div>

              <DobSelect
                day={formData.dobDay}
                month={formData.dobMonth}
                year={formData.dobYear}
                onDayChange={(value) => setFormData(prev => ({ ...prev, dobDay: value }))}
                onMonthChange={(value) => setFormData(prev => ({ ...prev, dobMonth: value }))}
                onYearChange={(value) => setFormData(prev => ({ ...prev, dobYear: value }))}
                required
              />

              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                {!showCustomVenue ? (
                  <Select onValueChange={handleVenueChange} value={formData.venue}>
                    <SelectTrigger className="bg-background/50 border-border">
                      <SelectValue placeholder="Select a partnered casino" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border z-50 max-h-[300px]">
                      {organizations.length === 0 ? (
                        <SelectItem value="none" disabled className="text-muted-foreground">
                          No active venues available
                        </SelectItem>
                      ) : (
                        organizations.map((org) => {
                          const displayName = org.city && org.country 
                            ? `${org.name}, ${org.city}, ${org.country}`
                            : org.name;
                          return (
                            <SelectItem 
                              key={org.id} 
                              value={displayName}
                              className="cursor-pointer hover:bg-primary/10"
                            >
                              {displayName}
                            </SelectItem>
                          );
                        })
                      )}
                      <SelectItem 
                        value="request_new"
                        className="cursor-pointer hover:bg-primary/10 font-semibold text-primary"
                      >
                        Request New Venue
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Enter new venue details</p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomVenue(false);
                          setCustomVenueName("");
                          setCustomCity("");
                          setCustomCountry("");
                        }}
                        className="text-sm text-primary hover:underline"
                      >
                        Choose existing venue
                      </button>
                    </div>
                    <Input
                      id="custom-venue-name"
                      name="custom-venue-name"
                      placeholder="Venue Name (e.g., Bellagio)"
                      value={customVenueName}
                      onChange={(e) => setCustomVenueName(e.target.value)}
                      required
                      className="bg-background/50"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        id="custom-city"
                        name="custom-city"
                        placeholder="City (e.g., Las Vegas)"
                        value={customCity}
                        onChange={(e) => setCustomCity(e.target.value)}
                        required
                        className="bg-background/50"
                      />
                      <Input
                        id="custom-country"
                        name="custom-country"
                        placeholder="Country (e.g., USA)"
                        value={customCountry}
                        onChange={(e) => setCustomCountry(e.target.value)}
                        required
                        className="bg-background/50"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your venue will be reviewed by our team. Your ticket will be pending approval.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Your Price ($) *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    placeholder="9500"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    className={cn(
                      "bg-background/50",
                      hasDiscountError && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {hasDiscountError ? (
                    <p className="text-sm text-destructive font-medium">
                      Price must be ≤ ${maxAllowedPrice.toLocaleString()} (min 20% discount). 
                      Current discount: {currentDiscount}%
                    </p>
                  ) : priceValue > 0 && buyInValue > 0 ? (
                    <p className="text-sm text-green-600">
                      ✓ {currentDiscount}% discount applied
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Service fees will be calculated at checkout
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buyIn">Original Buy-in ($) *</Label>
                  <Input
                    id="buyIn"
                    name="buyIn"
                    type="number"
                    placeholder="10000"
                    value={formData.buyIn}
                    onChange={handleChange}
                    required
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Date *</Label>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-base text-left font-normal ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm",
                          !formData.date && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {formData.date ? (
                          format(new Date(formData.date), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.date ? new Date(formData.date) : undefined}
                        onSelect={(date) =>
                          setFormData({ ...formData, date: date ? format(date, "yyyy-MM-dd") : "" })
                        }
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-sm text-muted-foreground">
                    Tournament start date
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="moneyGuarantee">Money Guarantee ($)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger type="button">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Leave empty if unknown</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="moneyGuarantee"
                    name="moneyGuarantee"
                    type="number"
                    placeholder="50000"
                    value={formData.moneyGuarantee}
                    onChange={handleChange}
                    className="bg-background/50"
                  />
                  <p className="text-sm text-muted-foreground">
                    Tournament guaranteed prize pool
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Additional Details (Optional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Any additional information about the ticket..."
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="bg-background/50 resize-none"
                />
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  className="mt-1"
                />
                <label
                  htmlFor="terms"
                  className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                >
                  I have read and agree to the{" "}
                  <a href="/terms" target="_blank" className="text-primary hover:underline">
                    MinMaxValue Terms & Conditions
                  </a>
                  , acknowledge the 5% marketplace fee on successful sales, and confirm that I am listing this ticket on my own behalf with accurate and truthful information.
                </label>
              </div>

            <Button type="submit" size="lg" className="w-full" disabled={submitting || !termsAccepted}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Listing...
                </>
              ) : (
                "List Ticket"
              )}
            </Button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ListTicket;
