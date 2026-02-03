import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle, ArrowRight, Building2, ChevronDown, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addHours, differenceInMinutes } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import CountdownTimer from "@/components/CountdownTimer";
import { sendCasinoApprovalNotification, sendCasinoDeclineNotification } from "@/hooks/useTransactionalEmail";

interface Verification {
  id: string;
  purchase_id: string;
  status: string;
  created_at: string;
  notes: string | null;
  verified_at: string | null;
  ticket: {
    tournament_name: string;
    venue: string;
    event_date: string;
    buy_in: number;
  };
  seller: {
    first_name: string | null;
    last_name: string | null;
    casino_alias: string | null;
    dob: string | null;
  };
  buyer: {
    first_name: string | null;
    last_name: string | null;
    casino_alias: string | null;
    dob: string | null;
  };
}

interface AuditEntry {
  id: string;
  action: string;
  notes: string | null;
  performed_at: string;
  performed_by_username: string;
}

interface Metrics {
  avgApprovalTime: number | null;
  ticketsApproved: number;
  ticketsDeclined: number;
  netProfit: number;
  openDisputes: number;
}

const CasinoDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [organizationName, setOrganizationName] = useState<string>("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [auditHistory, setAuditHistory] = useState<Record<string, AuditEntry[]>>({});
  const [metrics, setMetrics] = useState<Metrics>({
    avgApprovalTime: null,
    ticketsApproved: 0,
    ticketsDeclined: 0,
    netProfit: 0,
    openDisputes: 0,
  });
  const [organizationId, setOrganizationId] = useState<string | null>(null);


  const checkAccessAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: isAdmin } = await supabase.rpc("current_user_is_admin");
    
    let orgId: string | null = null;
    
    if (isAdmin) {
      orgId = searchParams.get("org");
      if (orgId) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", orgId)
          .single();
        setOrganizationName(orgData?.name || "Organization");
      } else {
        setOrganizationName("All Organizations");
      }
      setOrganizationId(orgId);
      await Promise.all([fetchVerifications(), fetchMetrics(orgId)]);
      setLoading(false);
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role, organization_id")
      .eq("user_id", session.user.id)
      .eq("role", "casino_user")
      .maybeSingle();

    if (!roleData) {
      toast.error("Access denied");
      navigate("/");
      return;
    }

    orgId = roleData.organization_id;
    setOrganizationId(orgId);

    if (roleData.organization_id) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", roleData.organization_id)
        .single();
      if (orgData) setOrganizationName(orgData.name);
    }

    await Promise.all([fetchVerifications(), fetchMetrics(orgId)]);
    setLoading(false);
  };

  const fetchMetrics = async (orgId: string | null) => {
    // Fetch verifications for metrics
    let verificationsQuery = supabase
      .from("casino_verifications")
      .select("id, status, created_at, verified_at, organization_id");
    
    if (orgId) {
      verificationsQuery = verificationsQuery.eq("organization_id", orgId);
    }
    
    const { data: allVerifications } = await verificationsQuery;
    
    const approved = allVerifications?.filter(v => v.status === "approved") || [];
    const declined = allVerifications?.filter(v => v.status === "declined") || [];
    
    // Calculate avg approval time
    let avgTime: number | null = null;
    if (approved.length > 0) {
      const times = approved
        .filter(v => v.verified_at)
        .map(v => differenceInMinutes(new Date(v.verified_at!), new Date(v.created_at)));
      if (times.length > 0) {
        avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      }
    }
    
    // Fetch organization earnings (net profit)
    let earningsQuery = supabase.from("organization_earnings").select("amount");
    if (orgId) {
      earningsQuery = earningsQuery.eq("organization_id", orgId);
    }
    const { data: earnings } = await earningsQuery;
    const totalEarnings = earnings?.reduce((sum, e) => sum + e.amount, 0) || 0;
    
    // Fetch open disputes
    let disputesQuery = supabase
      .from("disputes")
      .select("id")
      .in("status", ["open", "investigating"]);
    
    if (orgId) {
      disputesQuery = disputesQuery.eq("organization_id", orgId);
    }
    const { data: disputes } = await disputesQuery;
    
    setMetrics({
      avgApprovalTime: avgTime,
      ticketsApproved: approved.length,
      ticketsDeclined: declined.length,
      netProfit: totalEarnings,
      openDisputes: disputes?.length || 0,
    });
  };

  const fetchVerifications = async () => {
    const { data, error } = await supabase
      .from("casino_verifications")
      .select("id, purchase_id, status, created_at, notes, verified_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load verifications");
      return;
    }

    const verificationsWithDetails: Verification[] = [];
    
    for (const v of data || []) {
      const { data: purchaseData } = await supabase
        .from("purchases")
        .select("ticket_id, buyer_first_name, buyer_last_name, buyer_casino_alias, buyer_dob")
        .eq("id", v.purchase_id)
        .single();

      if (!purchaseData) continue;

      const { data: ticketData } = await supabase
        .from("tickets")
        .select("tournament_name, venue, event_date, buy_in, first_name, last_name, casino_alias, seller_dob")
        .eq("id", purchaseData.ticket_id)
        .single();

      if (!ticketData) continue;

      verificationsWithDetails.push({
        ...v,
        ticket: {
          tournament_name: ticketData.tournament_name,
          venue: ticketData.venue,
          event_date: ticketData.event_date,
          buy_in: ticketData.buy_in,
        },
        seller: {
          first_name: ticketData.first_name,
          last_name: ticketData.last_name,
          casino_alias: ticketData.casino_alias,
          dob: ticketData.seller_dob,
        },
        buyer: {
          first_name: purchaseData.buyer_first_name,
          last_name: purchaseData.buyer_last_name,
          casino_alias: purchaseData.buyer_casino_alias,
          dob: purchaseData.buyer_dob,
        },
      });
    }

    setVerifications(verificationsWithDetails);
  };

  const fetchAuditHistory = async (verificationId: string) => {
    const { data, error } = await supabase
      .from("casino_verification_history")
      .select("id, action, notes, performed_at, performed_by")
      .eq("verification_id", verificationId)
      .order("performed_at", { ascending: false });

    if (error) return;

    const entriesWithUsernames: AuditEntry[] = [];
    for (const entry of data || []) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", entry.performed_by)
        .maybeSingle();

      entriesWithUsernames.push({
        id: entry.id,
        action: entry.action,
        notes: entry.notes,
        performed_at: entry.performed_at,
        performed_by_username: profileData?.username || "Unknown",
      });
    }

    setAuditHistory(prev => ({ ...prev, [verificationId]: entriesWithUsernames }));
  };

  const toggleHistory = async (verificationId: string) => {
    const isExpanded = expandedHistory[verificationId];
    setExpandedHistory(prev => ({ ...prev, [verificationId]: !isExpanded }));
    
    if (!isExpanded && !auditHistory[verificationId]) {
      await fetchAuditHistory(verificationId);
    }
  };

  const handleAction = async (verificationId: string, action: "approved" | "declined") => {
    setProcessingId(verificationId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Session expired");
      return;
    }

    const verification = verifications.find(v => v.id === verificationId);
    if (!verification) {
      toast.error("Verification not found");
      setProcessingId(null);
      return;
    }

    const { data: purchaseData } = await supabase
      .from("purchases")
      .select("id, ticket_id, ticket_price, service_fee, buyer_id, buyer_first_name")
      .eq("id", verification.purchase_id)
      .single();

    if (!purchaseData) {
      toast.error("Failed to fetch purchase details");
      setProcessingId(null);
      return;
    }

    const { data: ticketData } = await supabase
      .from("tickets")
      .select("seller_id, first_name")
      .eq("id", purchaseData.ticket_id)
      .single();

    if (!ticketData) {
      toast.error("Failed to fetch ticket details");
      setProcessingId(null);
      return;
    }

    // Calculate seller proceeds for approval email
    let sellerProceeds = 0;
    if (action === "approved") {
      const { error: paymentError } = await supabase.rpc("process_purchase_payment", {
        p_purchase_id: purchaseData.id,
        p_seller_id: ticketData.seller_id,
        p_ticket_price: purchaseData.ticket_price,
        p_service_fee: purchaseData.service_fee,
      });

      if (paymentError) {
        toast.error("Failed to process payment");
        setProcessingId(null);
        return;
      }
      // Rough estimate - the actual amount is calculated in the RPC function
      sellerProceeds = purchaseData.ticket_price;
    } else {
      // Declined - send ticket back to admin approval queue with casino note
      await supabase
        .from("tickets")
        .update({ status: "pending_approval", updated_at: new Date().toISOString() })
        .eq("id", purchaseData.ticket_id);
    }

    await supabase
      .from("casino_verifications")
      .update({
        status: action,
        verified_by: session.user.id,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", verificationId);

    await supabase
      .from("casino_verification_history")
      .insert({
        verification_id: verificationId,
        action: action,
        notes: notes[verificationId] || null,
        performed_by: session.user.id,
      });

    // Send email notifications to buyer and seller
    try {
      // Get buyer email
      const { data: buyerProfile } = await supabase
        .from("profiles")
        .select("email, first_name, username")
        .eq("id", purchaseData.buyer_id)
        .maybeSingle();

      // Get seller email  
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("email, first_name, username")
        .eq("id", ticketData.seller_id)
        .maybeSingle();

      const emailData = {
        tournamentName: verification.ticket.tournament_name,
        venue: verification.ticket.venue,
        eventDate: format(new Date(verification.ticket.event_date), "MMM d, yyyy"),
      };

      if (action === "approved") {
        // Notify buyer
        if (buyerProfile?.email) {
          await sendCasinoApprovalNotification(buyerProfile.email, {
            ...emailData,
            recipientName: buyerProfile.first_name || purchaseData.buyer_first_name || buyerProfile.username,
            isBuyer: true,
          });
        }
        // Notify seller
        if (sellerProfile?.email) {
          await sendCasinoApprovalNotification(sellerProfile.email, {
            ...emailData,
            recipientName: sellerProfile.first_name || ticketData.first_name || sellerProfile.username,
            isBuyer: false,
            amount: sellerProceeds,
          });
        }
      } else {
        // Declined - notify both parties
        if (buyerProfile?.email) {
          await sendCasinoDeclineNotification(buyerProfile.email, {
            ...emailData,
            recipientName: buyerProfile.first_name || purchaseData.buyer_first_name || buyerProfile.username,
            isBuyer: true,
            notes: notes[verificationId] || undefined,
          });
        }
        if (sellerProfile?.email) {
          await sendCasinoDeclineNotification(sellerProfile.email, {
            ...emailData,
            recipientName: sellerProfile.first_name || ticketData.first_name || sellerProfile.username,
            isBuyer: false,
            notes: notes[verificationId] || undefined,
          });
        }
      }
    } catch (emailError) {
      console.error("Failed to send casino decision emails:", emailError);
    }

    toast.success(`Transaction ${action}`);
    setNotes(prev => ({ ...prev, [verificationId]: "" }));
    await fetchVerifications();
    setProcessingId(null);
  };

  const formatName = (first: string | null, last: string | null, alias: string | null) => {
    const name = [first, last].filter(Boolean).join(" ") || "Unknown";
    return alias ? `${name} (${alias})` : name;
  };

  const formatDob = (dob: string | null) => {
    if (!dob) return null;
    return format(new Date(dob), "MMM d, yyyy");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const pending = verifications.filter(v => v.status === "pending");
  const completed = verifications.filter(v => v.status !== "pending");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{organizationName}</h1>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Avg Approval</span>
            </div>
            <p className="text-xl font-bold">
              {metrics.avgApprovalTime !== null 
                ? metrics.avgApprovalTime < 60 
                  ? `${metrics.avgApprovalTime}m`
                  : `${Math.round(metrics.avgApprovalTime / 60)}h`
                : "—"}
            </p>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs">Approved</span>
            </div>
            <p className="text-xl font-bold text-green-500">{metrics.ticketsApproved}</p>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs">Declined</span>
            </div>
            <p className="text-xl font-bold text-red-500">{metrics.ticketsDeclined}</p>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs">Net Profit</span>
            </div>
            <p className="text-xl font-bold">${(metrics.netProfit / 100).toLocaleString()}</p>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-xs">Open Disputes</span>
            </div>
            <p className={`text-xl font-bold ${metrics.openDisputes > 0 ? "text-orange-500" : ""}`}>
              {metrics.openDisputes}
            </p>
          </Card>
        </div>

        {/* Pending */}
        <section className="mb-10">
          <h2 className="text-lg font-medium text-muted-foreground mb-4">
            Pending ({pending.length})
          </h2>
          
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending verifications</p>
          ) : (
            <div className="space-y-4">
              {pending.map((v) => {
                const expiresAt = addHours(new Date(v.created_at), 24);
                return (
                <Card key={v.id} className="p-5">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-lg">{v.ticket.tournament_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(v.ticket.event_date), "MMM d, yyyy")} · ${(v.ticket.buy_in / 100).toLocaleString()} buy-in
                        </p>
                      </div>
                      <CountdownTimer expiresAt={expiresAt} />
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">FROM:</span>
                        <div>
                          <p className="text-lg font-medium text-orange-500">{formatName(v.seller.first_name, v.seller.last_name, v.seller.casino_alias)}</p>
                          {v.seller.dob && <p className="text-sm"><span className="text-muted-foreground">Date of Birth: </span><span className="text-orange-500">{formatDob(v.seller.dob)}</span></p>}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-1.5" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">TO:</span>
                        <div>
                          <p className="text-lg font-medium text-green-500">{formatName(v.buyer.first_name, v.buyer.last_name, v.buyer.casino_alias)}</p>
                          {v.buyer.dob && <p className="text-sm"><span className="text-muted-foreground">Date of Birth: </span><span className="text-green-500">{formatDob(v.buyer.dob)}</span></p>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Textarea
                        placeholder="Add notes (optional)..."
                        value={notes[v.id] || ""}
                        onChange={(e) => setNotes(prev => ({ ...prev, [v.id]: e.target.value }))}
                        className="flex-1 min-h-[60px]"
                        rows={2}
                      />
                      <div className="flex gap-2 sm:flex-col">
                        <Button
                          size="sm"
                          onClick={() => handleAction(v.id, "approved")}
                          disabled={processingId === v.id}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {processingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-1" /> Approve</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(v.id, "declined")}
                          disabled={processingId === v.id}
                          className="flex-1"
                        >
                          {processingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-1" /> Decline</>}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Completed */}
        {completed.length > 0 && (
          <section>
            <h2 className="text-lg font-medium text-muted-foreground mb-4">
              History ({completed.length})
            </h2>
            <Card className="divide-y divide-border">
              {completed.map((v) => (
                <Collapsible key={v.id}>
                  <CollapsibleTrigger 
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    onClick={() => toggleHistory(v.id)}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div>
                        <p className="text-sm font-medium">{v.ticket.tournament_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatName(v.seller.first_name, v.seller.last_name, null)} → {formatName(v.buyer.first_name, v.buyer.last_name, null)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="outline" 
                        className={v.status === "approved" ? "text-green-500 border-green-500" : "text-red-500 border-red-500"}
                      >
                        {v.status}
                      </Badge>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedHistory[v.id] ? "rotate-180" : ""}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-2 bg-muted/20">
                      <div className="text-xs text-muted-foreground mb-2">
                        {v.verified_at && `Verified on ${format(new Date(v.verified_at), "MMM d, yyyy 'at' HH:mm")}`}
                      </div>
                      {v.notes && (
                        <p className="text-sm mb-3 italic">"{v.notes}"</p>
                      )}
                      {auditHistory[v.id] ? (
                        <div className="space-y-2">
                          {auditHistory[v.id].map((entry) => (
                            <div key={entry.id} className="flex items-start gap-2 text-xs">
                              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${entry.action === "approved" ? "bg-green-500" : "bg-red-500"}`} />
                              <div>
                                <span className="font-medium">{entry.performed_by_username}</span>
                                {" "}{entry.action} · {format(new Date(entry.performed_at), "MMM d, HH:mm")}
                                {entry.notes && <p className="text-muted-foreground mt-0.5">"{entry.notes}"</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Loading...</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </Card>
          </section>
        )}
      </main>
    </div>
  );
};

export default CasinoDashboard;