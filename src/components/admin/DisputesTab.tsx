import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Eye, RefreshCcw, DollarSign, ArrowLeftRight, CheckCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ShortId from "./ShortId";

type DisputeStatus = "open" | "investigating" | "resolved" | "closed";
type DisputeReason = "invalid_ticket" | "transfer_not_completed" | "event_cancelled" | "fraud_chargeback" | "other";
type DisputeResolution = "buyer" | "seller" | "partial";

interface Dispute {
  id: string;
  ticket_id: string;
  purchase_id: string | null;
  buyer_id: string;
  seller_id: string;
  raised_by: string;
  raised_by_role: string;
  organization_id: string | null;
  reason_code: DisputeReason;
  reason_details: string | null;
  status: DisputeStatus;
  amount_at_risk: number;
  resolution: DisputeResolution | null;
  resolution_notes: string | null;
  resolved_by: string | null;
  support_ticket_id: string | null;
  opened_at: string;
  resolved_at: string | null;
  // Joined data
  buyer_username: string;
  seller_username: string;
  tournament_name: string;
  organization_name: string | null;
  raised_by_username: string;
}

interface DisputeHistory {
  id: string;
  action: string;
  notes: string | null;
  old_status: DisputeStatus | null;
  new_status: DisputeStatus | null;
  created_at: string;
  performed_by_username: string;
}

interface DisputeStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
  totalAtRisk: number;
}

const REASON_LABELS: Record<DisputeReason, string> = {
  invalid_ticket: "Invalid Ticket",
  transfer_not_completed: "Transfer Not Completed",
  event_cancelled: "Event Cancelled",
  fraud_chargeback: "Fraud / Chargeback",
  other: "Other",
};

const STATUS_COLORS: Record<DisputeStatus, string> = {
  open: "bg-red-500/10 text-red-500 border-red-500/30",
  investigating: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  resolved: "bg-green-500/10 text-green-500 border-green-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const DisputesTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [stats, setStats] = useState<DisputeStats>({
    total: 0,
    open: 0,
    investigating: 0,
    resolved: 0,
    closed: 0,
    totalAtRisk: 0,
  });
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [history, setHistory] = useState<DisputeHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Action state
  const [newStatus, setNewStatus] = useState<DisputeStatus | "">("");
  const [resolution, setResolution] = useState<DisputeResolution | "">("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [supportTicketId, setSupportTicketId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "all">("all");

  useEffect(() => {
    fetchDisputes();
  }, [statusFilter]);

  const fetchDisputes = async () => {
    setLoading(true);

    let query = supabase
      .from("disputes")
      .select(`
        id,
        ticket_id,
        purchase_id,
        buyer_id,
        seller_id,
        raised_by,
        raised_by_role,
        organization_id,
        reason_code,
        reason_details,
        status,
        amount_at_risk,
        resolution,
        resolution_notes,
        resolved_by,
        support_ticket_id,
        opened_at,
        resolved_at
      `)
      .order("opened_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching disputes:", error);
      toast({
        title: "Error",
        description: "Failed to load disputes",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setDisputes([]);
      setStats({ total: 0, open: 0, investigating: 0, resolved: 0, closed: 0, totalAtRisk: 0 });
      setLoading(false);
      return;
    }

    // Get all unique IDs for joining
    const ticketIds = [...new Set(data.map((d: any) => d.ticket_id))];
    const userIds = [...new Set(data.flatMap((d: any) => [d.buyer_id, d.seller_id, d.raised_by]))];
    const orgIds = [...new Set(data.map((d: any) => d.organization_id).filter(Boolean))];

    const [ticketsRes, profilesRes, orgsRes] = await Promise.all([
      supabase.from("tickets").select("id, tournament_name").in("id", ticketIds),
      supabase.from("profiles").select("id, username").in("id", userIds),
      orgIds.length > 0
        ? supabase.from("organizations").select("id, name").in("id", orgIds as string[])
        : Promise.resolve({ data: [] }),
    ]);

    const ticketMap = new Map((ticketsRes.data || []).map((t: any) => [t.id, t.tournament_name]));
    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.username]));
    const orgMap = new Map((orgsRes.data || []).map((o: any) => [o.id, o.name]));

    const enrichedDisputes: Dispute[] = data.map((d: any) => ({
      ...d,
      buyer_username: profileMap.get(d.buyer_id) || "Unknown",
      seller_username: profileMap.get(d.seller_id) || "Unknown",
      raised_by_username: profileMap.get(d.raised_by) || "Unknown",
      tournament_name: ticketMap.get(d.ticket_id) || "Unknown",
      organization_name: d.organization_id ? orgMap.get(d.organization_id) || null : null,
    }));

    setDisputes(enrichedDisputes);

    // Compute stats from all disputes (unfiltered)
    const { data: allDisputes } = await supabase.from("disputes").select("status, amount_at_risk");
    if (allDisputes) {
      setStats({
        total: allDisputes.length,
        open: allDisputes.filter((d: any) => d.status === "open").length,
        investigating: allDisputes.filter((d: any) => d.status === "investigating").length,
        resolved: allDisputes.filter((d: any) => d.status === "resolved").length,
        closed: allDisputes.filter((d: any) => d.status === "closed").length,
        totalAtRisk: allDisputes
          .filter((d: any) => d.status === "open" || d.status === "investigating")
          .reduce((sum: number, d: any) => sum + (d.amount_at_risk || 0), 0),
      });
    }

    setLoading(false);
  };

  const openDetailDialog = async (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setNewStatus(dispute.status);
    setResolution(dispute.resolution || "");
    setResolutionNotes(dispute.resolution_notes || "");
    setSupportTicketId(dispute.support_ticket_id || "");
    setDetailDialogOpen(true);
    await fetchHistory(dispute.id);
  };

  const fetchHistory = async (disputeId: string) => {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from("dispute_history")
      .select("id, action, notes, old_status, new_status, created_at, performed_by")
      .eq("dispute_id", disputeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching dispute history:", error);
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    const performerIds = [...new Set(data.map((h: any) => h.performed_by))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", performerIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.username]));

    setHistory(
      data.map((h: any) => ({
        ...h,
        performed_by_username: profileMap.get(h.performed_by) || "Unknown",
      }))
    );
    setHistoryLoading(false);
  };

  const handleUpdateDispute = async () => {
    if (!selectedDispute) return;

    setActionLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
      setActionLoading(false);
      return;
    }

    const updates: any = {
      support_ticket_id: supportTicketId || null,
    };

    const statusChanged = newStatus && newStatus !== selectedDispute.status;
    if (statusChanged) {
      updates.status = newStatus;
      if (newStatus === "resolved" || newStatus === "closed") {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = user.id;
        if (resolution) {
          updates.resolution = resolution;
        }
        updates.resolution_notes = resolutionNotes || null;
      }
    }

    const { error: updateError } = await supabase
      .from("disputes")
      .update(updates)
      .eq("id", selectedDispute.id);

    if (updateError) {
      console.error("Error updating dispute:", updateError);
      toast({ title: "Error", description: "Failed to update dispute", variant: "destructive" });
      setActionLoading(false);
      return;
    }

    // Log history
    if (statusChanged) {
      await supabase.from("dispute_history").insert({
        dispute_id: selectedDispute.id,
        performed_by: user.id,
        action: `Status changed to ${newStatus}`,
        notes: resolutionNotes || null,
        old_status: selectedDispute.status,
        new_status: newStatus,
      });
    }

    toast({ title: "Dispute updated" });
    setDetailDialogOpen(false);
    fetchDisputes();
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Disputes</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className={`p-4 ${stats.open > 0 ? "border-red-500/50 bg-red-500/5" : ""}`}>
          <p className="text-xs text-muted-foreground">Open</p>
          <p className={`text-2xl font-bold ${stats.open > 0 ? "text-red-500" : ""}`}>{stats.open}</p>
        </Card>
        <Card className={`p-4 ${stats.investigating > 0 ? "border-yellow-500/50 bg-yellow-500/5" : ""}`}>
          <p className="text-xs text-muted-foreground">Investigating</p>
          <p className={`text-2xl font-bold ${stats.investigating > 0 ? "text-yellow-500" : ""}`}>{stats.investigating}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Resolved</p>
          <p className="text-2xl font-bold text-green-500">{stats.resolved}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Closed</p>
          <p className="text-2xl font-bold">{stats.closed}</p>
        </Card>
        <Card className={`p-4 ${stats.totalAtRisk > 0 ? "border-orange-500/50 bg-orange-500/5" : ""}`}>
          <p className="text-xs text-muted-foreground">At Risk</p>
          <p className={`text-2xl font-bold ${stats.totalAtRisk > 0 ? "text-orange-500" : ""}`}>
            ${(stats.totalAtRisk / 100).toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Filter & Table */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Disputes
          </h2>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchDisputes}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {disputes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No disputes found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>At Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell><ShortId id={dispute.id} prefix="DSP-" /></TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {dispute.tournament_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{REASON_LABELS[dispute.reason_code]}</Badge>
                    </TableCell>
                    <TableCell>{dispute.buyer_username}</TableCell>
                    <TableCell>{dispute.seller_username}</TableCell>
                    <TableCell className="text-orange-500 font-medium">
                      ${(dispute.amount_at_risk / 100).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[dispute.status]}>
                        {dispute.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(dispute.opened_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDetailDialog(dispute)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dispute Details</DialogTitle>
            <DialogDescription>
              Review and manage this dispute.
            </DialogDescription>
          </DialogHeader>

          {selectedDispute && (
            <div className="space-y-6 pt-4">
              {/* Dispute Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Tournament</p>
                  <p className="font-medium">{selectedDispute.tournament_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reason</p>
                  <Badge variant="outline">{REASON_LABELS[selectedDispute.reason_code]}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Buyer</p>
                  <p>{selectedDispute.buyer_username}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Seller</p>
                  <p>{selectedDispute.seller_username}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount at Risk</p>
                  <p className="font-bold text-orange-500">
                    ${(selectedDispute.amount_at_risk / 100).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Raised By</p>
                  <p>
                    {selectedDispute.raised_by_username}{" "}
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {selectedDispute.raised_by_role}
                    </Badge>
                  </p>
                </div>
                {selectedDispute.organization_name && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Organization</p>
                    <p>{selectedDispute.organization_name}</p>
                  </div>
                )}
                {selectedDispute.reason_details && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Details</p>
                    <p className="text-sm">{selectedDispute.reason_details}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as DisputeStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="investigating">Investigating</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(newStatus === "resolved" || newStatus === "closed") && (
                    <div>
                      <Label>Resolution</Label>
                      <Select value={resolution} onValueChange={(v) => setResolution(v as DisputeResolution)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select resolution" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="buyer">
                            <span className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" /> Buyer Wins
                            </span>
                          </SelectItem>
                          <SelectItem value="seller">
                            <span className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-blue-500" /> Seller Wins
                            </span>
                          </SelectItem>
                          <SelectItem value="partial">
                            <span className="flex items-center gap-2">
                              <ArrowLeftRight className="h-4 w-4 text-yellow-500" /> Partial
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Support Ticket ID (optional)</Label>
                  <Input
                    value={supportTicketId}
                    onChange={(e) => setSupportTicketId(e.target.value)}
                    placeholder="e.g., TICKET-1234"
                  />
                </div>

                <div>
                  <Label>Resolution Notes</Label>
                  <Textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Add notes about the resolution..."
                    rows={3}
                  />
                </div>

                <Button onClick={handleUpdateDispute} disabled={actionLoading} className="w-full">
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Update Dispute
                </Button>
              </div>

              {/* History */}
              <Collapsible>
                <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                  View History ({history.length})
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  {historyLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No history yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {history.map((h) => (
                        <div key={h.id} className="text-xs border-l-2 border-border pl-3 py-1">
                          <p className="font-medium">{h.action}</p>
                          {h.notes && <p className="text-muted-foreground">{h.notes}</p>}
                          <p className="text-muted-foreground">
                            by {h.performed_by_username} • {new Date(h.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DisputesTab;
