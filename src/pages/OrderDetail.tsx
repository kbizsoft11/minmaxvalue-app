import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Calendar, MapPin, ArrowLeft, HelpCircle, CheckCircle2, Clock, AlertCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OrderData {
  id: string;
  ticket_id: string;
  ticket_price: number;
  service_fee: number;
  total_amount: number;
  purchased_at: string;
  buyer_id: string;
  seller_id: string;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  tournament_name: string;
  venue: string;
  event_date: string;
  ticket_status: string;
  verification_status: string | null;
  organization_id: string | null;
}

type DeliveryStatus = "delivered" | "pending" | "need_help";

const REASON_OPTIONS = [
  { value: "transfer_not_completed", label: "Ticket not delivered / Transfer not completed" },
  { value: "invalid_ticket", label: "Invalid ticket information" },
  { value: "event_cancelled", label: "Event was cancelled" },
  { value: "fraud_chargeback", label: "Suspected fraud" },
  { value: "other", label: "Other issue" },
] as const;

const OrderDetail = () => {
  const navigate = useNavigate();
  const { purchaseId } = useParams();
  const [searchParams] = useSearchParams();
  const helpSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reasonCode, setReasonCode] = useState<string>("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [existingDispute, setExistingDispute] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetch();
  }, [purchaseId]);

  useEffect(() => {
    if (searchParams.get("help") === "true" && helpSectionRef.current) {
      setTimeout(() => {
        helpSectionRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [searchParams, order]);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    await fetchOrder(user.id);
  };

  const fetchOrder = async (userId: string) => {
    // Fetch as buyer first
    let { data } = await supabase
      .from("purchases")
      .select(`
        id,
        ticket_id,
        ticket_price,
        service_fee,
        total_amount,
        purchased_at,
        buyer_id,
        buyer_first_name,
        buyer_last_name,
        tickets!inner(
          tournament_name,
          venue,
          event_date,
          status,
          seller_id,
          organization_id
        ),
        casino_verifications(status)
      `)
      .eq("id", purchaseId)
      .maybeSingle();

    // Check if user is buyer or seller
    if (data) {
      const isBuyer = data.buyer_id === userId;
      const isSeller = (data.tickets as any).seller_id === userId;
      
      if (!isBuyer && !isSeller) {
        setLoading(false);
        return;
      }

      const verificationStatus = data.casino_verifications?.[0]?.status || null;
      setOrder({
        id: data.id,
        ticket_id: data.ticket_id,
        ticket_price: data.ticket_price,
        service_fee: data.service_fee,
        total_amount: data.total_amount,
        purchased_at: data.purchased_at || "",
        buyer_id: data.buyer_id,
        seller_id: (data.tickets as any).seller_id,
        buyer_first_name: data.buyer_first_name,
        buyer_last_name: data.buyer_last_name,
        tournament_name: (data.tickets as any).tournament_name,
        venue: (data.tickets as any).venue,
        event_date: (data.tickets as any).event_date,
        ticket_status: (data.tickets as any).status,
        verification_status: verificationStatus,
        organization_id: (data.tickets as any).organization_id,
      });

      // Check for existing dispute
      const { data: dispute } = await supabase
        .from("disputes")
        .select("id")
        .eq("purchase_id", purchaseId)
        .in("status", ["open", "investigating"])
        .maybeSingle();

      if (dispute) {
        setExistingDispute(dispute.id);
      }
    }
    setLoading(false);
  };

  const handleSubmitDispute = async () => {
    if (!order || !reasonCode) return;

    setSubmitting(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { error } = await supabase.from("disputes").insert({
      ticket_id: order.ticket_id,
      purchase_id: order.id,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      raised_by: user.id,
      raised_by_role: user.id === order.buyer_id ? "buyer" : "seller",
      organization_id: order.organization_id,
      reason_code: reasonCode as any,
      reason_details: reasonDetails.trim() || null,
      amount_at_risk: order.total_amount,
      status: "open",
    });

    setSubmitting(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to submit support request. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Support request submitted",
      description: "We've received your request and will get back to you soon.",
    });

    setDialogOpen(false);
    setReasonCode("");
    setReasonDetails("");
    
    // Refresh to show existing dispute
    await fetchOrder(user.id);
  };

  const getDeliveryStatus = (): DeliveryStatus => {
    if (!order) return "pending";
    
    if (order.verification_status === "approved" || order.ticket_status === "sold") {
      return "delivered";
    }
    if (order.verification_status === "declined") {
      return "need_help";
    }
    return "pending";
  };

  const getStatusBadge = () => {
    const status = getDeliveryStatus();
    
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
            Ticket pending delivery
          </Badge>
        );
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

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-16 max-w-4xl">
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Order not found.</p>
            <Button variant="outline" onClick={() => navigate("/ticket-history")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Ticket History
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/ticket-history")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Ticket History
        </Button>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Order Details
          </span>
        </h1>
        <p className="text-muted-foreground mb-8">Order #{order.id.slice(0, 8).toUpperCase()}</p>

        {/* Order Status Card */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold mb-1">{order.tournament_name}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {order.venue}
              </div>
            </div>
            {getStatusBadge()}
          </div>

          <Separator className="mb-6" />

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">Event Details</h3>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {new Date(order.event_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">Payment Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ticket price</span>
                  <span>${(order.ticket_price / 100).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service fee</span>
                  <span>${(order.service_fee / 100).toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total paid</span>
                  <span className="text-primary">${(order.total_amount / 100).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="text-sm text-muted-foreground">
            <p>Purchased on {new Date(order.purchased_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
        </Card>

        {/* Help Section */}
        <Card className="p-6" ref={helpSectionRef} id="help-section">
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Need Help?</h2>
          </div>
          
          <p className="text-muted-foreground mb-4">
            If you're experiencing issues with your ticket or have questions about your order, we're here to help.
          </p>

          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-1">Ticket not delivered?</h4>
              <p className="text-sm text-muted-foreground">
                Ticket transfers typically complete within 24 hours after casino verification. If you haven't received your ticket after this time, please contact support.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-1">Wrong information?</h4>
              <p className="text-sm text-muted-foreground">
                If there's an issue with your ticket details or buyer information, reach out to us immediately.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-1">Request a refund</h4>
              <p className="text-sm text-muted-foreground">
                Refund requests are handled on a case-by-case basis. Please provide your order details when contacting support.
              </p>
            </div>
          </div>

          {existingDispute ? (
            <div className="mt-6 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <p className="text-sm text-orange-500 font-medium">
                You have an open support request for this order. Our team is reviewing it.
              </p>
            </div>
          ) : (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="mt-6 w-full md:w-auto">
                  Contact Support
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Contact Support</DialogTitle>
                  <DialogDescription>
                    Describe your issue and we'll get back to you as soon as possible.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">What's the issue?</Label>
                    <Select value={reasonCode} onValueChange={setReasonCode}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an issue type" />
                      </SelectTrigger>
                      <SelectContent>
                        {REASON_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="details">Additional details (optional)</Label>
                    <Textarea
                      id="details"
                      placeholder="Please provide any additional information that might help us resolve your issue..."
                      value={reasonDetails}
                      onChange={(e) => setReasonDetails(e.target.value)}
                      rows={4}
                      maxLength={1000}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {reasonDetails.length}/1000
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmitDispute} 
                    disabled={!reasonCode || submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit Request
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </Card>
      </main>
    </div>
  );
};

export default OrderDetail;
