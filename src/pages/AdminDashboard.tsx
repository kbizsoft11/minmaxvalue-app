import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign, TrendingUp, Users, Wallet, Ticket, ShoppingCart, Activity, Shield, Mail, Download, CheckCircle, XCircle, Clock, Building2, UserPlus, Send, Trash2, Pencil, Sparkles, AlertTriangle, Gift, Search } from "lucide-react";
import OverviewPlusTab from "@/components/admin/OverviewPlusTab";
import DisputesTab from "@/components/admin/DisputesTab";
import GiveawayTab from "@/components/admin/GiveawayTab";
import ShortId from "@/components/admin/ShortId";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  sendTicketApprovalNotification,
  sendTicketRejectionNotification,
  sendPayoutCompletedNotification,
  sendPayoutFailedNotification
} from "@/hooks/useTransactionalEmail";

interface PlatformStats {
  weeklyRevenue: number;
  prevWeekRevenue: number;
  weeklyPlatformEarnings: number;
  prevWeekPlatformEarnings: number;
  weeklyCasinoEarnings: number;
  prevWeekCasinoEarnings: number;
  weeklyNewUsers: number;
  prevWeekNewUsers: number;
  weeklyNewTickets: number;
  prevWeekNewTickets: number;
  totalTickets: number;
  pendingVerificationTickets: number;
  pendingApprovalTickets: number;
  availableTickets: number;
  pendingDisputes: number;
  pendingVenueRequests: number;
  pendingPayouts: number;
}

// Helper to calculate WoW percentage change
const calcWoWPercent = (current: number, previous: number): number | null => {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

// Helper to check if search query matches an ID or string field
const matchesSearch = (query: string, ...fields: (string | null | undefined)[]): boolean => {
  if (!query.trim()) return true;
  const lowerQuery = query.toLowerCase().trim();
  return fields.some(field => field?.toLowerCase().includes(lowerQuery));
};

interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  username: string;
}

interface Transaction {
  id: string;
  user_id: string | null;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  username: string | null;
}

interface Payout {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  method: string;
  requested_at: string;
  processed_at: string | null;
  completed_at: string | null;
  username: string;
}

interface UserData {
  id: string;
  email: string;
  username: string;
  created_at: string;
  ticket_count: number;
  sales_count: number;
}

interface TicketData {
  id: string;
  tournament_name: string;
  venue: string;
  asking_price: number;
  status: string;
  created_at: string;
  seller_username: string;
  total_views: number;
}

interface TicketReviewData extends TicketData {
  event_date: string;
  buy_in: number;
  money_guarantee: number | null;
  description: string | null;
  first_name: string | null;
  last_name: string | null;
  casino_alias: string | null;
}

interface PurchaseData {
  id: string;
  buyer_username: string;
  seller_username: string;
  tournament_name: string;
  ticket_price: number;
  service_fee: number;
  purchased_at: string;
}

interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  type: string;
  status: 'waitlisted' | 'active' | 'suspended';
  created_at: string;
  city: string | null;
  country: string | null;
  fee_percentage: number;
}

interface OrganizationStats {
  organization_id: string;
  organization_name: string;
  fee_percentage: number;
  total_tickets: number;
  available_tickets: number;
  sold_tickets: number;
  declined_tickets: number;
  revenue: number;
  venue_profit: number;
  platform_profit: number;
}

interface CasinoInvitation {
  id: string;
  email: string;
  organization_id: string;
  organization_name: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface VerificationStats {
  total: number;
  pending: number;
  approved: number;
  declined: number;
  byOrganization: { org_name: string; org_id: string; pending: number; approved: number; declined: number }[];
}

interface CasinoUser {
  id: string;
  user_id: string;
  username: string;
  email: string;
  organization_name: string;
}

interface VenueRequest {
  id: string;
  user_id: string;
  venue_name: string;
  city: string;
  country: string;
  status: string;
  created_at: string;
  username: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<PlatformStats>({
    weeklyRevenue: 0,
    prevWeekRevenue: 0,
    weeklyPlatformEarnings: 0,
    prevWeekPlatformEarnings: 0,
    weeklyCasinoEarnings: 0,
    prevWeekCasinoEarnings: 0,
    weeklyNewUsers: 0,
    prevWeekNewUsers: 0,
    weeklyNewTickets: 0,
    prevWeekNewTickets: 0,
    totalTickets: 0,
    pendingVerificationTickets: 0,
    pendingApprovalTickets: 0,
    availableTickets: 0,
    pendingDisputes: 0,
    pendingVenueRequests: 0,
    pendingPayouts: 0,
  });
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [purchases, setPurchases] = useState<PurchaseData[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [casinoInvitations, setCasinoInvitations] = useState<CasinoInvitation[]>([]);
  const [casinoUsers, setCasinoUsers] = useState<CasinoUser[]>([]);
  const [venueRequests, setVenueRequests] = useState<VenueRequest[]>([]);
  const [organizationStats, setOrganizationStats] = useState<OrganizationStats[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketReviewData | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Casino management state
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgCity, setNewOrgCity] = useState("");
  const [newOrgCountry, setNewOrgCountry] = useState("");
  const [newOrgFeePercentage, setNewOrgFeePercentage] = useState("10");
  const [createOrgLoading, setCreateOrgLoading] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgCity, setEditOrgCity] = useState("");
  const [editOrgCountry, setEditOrgCountry] = useState("");
  const [editOrgFeePercentage, setEditOrgFeePercentage] = useState("");
  const [editOrgLoading, setEditOrgLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOrgId, setInviteOrgId] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [verificationStats, setVerificationStats] = useState<VerificationStats>({
    total: 0,
    pending: 0,
    approved: 0,
    declined: 0,
    byOrganization: [],
  });

  // Ticket editing state
  const [editingTicket, setEditingTicket] = useState<TicketReviewData | null>(null);
  const [editTicketForm, setEditTicketForm] = useState({
    tournament_name: "",
    venue: "",
    event_date: "",
    buy_in: "",
    asking_price: "",
    money_guarantee: "",
    description: "",
    first_name: "",
    last_name: "",
    casino_alias: "",
  });
  const [editTicketLoading, setEditTicketLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");


  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: isAdmin, error } = await supabase.rpc("current_user_is_admin");

    if (error || !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setIsAdmin(true);
    fetchAllData();
  };

  const fetchStats = async () => {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const oneWeekAgoISO = oneWeekAgo.toISOString();
    const twoWeeksAgoISO = twoWeeksAgo.toISOString();

    // First, get approved verifications (needed for filtering other queries)
    const { data: approvedVerifications } = await supabase
      .from("casino_verifications")
      .select("purchase_id, verified_at")
      .eq("status", "approved");

    const approvedPurchaseIds = new Set(approvedVerifications?.map(v => v.purchase_id) || []);

    // Run all independent queries in parallel
    const [
      weeklyPurchasesResult,
      prevWeekPurchasesResult,
      weeklyPlatformEarningsResult,
      prevWeekPlatformEarningsResult,
      weeklyCasinoEarningsResult,
      prevWeekCasinoEarningsResult,
      weeklyUsersResult,
      prevWeekUsersResult,
      weeklyTicketsResult,
      prevWeekTicketsResult,
      allTicketsResult,
      pendingVerificationsResult,
      pendingDisputesResult,
      pendingVenueReqsResult,
      pendingPayoutsResult,
    ] = await Promise.all([
      supabase.from("purchases").select("id, total_amount").gte("purchased_at", oneWeekAgoISO),
      supabase.from("purchases").select("id, total_amount").gte("purchased_at", twoWeeksAgoISO).lt("purchased_at", oneWeekAgoISO),
      supabase.from("platform_earnings").select("amount, reference_id, created_at").gte("created_at", oneWeekAgoISO),
      supabase.from("platform_earnings").select("amount, reference_id, created_at").gte("created_at", twoWeeksAgoISO).lt("created_at", oneWeekAgoISO),
      supabase.from("organization_earnings").select("amount, reference_id").gte("created_at", oneWeekAgoISO),
      supabase.from("organization_earnings").select("amount, reference_id").gte("created_at", twoWeeksAgoISO).lt("created_at", oneWeekAgoISO),
      supabase.from("profiles").select("id").gte("created_at", oneWeekAgoISO),
      supabase.from("profiles").select("id").gte("created_at", twoWeeksAgoISO).lt("created_at", oneWeekAgoISO),
      supabase.from("tickets").select("id").gte("created_at", oneWeekAgoISO),
      supabase.from("tickets").select("id").gte("created_at", twoWeeksAgoISO).lt("created_at", oneWeekAgoISO),
      supabase.from("tickets").select("status"),
      supabase.from("casino_verifications").select("id").eq("status", "pending"),
      supabase.from("disputes").select("id").in("status", ["open", "investigating"]),
      supabase.from("venue_requests").select("id").eq("status", "pending"),
      supabase.from("payouts").select("amount").eq("status", "pending"),
    ]);

    // Process results
    const weeklyRevenue = weeklyPurchasesResult.data?.filter(p => approvedPurchaseIds.has(p.id)).reduce((sum, p) => sum + p.total_amount, 0) || 0;
    const prevWeekRevenue = prevWeekPurchasesResult.data?.filter(p => approvedPurchaseIds.has(p.id)).reduce((sum, p) => sum + p.total_amount, 0) || 0;
    const weeklyPlatformEarnings = weeklyPlatformEarningsResult.data?.filter(e => e.reference_id && approvedPurchaseIds.has(e.reference_id)).reduce((sum, e) => sum + e.amount, 0) || 0;
    const prevWeekPlatformEarnings = prevWeekPlatformEarningsResult.data?.filter(e => e.reference_id && approvedPurchaseIds.has(e.reference_id)).reduce((sum, e) => sum + e.amount, 0) || 0;
    const weeklyCasinoEarnings = weeklyCasinoEarningsResult.data?.filter(e => e.reference_id && approvedPurchaseIds.has(e.reference_id)).reduce((sum, e) => sum + e.amount, 0) || 0;
    const prevWeekCasinoEarnings = prevWeekCasinoEarningsResult.data?.filter(e => e.reference_id && approvedPurchaseIds.has(e.reference_id)).reduce((sum, e) => sum + e.amount, 0) || 0;
    const weeklyNewUsers = weeklyUsersResult.data?.length || 0;
    const prevWeekNewUsers = prevWeekUsersResult.data?.length || 0;
    const weeklyNewTickets = weeklyTicketsResult.data?.length || 0;
    const prevWeekNewTickets = prevWeekTicketsResult.data?.length || 0;
    const tickets = allTicketsResult.data;
    const totalTickets = tickets?.length || 0;
    const pendingApprovalTickets = tickets?.filter(t => t.status === "pending_approval").length || 0;
    const availableTickets = tickets?.filter(t => t.status === "available").length || 0;
    const pendingVerificationTickets = pendingVerificationsResult.data?.length || 0;
    const pendingDisputes = pendingDisputesResult.data?.length || 0;
    const pendingVenueRequests = pendingVenueReqsResult.data?.length || 0;
    const pendingPayouts = pendingPayoutsResult.data?.reduce((sum, p) => sum + p.amount, 0) || 0;

    setStats({
      weeklyRevenue,
      prevWeekRevenue,
      weeklyPlatformEarnings,
      prevWeekPlatformEarnings,
      weeklyCasinoEarnings,
      prevWeekCasinoEarnings,
      weeklyNewUsers,
      prevWeekNewUsers,
      weeklyNewTickets,
      prevWeekNewTickets,
      totalTickets,
      pendingVerificationTickets,
      pendingApprovalTickets,
      availableTickets,
      pendingDisputes,
      pendingVenueRequests,
      pendingPayouts,
    });
  };

  const fetchWallets = async () => {
    const { data } = await supabase
      .from("wallets")
      .select(`
        id,
        user_id,
        balance,
        profiles!inner(username)
      `)
      .order("balance", { ascending: false })
      .limit(20);

    if (data) {
      setWallets(
        data.map((w: any) => ({
          id: w.id,
          user_id: w.user_id,
          balance: w.balance,
          username: w.profiles.username,
        }))
      );
    }
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select(`
        id,
        user_id,
        type,
        amount,
        balance_after,
        description,
        created_at,
        profiles(username)
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setTransactions(
        data.map((t: any) => ({
          id: t.id,
          user_id: t.user_id,
          type: t.type,
          amount: t.amount,
          balance_after: t.balance_after,
          description: t.description,
          created_at: t.created_at,
          username: t.profiles?.username || null,
        }))
      );
    }
  };

  const fetchPayouts = async () => {
    const { data } = await supabase
      .from("payouts")
      .select(`
        id,
        user_id,
        amount,
        status,
        method,
        requested_at,
        processed_at,
        completed_at,
        profiles!inner(username)
      `)
      .order("requested_at", { ascending: false })
      .limit(50);

    if (data) {
      setPayouts(
        data.map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          amount: p.amount,
          status: p.status,
          method: p.method,
          requested_at: p.requested_at,
          processed_at: p.processed_at,
          completed_at: p.completed_at,
          username: p.profiles.username,
        }))
      );
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        username,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (data) {
      const usersWithStats = await Promise.all(
        data.map(async (user: any) => {
          const { data: tickets } = await supabase
            .from("tickets")
            .select("id")
            .eq("seller_id", user.id);

          const { data: sales } = await supabase
            .from("tickets")
            .select("id")
            .eq("seller_id", user.id)
            .eq("status", "sold");

          return {
            id: user.id,
            email: user.email,
            username: user.username,
            created_at: user.created_at,
            ticket_count: tickets?.length || 0,
            sales_count: sales?.length || 0,
          };
        })
      );
      setUsers(usersWithStats);
    }
  };

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from("tickets")
      .select(
        `id,
         seller_id,
         tournament_name,
         venue,
         asking_price,
         status,
         created_at,
         total_views`
      )
      .order("created_at", { ascending: false })
      .limit(100);

    console.log("AdminDashboard: fetched tickets", {
      error,
      count: data?.length ?? 0,
    });

    if (error) {
      console.error("Error fetching tickets for admin dashboard", error);
      toast({
        title: "Error loading tickets",
        description: "Failed to load tickets for the admin dashboard.",
        variant: "destructive",
      });
      return;
    }

    if (data && data.length > 0) {
      const sellerIds = Array.from(new Set(data.map((t: any) => t.seller_id)));

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", sellerIds);

      if (profilesError) {
        console.error("Error fetching seller profiles for tickets", profilesError);
      }

      const profileMap = new Map<string, string>();
      (profilesData || []).forEach((p: any) => {
        profileMap.set(p.id, p.username);
      });

      setTickets(
        data.map((t: any) => ({
          id: t.id,
          tournament_name: t.tournament_name,
          venue: t.venue,
          asking_price: t.asking_price,
          status: t.status,
          created_at: t.created_at,
          seller_username: profileMap.get(t.seller_id) || "Unknown",
          total_views: t.total_views,
        }))
      );
    } else {
      setTickets([]);
    }
  };

  const fetchPurchases = async () => {
    const { data } = await supabase
      .from("purchases")
      .select(`
        id,
        buyer_id,
        ticket_price,
        service_fee,
        purchased_at,
        tickets!inner(
          tournament_name,
          seller_id
        )
      `)
      .order("purchased_at", { ascending: false })
      .limit(100);

    if (data) {
      const purchasesWithNames = await Promise.all(
        data.map(async (p: any) => {
          const { data: buyerProfile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", p.buyer_id)
            .single();

          const { data: sellerProfile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", p.tickets.seller_id)
            .single();

          return {
            id: p.id,
            buyer_username: buyerProfile?.username || "Unknown",
            seller_username: sellerProfile?.username || "Unknown",
            tournament_name: p.tickets.tournament_name,
            ticket_price: p.ticket_price,
            service_fee: p.service_fee,
            purchased_at: p.purchased_at,
          };
        })
      );
      setPurchases(purchasesWithNames);
    }
  };

  const fetchWaitlist = async () => {
    const { data } = await supabase
      .from("waitlist")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setWaitlist(data);
    }
  };

  const fetchOrganizations = async () => {
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setOrganizations(data as Organization[]);
    }
  };

  const fetchCasinoInvitations = async () => {
    const { data } = await supabase
      .from("casino_invitations")
      .select(`
        id,
        email,
        organization_id,
        status,
        created_at,
        expires_at,
        organizations(name)
      `)
      .order("created_at", { ascending: false });

    if (data) {
      setCasinoInvitations(
        data.map((inv: any) => ({
          id: inv.id,
          email: inv.email,
          organization_id: inv.organization_id,
          organization_name: inv.organizations?.name || "Unknown",
          status: inv.status,
          created_at: inv.created_at,
          expires_at: inv.expires_at,
        }))
      );
    }
  };

  const fetchCasinoUsers = async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("id, user_id, organization_id")
      .eq("role", "casino_user");

    if (error) {
      console.error("Error fetching casino users", error);
      toast({
        title: "Error loading casino users",
        description: "Failed to load casino users list.",
        variant: "destructive",
      });
      return;
    }

    if (!data || data.length === 0) {
      setCasinoUsers([]);
      return;
    }

    const userIds = Array.from(new Set(data.map((ur: any) => ur.user_id)));
    const orgIds = Array.from(new Set(data.map((ur: any) => ur.organization_id).filter(Boolean)));

    const [{ data: profiles }, { data: orgs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, email")
        .in("id", userIds),
      supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds as string[]),
    ]);

    const profileMap = new Map<string, { username: string; email: string }>();
    (profiles || []).forEach((p: any) => {
      profileMap.set(p.id, { username: p.username, email: p.email });
    });

    const orgMap = new Map<string, string>();
    (orgs || []).forEach((o: any) => {
      orgMap.set(o.id, o.name);
    });

    setCasinoUsers(
      data.map((ur: any) => {
        const profile = profileMap.get(ur.user_id) || { username: "Unknown", email: "Unknown" };
        const orgName = ur.organization_id ? orgMap.get(ur.organization_id) || "Unknown" : "Unknown";
        return {
          id: ur.id,
          user_id: ur.user_id,
          username: profile.username,
          email: profile.email,
          organization_name: orgName,
        };
      })
    );
  };

  const fetchVerificationStats = async () => {
    const { data: verifications } = await supabase
      .from("casino_verifications")
      .select("id, status, organization_id, organizations(name)");

    if (verifications) {
      const pending = verifications.filter((v: any) => v.status === "pending").length;
      const approved = verifications.filter((v: any) => v.status === "approved").length;
      const declined = verifications.filter((v: any) => v.status === "declined").length;

      // Group by organization
      const orgMap = new Map<string, { org_name: string; org_id: string; pending: number; approved: number; declined: number }>();

      for (const v of verifications as any[]) {
        const orgId = v.organization_id;
        const orgName = v.organizations?.name || "Unknown";

        if (!orgMap.has(orgId)) {
          orgMap.set(orgId, { org_name: orgName, org_id: orgId, pending: 0, approved: 0, declined: 0 });
        }

        const entry = orgMap.get(orgId)!;
        if (v.status === "pending") entry.pending++;
        else if (v.status === "approved") entry.approved++;
        else if (v.status === "declined") entry.declined++;
      }

      setVerificationStats({
        total: verifications.length,
        pending,
        approved,
        declined,
        byOrganization: Array.from(orgMap.values()),
      });
    }
  };

  const fetchVenueRequests = async () => {
    const { data, error } = await supabase
      .from("venue_requests")
      .select("id, user_id, venue_name, city, country, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching venue requests", error);
      return;
    }

    if (!data || data.length === 0) {
      setVenueRequests([]);
      return;
    }

    const userIds = Array.from(new Set(data.map((vr: any) => vr.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);

    const profileMap = new Map<string, string>();
    (profiles || []).forEach((p: any) => {
      profileMap.set(p.id, p.username);
    });

    setVenueRequests(
      data.map((vr: any) => ({
        id: vr.id,
        user_id: vr.user_id,
        venue_name: vr.venue_name,
        city: vr.city,
        country: vr.country,
        status: vr.status,
        created_at: vr.created_at,
        username: profileMap.get(vr.user_id) || "Unknown",
      }))
    );
  };

  const fetchOrganizationStats = async () => {
    // Fetch organizations with their fee percentage
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id, name, fee_percentage");

    if (orgsError || !orgs) {
      console.error("Error fetching organizations:", orgsError);
      setOrganizationStats([]);
      return;
    }

    // Fetch tickets by organization
    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("organization_id, status");

    // Fetch venue earnings
    const { data: venueEarnings, error: venueError } = await supabase
      .from("organization_earnings")
      .select("organization_id, amount");

    // Fetch platform earnings (purchases for tickets at each org)
    const { data: purchases, error: purchasesError } = await supabase
      .from("purchases")
      .select("service_fee, ticket_price, tickets!inner(organization_id, seller_id)");

    // Build stats map
    const statsMap = new Map<string, OrganizationStats>();

    orgs.forEach((org: any) => {
      statsMap.set(org.id, {
        organization_id: org.id,
        organization_name: org.name,
        fee_percentage: org.fee_percentage || 10,
        total_tickets: 0,
        available_tickets: 0,
        sold_tickets: 0,
        declined_tickets: 0,
        revenue: 0,
        venue_profit: 0,
        platform_profit: 0,
      });
    });

    // Count tickets by status
    (tickets || []).forEach((t: any) => {
      if (!t.organization_id) return;
      const stats = statsMap.get(t.organization_id);
      if (!stats) return;
      stats.total_tickets++;
      if (t.status === "available") stats.available_tickets++;
      if (t.status === "sold") stats.sold_tickets++;
      if (t.status === "rejected") stats.declined_tickets++;
    });

    // Aggregate venue profit from organization_earnings
    (venueEarnings || []).forEach((e: any) => {
      const stats = statsMap.get(e.organization_id);
      if (stats) stats.venue_profit += e.amount;
    });

    // Aggregate revenue and platform profit from purchases
    (purchases || []).forEach((p: any) => {
      const orgId = p.tickets?.organization_id;
      if (!orgId) return;
      const stats = statsMap.get(orgId);
      if (!stats) return;

      // Revenue = ticket_price + service_fee (total buyer payment)
      stats.revenue += p.ticket_price + p.service_fee;
      // Platform profit = service_fee
      stats.platform_profit += p.service_fee;
    });

    setOrganizationStats(Array.from(statsMap.values()));
  };

  const handleApproveVenueRequest = async (request: VenueRequest) => {
    // Create organization from venue request
    const { error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: request.venue_name,
        city: request.city,
        country: request.country,
        type: "casino",
        status: "active",
      });

    if (orgError) {
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive",
      });
      return;
    }

    // Update venue request status
    const { error: updateError } = await supabase
      .from("venue_requests")
      .update({ status: "approved" })
      .eq("id", request.id);

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to update venue request",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: `${request.venue_name} added as a new casino organization`,
    });

    fetchVenueRequests();
    fetchOrganizations();
    fetchStats();
  };

  const handleRejectVenueRequest = async (requestId: string) => {
    const { error } = await supabase
      .from("venue_requests")
      .update({ status: "rejected" })
      .eq("id", requestId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reject venue request",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Venue request rejected",
    });

    fetchVenueRequests();
    fetchStats();
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }

    setCreateOrgLoading(true);
    const feePercentage = parseInt(newOrgFeePercentage) || 10;
    const { error } = await supabase
      .from("organizations")
      .insert({
        name: newOrgName.trim(),
        type: "casino",
        city: newOrgCity.trim() || null,
        country: newOrgCountry.trim() || null,
        fee_percentage: Math.max(0, Math.min(100, feePercentage)),
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Casino organization created",
      });
      setNewOrgName("");
      setNewOrgCity("");
      setNewOrgCountry("");
      setNewOrgFeePercentage("10");
      fetchOrganizations();
    }
    setCreateOrgLoading(false);
  };

  const handleUpdateOrgStatus = async (orgId: string, newStatus: 'waitlisted' | 'active' | 'suspended') => {
    const { error } = await supabase
      .from("organizations")
      .update({ status: newStatus })
      .eq("id", orgId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update organization status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Organization status updated to ${newStatus}`,
      });
      fetchOrganizations();
    }
  };

  const openEditOrgDialog = (org: Organization) => {
    setEditingOrg(org);
    setEditOrgName(org.name);
    setEditOrgCity(org.city || "");
    setEditOrgCountry(org.country || "");
    setEditOrgFeePercentage(org.fee_percentage.toString());
  };

  const handleUpdateOrganization = async () => {
    if (!editingOrg || !editOrgName.trim()) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }

    setEditOrgLoading(true);
    const feePercentage = parseInt(editOrgFeePercentage) || 10;
    const { error } = await supabase
      .from("organizations")
      .update({
        name: editOrgName.trim(),
        city: editOrgCity.trim() || null,
        country: editOrgCountry.trim() || null,
        fee_percentage: Math.max(0, Math.min(100, feePercentage)),
      })
      .eq("id", editingOrg.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update organization",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Organization updated",
      });
      setEditingOrg(null);
      fetchOrganizations();
    }
    setEditOrgLoading(false);
  };

  const handleInviteCasinoUser = async () => {
    if (!inviteEmail.trim() || !inviteOrgId) {
      toast({
        title: "Error",
        description: "Email and organization are required",
        variant: "destructive",
      });
      return;
    }

    setInviteLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast({
        title: "Error",
        description: "Not authenticated",
        variant: "destructive",
      });
      setInviteLoading(false);
      return;
    }

    // Get organization name for the email
    const selectedOrg = organizations.find(org => org.id === inviteOrgId);
    const organizationName = selectedOrg?.name || "Unknown Organization";

    const { data: insertedData, error } = await supabase
      .from("casino_invitations")
      .insert({
        email: inviteEmail.trim().toLowerCase(),
        organization_id: inviteOrgId,
        invited_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create invitation",
        variant: "destructive",
      });
      setInviteLoading(false);
      return;
    }

    // Send invitation email via edge function
    const { error: emailError } = await supabase.functions.invoke("send-casino-invitation", {
      body: {
        email: inviteEmail.trim().toLowerCase(),
        organizationName,
        invitationId: insertedData.id,
      },
    });

    if (emailError) {
      console.error("Failed to send invitation email:", emailError);
      toast({
        title: "Invitation Created",
        description: `Invitation created but email failed to send. User can still sign up with ${inviteEmail}.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Invitation email sent to ${inviteEmail}`,
      });
    }

    setInviteEmail("");
    setInviteOrgId("");
    fetchCasinoInvitations();
    setInviteLoading(false);
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    const { error } = await supabase
      .from("casino_invitations")
      .delete()
      .eq("id", invitationId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete invitation",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Invitation deleted",
      });
      fetchCasinoInvitations();
    }
  };

  const handleRemoveCasinoUser = async (roleId: string) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", roleId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove casino user",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Casino user role removed",
      });
      fetchCasinoUsers();
    }
  };

  const openTicketReview = async (ticketId: string) => {
    setReviewDialogOpen(true);
    setReviewLoading(true);
    setSelectedTicket(null);

    try {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          `id,
           seller_id,
           tournament_name,
           venue,
           event_date,
           buy_in,
           asking_price,
           money_guarantee,
           description,
           status,
           created_at,
           total_views,
           first_name,
           last_name,
           casino_alias`
        )
        .eq("id", ticketId)
        .single();

      if (error || !data) {
        console.error("Error fetching ticket for review", error);
        toast({
          title: "Error",
          description: "Failed to load ticket details for review.",
          variant: "destructive",
        });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", data.seller_id)
        .maybeSingle();

      setSelectedTicket({
        id: data.id,
        tournament_name: data.tournament_name,
        venue: data.venue,
        asking_price: data.asking_price,
        status: data.status,
        created_at: data.created_at,
        seller_username: profile?.username || "Unknown",
        total_views: data.total_views,
        event_date: data.event_date,
        buy_in: data.buy_in,
        money_guarantee: data.money_guarantee,
        description: data.description,
        first_name: data.first_name,
        last_name: data.last_name,
        casino_alias: data.casino_alias,
      });
    } catch (err) {
      console.error("Unexpected error loading ticket for review", err);
      toast({
        title: "Error",
        description: "Unexpected error while loading ticket.",
        variant: "destructive",
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const openEditTicket = async (ticketId: string) => {
    setEditTicketLoading(true);

    try {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          `id,
           seller_id,
           tournament_name,
           venue,
           event_date,
           buy_in,
           asking_price,
           money_guarantee,
           description,
           status,
           created_at,
           total_views,
           first_name,
           last_name,
           casino_alias`
        )
        .eq("id", ticketId)
        .single();

      if (error || !data) {
        console.error("Error fetching ticket for edit", error);
        toast({
          title: "Error",
          description: "Failed to load ticket details for editing.",
          variant: "destructive",
        });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", data.seller_id)
        .maybeSingle();

      const ticketData: TicketReviewData = {
        id: data.id,
        tournament_name: data.tournament_name,
        venue: data.venue,
        asking_price: data.asking_price,
        status: data.status,
        created_at: data.created_at,
        seller_username: profile?.username || "Unknown",
        total_views: data.total_views,
        event_date: data.event_date,
        buy_in: data.buy_in,
        money_guarantee: data.money_guarantee,
        description: data.description,
        first_name: data.first_name,
        last_name: data.last_name,
        casino_alias: data.casino_alias,
      };

      setEditingTicket(ticketData);
      setEditTicketForm({
        tournament_name: data.tournament_name,
        venue: data.venue,
        event_date: data.event_date,
        buy_in: (data.buy_in / 100).toString(),
        asking_price: (data.asking_price / 100).toString(),
        money_guarantee: data.money_guarantee ? (data.money_guarantee / 100).toString() : "",
        description: data.description || "",
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        casino_alias: data.casino_alias || "",
      });
    } catch (err) {
      console.error("Unexpected error loading ticket for edit", err);
      toast({
        title: "Error",
        description: "Unexpected error while loading ticket.",
        variant: "destructive",
      });
    } finally {
      setEditTicketLoading(false);
    }
  };

  const handleUpdateTicket = async () => {
    if (!editingTicket) return;

    if (!editTicketForm.tournament_name.trim() || !editTicketForm.venue.trim()) {
      toast({
        title: "Error",
        description: "Tournament name and venue are required",
        variant: "destructive",
      });
      return;
    }

    const buyIn = parseFloat(editTicketForm.buy_in);
    const askingPrice = parseFloat(editTicketForm.asking_price);
    const moneyGuarantee = editTicketForm.money_guarantee ? parseFloat(editTicketForm.money_guarantee) : null;

    if (isNaN(buyIn) || buyIn <= 0) {
      toast({
        title: "Error",
        description: "Buy-in must be a valid positive number",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(askingPrice) || askingPrice <= 0) {
      toast({
        title: "Error",
        description: "Asking price must be a valid positive number",
        variant: "destructive",
      });
      return;
    }

    setEditTicketLoading(true);

    const { error } = await supabase
      .from("tickets")
      .update({
        tournament_name: editTicketForm.tournament_name.trim(),
        venue: editTicketForm.venue.trim(),
        event_date: editTicketForm.event_date,
        buy_in: Math.round(buyIn * 100),
        asking_price: Math.round(askingPrice * 100),
        money_guarantee: moneyGuarantee ? Math.round(moneyGuarantee * 100) : null,
        description: editTicketForm.description.trim() || null,
        first_name: editTicketForm.first_name.trim() || null,
        last_name: editTicketForm.last_name.trim() || null,
        casino_alias: editTicketForm.casino_alias.trim() || null,
      })
      .eq("id", editingTicket.id);

    if (error) {
      console.error("Error updating ticket:", error);
      toast({
        title: "Error",
        description: "Failed to update ticket",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Ticket updated successfully",
      });
      setEditingTicket(null);
      fetchTickets();
    }

    setEditTicketLoading(false);
  };

  const exportWaitlistToCSV = () => {
    if (waitlist.length === 0) {
      toast({
        title: "No Data",
        description: "There are no waitlist entries to export.",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      ["Email", "Joined Date"],
      ...waitlist.map(entry => [
        entry.email,
        new Date(entry.created_at).toLocaleDateString()
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `waitlist_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: "Waitlist exported to CSV successfully.",
    });
  };

  const handlePayoutAction = async (payoutId: string, newStatus: "pending" | "processing" | "completed" | "failed" | "cancelled") => {
    // Get payout details for email
    const payout = payouts.find(p => p.id === payoutId);

    const { error } = await supabase
      .from("payouts")
      .update({
        status: newStatus,
        processed_at: newStatus === "processing" ? new Date().toISOString() : undefined,
        completed_at: newStatus === "completed" ? new Date().toISOString() : undefined,
      })
      .eq("id", payoutId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update payout status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Payout marked as ${newStatus}`,
      });

      // Send email notification for completed or failed payouts
      if (payout && (newStatus === "completed" || newStatus === "failed")) {
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("email, first_name, username")
          .eq("id", payout.user_id)
          .maybeSingle();

        if (userProfile?.email) {
          try {
            if (newStatus === "completed") {
              await sendPayoutCompletedNotification(userProfile.email, {
                userName: userProfile.first_name || userProfile.username,
                amount: payout.amount,
                method: payout.method,
                completedAt: new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
              });
            } else if (newStatus === "failed") {
              await sendPayoutFailedNotification(userProfile.email, {
                userName: userProfile.first_name || userProfile.username,
                amount: payout.amount,
                method: payout.method,
              });
            }
          } catch (emailError) {
            console.error("Failed to send payout notification email:", emailError);
          }
        }
      }

      fetchPayouts();
      fetchStats();
    }
  };

  const handleTicketApproval = async (ticketId: string, newStatus: "available" | "rejected") => {
    // Get ticket details for email
    const { data: ticketDetails } = await supabase
      .from("tickets")
      .select("tournament_name, venue, event_date, asking_price, seller_id")
      .eq("id", ticketId)
      .maybeSingle();

    const { error } = await supabase
      .from("tickets")
      .update({ status: newStatus })
      .eq("id", ticketId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update ticket status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: newStatus === "available" ? "Ticket approved and now live" : "Ticket rejected",
      });

      // Send email notification to seller
      if (ticketDetails) {
        const { data: sellerProfile } = await supabase
          .from("profiles")
          .select("email, first_name, username")
          .eq("id", ticketDetails.seller_id)
          .maybeSingle();

        if (sellerProfile?.email) {
          try {
            if (newStatus === "available") {
              await sendTicketApprovalNotification(sellerProfile.email, {
                sellerName: sellerProfile.first_name || sellerProfile.username,
                tournamentName: ticketDetails.tournament_name,
                venue: ticketDetails.venue,
                eventDate: new Date(ticketDetails.event_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }),
                askingPrice: ticketDetails.asking_price,
              });
            } else {
              await sendTicketRejectionNotification(sellerProfile.email, {
                sellerName: sellerProfile.first_name || sellerProfile.username,
                tournamentName: ticketDetails.tournament_name,
                venue: ticketDetails.venue,
              });
            }
          } catch (emailError) {
            console.error("Failed to send ticket approval/rejection email:", emailError);
          }
        }
      }

      fetchTickets();
      fetchStats();
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    // Hard delete user via edge function (deletes from auth.users)
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { userId },
    });

    if (error || !data?.success) {
      toast({
        title: "Error",
        description: `Failed to delete user: ${error?.message || data?.error || "Unknown error"}`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "User Deleted",
      description: `Successfully deleted user "${username}" permanently`,
    });
    fetchUsers();
    fetchStats();
  };

  const handleDeleteTicket = async (ticketId: string, tournamentName: string) => {
    const { error } = await supabase
      .from("tickets")
      .delete()
      .eq("id", ticketId);

    if (error) {
      toast({
        title: "Error",
        description: `Failed to delete ticket: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Ticket Deleted",
      description: `Successfully deleted ticket "${tournamentName}"`,
    });
    fetchTickets();
    fetchStats();
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchWallets(),
      fetchTransactions(),
      fetchPayouts(),
      fetchUsers(),
      fetchTickets(),
      fetchPurchases(),
      fetchWaitlist(),
      fetchOrganizations(),
      fetchCasinoInvitations(),
      fetchCasinoUsers(),
      fetchVerificationStats(),
      fetchVenueRequests(),
      fetchOrganizationStats(),
    ]);

    console.log("All data loaded....")
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div>
        <h1 className="text-3xl font-bold mb-2">Operator Dashboard</h1>
        <p className="text-muted-foreground mb-8">Day-to-day operations and management</p>

        {/* Stats Overview - Row 1: Weekly Performance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
          <Card className="p-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Weekly Revenue</p>
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">${(stats.weeklyRevenue / 100).toLocaleString()}</p>
                {(() => {
                  const pct = calcWoWPercent(stats.weeklyRevenue, stats.prevWeekRevenue);
                  return pct !== null ? (
                    <span className={`text-xs font-medium ${pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
              <p className="text-xs text-muted-foreground">vs previous week</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Weekly Platform Earnings</p>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">${(stats.weeklyPlatformEarnings / 100).toLocaleString()}</p>
                {(() => {
                  const pct = calcWoWPercent(stats.weeklyPlatformEarnings, stats.prevWeekPlatformEarnings);
                  return pct !== null ? (
                    <span className={`text-xs font-medium ${pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
              <p className="text-xs text-muted-foreground">vs previous week</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Weekly Casino Earnings</p>
                <Building2 className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">${(stats.weeklyCasinoEarnings / 100).toLocaleString()}</p>
                {(() => {
                  const pct = calcWoWPercent(stats.weeklyCasinoEarnings, stats.prevWeekCasinoEarnings);
                  return pct !== null ? (
                    <span className={`text-xs font-medium ${pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
              <p className="text-xs text-muted-foreground">vs previous week</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Weekly New Users</p>
                <UserPlus className="h-4 w-4 text-accent" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{stats.weeklyNewUsers}</p>
                {(() => {
                  const pct = calcWoWPercent(stats.weeklyNewUsers, stats.prevWeekNewUsers);
                  return pct !== null ? (
                    <span className={`text-xs font-medium ${pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
              <p className="text-xs text-muted-foreground">vs previous week</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Weekly New Tickets</p>
                <Ticket className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{stats.weeklyNewTickets}</p>
                {(() => {
                  const pct = calcWoWPercent(stats.weeklyNewTickets, stats.prevWeekNewTickets);
                  return pct !== null ? (
                    <span className={`text-xs font-medium ${pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                    </span>
                  ) : null;
                })()}
              </div>
              <p className="text-xs text-muted-foreground">vs previous week</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Total Tickets</p>
                <Ticket className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{stats.totalTickets}</p>
              <p className="text-xs text-muted-foreground">All time</p>
            </div>
          </Card>
        </div>

        {/* Stats Overview - Row 2: Pending/Action Items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <Card className={`p-6 ${stats.pendingVerificationTickets > 0 ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Pending Verification</p>
                <Clock className="h-4 w-4 text-yellow-500" />
              </div>
              <p className={`text-2xl font-bold ${stats.pendingVerificationTickets > 0 ? 'text-yellow-500' : ''}`}>
                {stats.pendingVerificationTickets}
              </p>
              <p className="text-xs text-muted-foreground">Awaiting casino approval</p>
            </div>
          </Card>

          <Card className={`p-6 ${stats.pendingApprovalTickets > 0 ? 'border-orange-500/50 bg-orange-500/5' : ''}`}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Pending Listings</p>
                <Shield className="h-4 w-4 text-orange-500" />
              </div>
              <p className={`text-2xl font-bold ${stats.pendingApprovalTickets > 0 ? 'text-orange-500' : ''}`}>
                {stats.pendingApprovalTickets}
              </p>
              <p className="text-xs text-muted-foreground">Need admin review</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Available Tickets</p>
                <Ticket className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-500">{stats.availableTickets}</p>
              <p className="text-xs text-muted-foreground">Live on marketplace</p>
            </div>
          </Card>

          <Card className={`p-6 ${stats.pendingDisputes > 0 ? 'border-red-500/50 bg-red-500/5' : ''}`}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Pending Disputes</p>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <p className={`text-2xl font-bold ${stats.pendingDisputes > 0 ? 'text-red-500' : ''}`}>
                {stats.pendingDisputes}
              </p>
              <p className="text-xs text-muted-foreground">Open or investigating</p>
            </div>
          </Card>

          <Card className={`p-6 ${stats.pendingVenueRequests > 0 ? 'border-purple-500/50 bg-purple-500/5' : ''}`}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Pending Venue Requests</p>
                <Building2 className="h-4 w-4 text-purple-500" />
              </div>
              <p className={`text-2xl font-bold ${stats.pendingVenueRequests > 0 ? 'text-purple-500' : ''}`}>
                {stats.pendingVenueRequests}
              </p>
              <p className="text-xs text-muted-foreground">New venue leads</p>
            </div>
          </Card>

          <Card className={`p-6 ${stats.pendingPayouts > 0 ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Pending Payouts</p>
                <Wallet className="h-4 w-4 text-yellow-500" />
              </div>
              <p className={`text-2xl font-bold ${stats.pendingPayouts > 0 ? 'text-yellow-500' : ''}`}>
                ${(stats.pendingPayouts / 100).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Awaiting processing</p>
            </div>
          </Card>
        </div>

        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>

        {/* Tabs for detailed views */}
        <Tabs defaultValue="overview" className="w-full">
          <div className="overflow-x-auto mb-4">
            <TabsList className="inline-flex w-auto min-w-full">
              <TabsTrigger value="overview" className="flex-1 sm:flex-none">Overview</TabsTrigger>
              <TabsTrigger value="overview-plus" className="flex-1 sm:flex-none">
                <Sparkles className="h-4 w-4 mr-1" />
                Overview+
              </TabsTrigger>
              <TabsTrigger value="approvals" className="flex-1 sm:flex-none relative">
                Approvals
                {stats.pendingApprovalTickets > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {stats.pendingApprovalTickets}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="casinos" className="flex-1 sm:flex-none relative">
                Casinos
                {stats.pendingVenueRequests > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {stats.pendingVenueRequests}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="verifications" className="flex-1 sm:flex-none">Verifications</TabsTrigger>
              <TabsTrigger value="disputes" className="flex-1 sm:flex-none">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Disputes
              </TabsTrigger>
              <TabsTrigger value="waitlist" className="flex-1 sm:flex-none">Waitlist</TabsTrigger>
              <TabsTrigger value="giveaway" className="flex-1 sm:flex-none">
                <Gift className="h-4 w-4 mr-1" />
                Giveaway
              </TabsTrigger>
              <TabsTrigger value="users" className="flex-1 sm:flex-none">Users</TabsTrigger>
              <TabsTrigger value="tickets" className="flex-1 sm:flex-none">Tickets</TabsTrigger>
              <TabsTrigger value="purchases" className="flex-1 sm:flex-none">Purchases</TabsTrigger>
              <TabsTrigger value="payouts" className="flex-1 sm:flex-none">Payouts</TabsTrigger>
              <TabsTrigger value="wallets" className="flex-1 sm:flex-none">Wallets</TabsTrigger>
              <TabsTrigger value="transactions" className="flex-1 sm:flex-none">Transactions</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Weekly Performance
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Weekly Revenue</span>
                    <span className="font-bold text-green-600">${(stats.weeklyRevenue / 100).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Platform Earnings</span>
                    <span className="font-bold">${(stats.weeklyPlatformEarnings / 100).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Casino Earnings</span>
                    <span className="font-bold">${(stats.weeklyCasinoEarnings / 100).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">New Users</span>
                    <span className="font-bold">{stats.weeklyNewUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">New Tickets</span>
                    <span className="font-bold">{stats.weeklyNewTickets}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Action Items
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pending Verifications</span>
                    <span className={`font-bold ${stats.pendingVerificationTickets > 0 ? 'text-yellow-500' : 'text-green-600'}`}>
                      {stats.pendingVerificationTickets}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pending Listings</span>
                    <span className={`font-bold ${stats.pendingApprovalTickets > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                      {stats.pendingApprovalTickets}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pending Disputes</span>
                    <span className={`font-bold ${stats.pendingDisputes > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {stats.pendingDisputes}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pending Payouts</span>
                    <Badge variant="secondary">
                      ${(stats.pendingPayouts / 100).toLocaleString()}
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="overview-plus">
            <OverviewPlusTab />
          </TabsContent>

          <TabsContent value="approvals">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5" />
                    Pending Ticket Approvals
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Review and approve seller ticket listings before they go live
                  </p>
                </div>
              </div>

              {tickets.filter(t => t.status === "pending_approval").length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tickets pending approval
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tournament</TableHead>
                        <TableHead>Venue</TableHead>
                        <TableHead>Seller</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets
                        .filter(t => t.status === "pending_approval")
                        .map((ticket) => (
                          <TableRow key={ticket.id}>
                            <TableCell className="font-medium">{ticket.tournament_name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{ticket.venue}</TableCell>
                            <TableCell>{ticket.seller_username}</TableCell>
                            <TableCell>${(ticket.asking_price / 100).toLocaleString()}</TableCell>
                            <TableCell>
                              {new Date(ticket.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openTicketReview(ticket.id)}
                                  className="flex items-center gap-1"
                                >
                                  <Ticket className="h-4 w-4" />
                                  Review
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleTicketApproval(ticket.id, "available")}
                                  className="flex items-center gap-1"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleTicketApproval(ticket.id, "rejected")}
                                  className="flex items-center gap-1"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="casinos">
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Casino/Venue Performance
                </h2>
                {organizationStats.length === 0 ? (
                  <p className="text-muted-foreground">No venue data recorded yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organization</TableHead>
                          <TableHead className="text-center">Total Listed</TableHead>
                          <TableHead className="text-center">Available</TableHead>
                          <TableHead className="text-center">Sold</TableHead>
                          <TableHead className="text-center">Declined</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Venue Profit</TableHead>
                          <TableHead className="text-right">Platform Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {organizationStats.map((stats) => (
                          <TableRow key={stats.organization_id}>
                            <TableCell className="font-medium">{stats.organization_name}</TableCell>
                            <TableCell className="text-center">{stats.total_tickets}</TableCell>
                            <TableCell className="text-center">{stats.available_tickets}</TableCell>
                            <TableCell className="text-center">{stats.sold_tickets}</TableCell>
                            <TableCell className="text-center">{stats.declined_tickets}</TableCell>
                            <TableCell className="text-right">${(stats.revenue / 100).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">${(stats.venue_profit / 100).toLocaleString()}</TableCell>
                            <TableCell className="text-right">${(stats.platform_profit / 100).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 font-bold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-center">{organizationStats.reduce((s, e) => s + e.total_tickets, 0)}</TableCell>
                          <TableCell className="text-center">{organizationStats.reduce((s, e) => s + e.available_tickets, 0)}</TableCell>
                          <TableCell className="text-center">{organizationStats.reduce((s, e) => s + e.sold_tickets, 0)}</TableCell>
                          <TableCell className="text-center">{organizationStats.reduce((s, e) => s + e.declined_tickets, 0)}</TableCell>
                          <TableCell className="text-right">${(organizationStats.reduce((s, e) => s + e.revenue, 0) / 100).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">${(organizationStats.reduce((s, e) => s + e.venue_profit, 0) / 100).toLocaleString()}</TableCell>
                          <TableCell className="text-right">${(organizationStats.reduce((s, e) => s + e.platform_profit, 0) / 100).toLocaleString()}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>

              {/* Create Organization */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Create Casino Organization
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input
                      id="org-name"
                      placeholder="Casino name..."
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-city">City</Label>
                    <Input
                      id="org-city"
                      placeholder="City..."
                      value={newOrgCity}
                      onChange={(e) => setNewOrgCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-country">Country</Label>
                    <Input
                      id="org-country"
                      placeholder="Country..."
                      value={newOrgCountry}
                      onChange={(e) => setNewOrgCountry(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-fee">Fee %</Label>
                    <Input
                      id="org-fee"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="10"
                      value={newOrgFeePercentage}
                      onChange={(e) => setNewOrgFeePercentage(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleCreateOrganization}
                    disabled={createOrgLoading}
                    className="sm:self-end"
                  >
                    {createOrgLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create
                  </Button>
                </div>
              </Card>

              {/* Organizations List */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Casino Organizations</h2>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Fee %</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {organizations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No casino organizations yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        organizations.map((org) => (
                          <TableRow key={org.id}>
                            <TableCell className="font-medium">{org.name}</TableCell>
                            <TableCell>{org.city || "-"}</TableCell>
                            <TableCell>{org.country || "-"}</TableCell>
                            <TableCell>{org.fee_percentage}%</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  org.status === "active" ? "default" :
                                    org.status === "waitlisted" ? "secondary" :
                                      "destructive"
                                }
                              >
                                {org.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(org.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditOrgDialog(org)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {org.status !== "active" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleUpdateOrgStatus(org.id, "active")}
                                  >
                                    Activate
                                  </Button>
                                )}
                                {org.status !== "suspended" && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleUpdateOrgStatus(org.id, "suspended")}
                                  >
                                    Suspend
                                  </Button>
                                )}
                                {org.status === "suspended" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUpdateOrgStatus(org.id, "waitlisted")}
                                  >
                                    Waitlist
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Invite Casino User */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Invite Casino User
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="invite-email">Email Address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="user@casino.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="invite-org">Casino Organization</Label>
                    <Select value={inviteOrgId} onValueChange={setInviteOrgId}>
                      <SelectTrigger id="invite-org">
                        <SelectValue placeholder="Select organization..." />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations
                          .filter(org => org.status === "active")
                          .map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleInviteCasinoUser}
                    disabled={inviteLoading}
                    className="sm:self-end"
                  >
                    {inviteLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Invitation
                  </Button>
                </div>
              </Card>

              {/* Pending Invitations */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Pending Invitations</h2>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {casinoInvitations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No pending invitations
                          </TableCell>
                        </TableRow>
                      ) : (
                        casinoInvitations.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">{inv.email}</TableCell>
                            <TableCell>{inv.organization_name}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  inv.status === "accepted" ? "default" :
                                    inv.status === "pending" ? "secondary" :
                                      "destructive"
                                }
                              >
                                {inv.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(inv.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {new Date(inv.expires_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {inv.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteInvitation(inv.id)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Casino Users */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Casino Users</h2>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {casinoUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No casino users yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        casinoUsers.map((cu) => (
                          <TableRow key={cu.id}>
                            <TableCell className="font-medium">{cu.username}</TableCell>
                            <TableCell className="text-muted-foreground">{cu.email}</TableCell>
                            <TableCell>{cu.organization_name}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemoveCasinoUser(cu.id)}
                              >
                                Remove Role
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Venue Requests (Leads) */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Venue Requests (Leads)
                </h2>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Venue Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {venueRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No venue requests yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        venueRequests.map((vr) => (
                          <TableRow key={vr.id}>
                            <TableCell className="font-medium">{vr.venue_name}</TableCell>
                            <TableCell>{vr.city}</TableCell>
                            <TableCell>{vr.country}</TableCell>
                            <TableCell className="text-muted-foreground">{vr.username}</TableCell>
                            <TableCell>
                              {new Date(vr.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  vr.status === "approved" ? "default" :
                                    vr.status === "rejected" ? "destructive" :
                                      "secondary"
                                }
                              >
                                {vr.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {vr.status === "pending" && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleApproveVenueRequest(vr)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRejectVenueRequest(vr.id)}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="verifications">
            <div className="space-y-6">
              {/* Verification Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-6 bg-card/50 border-2 border-border">
                  <p className="text-muted-foreground text-sm">Total Verifications</p>
                  <p className="text-3xl font-bold">{verificationStats.total}</p>
                </Card>
                <Card className="p-6 bg-card/50 border-2 border-border">
                  <p className="text-muted-foreground text-sm">Pending</p>
                  <p className="text-3xl font-bold text-yellow-500">{verificationStats.pending}</p>
                </Card>
                <Card className="p-6 bg-card/50 border-2 border-border">
                  <p className="text-muted-foreground text-sm">Approved</p>
                  <p className="text-3xl font-bold text-green-500">{verificationStats.approved}</p>
                </Card>
                <Card className="p-6 bg-card/50 border-2 border-border">
                  <p className="text-muted-foreground text-sm">Declined</p>
                  <p className="text-3xl font-bold text-red-500">{verificationStats.declined}</p>
                </Card>
              </div>

              {/* By Organization */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Verifications by Organization
                </h2>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead className="text-center">Pending</TableHead>
                        <TableHead className="text-center">Approved</TableHead>
                        <TableHead className="text-center">Declined</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verificationStats.byOrganization.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No verification data yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        verificationStats.byOrganization.map((org) => (
                          <TableRow key={org.org_id}>
                            <TableCell className="font-medium">{org.org_name}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                                {org.pending}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-green-500 border-green-500">
                                {org.approved}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-red-500 border-red-500">
                                {org.declined}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {org.pending + org.approved + org.declined}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/casino?org=${org.org_id}`)}
                              >
                                View Dashboard
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Quick Link */}
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">View Full Casino Dashboard</h3>
                    <p className="text-sm text-muted-foreground">
                      Access the complete verification interface with approve/decline actions
                    </p>
                  </div>
                  <Button onClick={() => navigate("/casino")}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Open Casino Dashboard
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="disputes">
            <DisputesTab />
          </TabsContent>

          <TabsContent value="waitlist">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                    <Mail className="h-5 w-5" />
                    Waitlist Management
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Manage and export pre-launch email signups
                  </p>
                </div>
                <Button onClick={exportWaitlistToCSV} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export to CSV
                </Button>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">Total Signups</p>
                    <p className="text-3xl font-bold text-primary">{waitlist.length}</p>
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-accent/10 to-accent/5">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">Last 7 Days</p>
                    <p className="text-3xl font-bold text-accent">
                      {waitlist.filter(entry => {
                        const entryDate = new Date(entry.created_at);
                        const sevenDaysAgo = new Date();
                        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                        return entryDate >= sevenDaysAgo;
                      }).length}
                    </p>
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">Last 24 Hours</p>
                    <p className="text-3xl font-bold text-green-500">
                      {waitlist.filter(entry => {
                        const entryDate = new Date(entry.created_at);
                        const oneDayAgo = new Date();
                        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                        return entryDate >= oneDayAgo;
                      }).length}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Waitlist Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Joined Date</TableHead>
                      <TableHead>Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waitlist.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No waitlist entries yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      waitlist.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.email}</TableCell>
                          <TableCell>
                            {new Date(entry.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {(() => {
                              const now = new Date();
                              const entryDate = new Date(entry.created_at);
                              const diffMs = now.getTime() - entryDate.getTime();
                              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                              const diffMinutes = Math.floor(diffMs / (1000 * 60));

                              if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                              if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                              return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
                            })()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="giveaway">
            <GiveawayTab />
          </TabsContent>

          <TabsContent value="users">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">All Users</h2>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tickets Listed</TableHead>
                      <TableHead>Tickets Sold</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users
                      .filter(user => matchesSearch(searchQuery, user.id, user.username, user.email))
                      .map((user) => (
                        <TableRow key={user.id}>
                          <TableCell><ShortId id={user.id} prefix="USR-" /></TableCell>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                          <TableCell>{user.ticket_count}</TableCell>
                          <TableCell>{user.sales_count}</TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete <strong>{user.username}</strong> ({user.email})?
                                    This action cannot be undone and will remove all their data including tickets and transactions.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeleteUser(user.id, user.username)}
                                  >
                                    Delete User
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="tickets">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">All Tickets</h2>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tournament</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Listed</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets
                      .filter(ticket => matchesSearch(searchQuery, ticket.id, ticket.tournament_name, ticket.venue, ticket.seller_username))
                      .map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell><ShortId id={ticket.id} prefix="TKT-" /></TableCell>
                          <TableCell className="font-medium">{ticket.tournament_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{ticket.venue}</TableCell>
                          <TableCell>{ticket.seller_username}</TableCell>
                          <TableCell>${(ticket.asking_price / 100).toLocaleString()}</TableCell>
                          <TableCell>{ticket.total_views}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                ticket.status === "available" ? "default" :
                                  ticket.status === "pending_approval" ? "secondary" :
                                    ticket.status === "rejected" ? "destructive" :
                                      "outline"
                              }
                            >
                              {ticket.status === "pending_approval" ? "pending" : ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditTicket(ticket.id)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {ticket.status === "pending_approval" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleTicketApproval(ticket.id, "available")}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleTicketApproval(ticket.id, "rejected")}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Ticket</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the ticket for <strong>{ticket.tournament_name}</strong>?
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDeleteTicket(ticket.id, ticket.tournament_name)}
                                    >
                                      Delete Ticket
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="purchases">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Recent Purchases</h2>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tournament</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Ticket Price</TableHead>
                      <TableHead>Service Fee</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases
                      .filter(purchase => matchesSearch(searchQuery, purchase.id, purchase.tournament_name, purchase.buyer_username, purchase.seller_username))
                      .map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell><ShortId id={purchase.id} prefix="PUR-" /></TableCell>
                          <TableCell className="font-medium">{purchase.tournament_name}</TableCell>
                          <TableCell>{purchase.buyer_username}</TableCell>
                          <TableCell>{purchase.seller_username}</TableCell>
                          <TableCell>${(purchase.ticket_price / 100).toLocaleString()}</TableCell>
                          <TableCell className="text-green-600">
                            ${(purchase.service_fee / 100).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {new Date(purchase.purchased_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="payouts">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Payout Requests</h2>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts
                      .filter(payout => matchesSearch(searchQuery, payout.id, payout.username))
                      .map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell><ShortId id={payout.id} prefix="PAY-" /></TableCell>
                          <TableCell className="font-medium">{payout.username}</TableCell>
                          <TableCell>${(payout.amount / 100).toLocaleString()}</TableCell>
                          <TableCell className="capitalize">{payout.method}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payout.status === "completed"
                                  ? "default"
                                  : payout.status === "pending"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {payout.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(payout.requested_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {payout.status === "pending" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePayoutAction(payout.id, "processing")}
                                >
                                  Process
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handlePayoutAction(payout.id, "completed")}
                                >
                                  Complete
                                </Button>
                              </div>
                            )}
                            {payout.status === "processing" && (
                              <Button
                                size="sm"
                                onClick={() => handlePayoutAction(payout.id, "completed")}
                              >
                                Complete
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="wallets">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Seller Wallets (Top 20)</h2>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wallets
                      .filter(wallet => matchesSearch(searchQuery, wallet.id, wallet.username))
                      .map((wallet) => (
                        <TableRow key={wallet.id}>
                          <TableCell><ShortId id={wallet.id} prefix="WAL-" /></TableCell>
                          <TableCell className="font-medium">{wallet.username}</TableCell>
                          <TableCell>${(wallet.balance / 100).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Recent Transactions (Last 50)</h2>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions
                      .filter(tx => matchesSearch(searchQuery, tx.id, tx.username, tx.description))
                      .map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell><ShortId id={tx.id} prefix="TXN-" /></TableCell>
                          <TableCell className="font-medium">
                            {tx.username || "Platform"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {tx.type}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={
                              tx.type === "sale" || tx.type === "refund"
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {tx.type === "sale" || tx.type === "refund" ? "+" : "-"}$
                            {(tx.amount / 100).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {tx.description}
                          </TableCell>
                          <TableCell>
                            {new Date(tx.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
          <Dialog
            open={reviewDialogOpen}
            onOpenChange={(open) => {
              setReviewDialogOpen(open);
              if (!open) {
                setSelectedTicket(null);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Review Ticket Listing</DialogTitle>
                <DialogDescription>
                  Inspect the full ticket details before approving or rejecting.
                </DialogDescription>
              </DialogHeader>
              {reviewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : selectedTicket ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Tournament</p>
                    <p className="font-semibold">{selectedTicket.tournament_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Venue</p>
                    <p>{selectedTicket.venue}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Event Date</p>
                      <p>{new Date(selectedTicket.event_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Seller</p>
                      <p>{selectedTicket.seller_username}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Buy-in</p>
                      <p>${(selectedTicket.buy_in / 100).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Asking Price</p>
                      <p>${(selectedTicket.asking_price / 100).toLocaleString()}</p>
                    </div>
                  </div>
                  {selectedTicket.money_guarantee !== null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Money Guarantee</p>
                      <p>${(selectedTicket.money_guarantee / 100).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedTicket.description && (
                    <div>
                      <p className="text-xs text-muted-foreground">Description</p>
                      <p className="whitespace-pre-line text-sm">
                        {selectedTicket.description}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Seller First Name</p>
                      <p>{selectedTicket.first_name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Seller Last Name</p>
                      <p>{selectedTicket.last_name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Casino Alias</p>
                      <p>{selectedTicket.casino_alias || "-"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No ticket selected.
                </p>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit Organization Dialog */}
          <Dialog open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Organization</DialogTitle>
                <DialogDescription>
                  Update the casino organization details.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="edit-org-name">Organization Name</Label>
                  <Input
                    id="edit-org-name"
                    value={editOrgName}
                    onChange={(e) => setEditOrgName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-org-city">City</Label>
                  <Input
                    id="edit-org-city"
                    value={editOrgCity}
                    onChange={(e) => setEditOrgCity(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-org-country">Country</Label>
                  <Input
                    id="edit-org-country"
                    value={editOrgCountry}
                    onChange={(e) => setEditOrgCountry(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-org-fee">Fee Percentage</Label>
                  <Input
                    id="edit-org-fee"
                    type="number"
                    min="0"
                    max="100"
                    value={editOrgFeePercentage}
                    onChange={(e) => setEditOrgFeePercentage(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setEditingOrg(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateOrganization} disabled={editOrgLoading}>
                    {editOrgLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Ticket Dialog */}
          <Dialog open={!!editingTicket} onOpenChange={(open) => !open && setEditingTicket(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Ticket</DialogTitle>
                <DialogDescription>
                  Update ticket details. Prices are in dollars.
                </DialogDescription>
              </DialogHeader>
              {editTicketLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="edit-ticket-tournament">Tournament Name</Label>
                      <Input
                        id="edit-ticket-tournament"
                        value={editTicketForm.tournament_name}
                        onChange={(e) => setEditTicketForm(prev => ({ ...prev, tournament_name: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="edit-ticket-venue">Venue</Label>
                      <Input
                        id="edit-ticket-venue"
                        value={editTicketForm.venue}
                        onChange={(e) => setEditTicketForm(prev => ({ ...prev, venue: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-ticket-date">Event Date</Label>
                      <Input
                        id="edit-ticket-date"
                        type="date"
                        value={editTicketForm.event_date}
                        onChange={(e) => setEditTicketForm(prev => ({ ...prev, event_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-ticket-buyin">Buy-in ($)</Label>
                      <Input
                        id="edit-ticket-buyin"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editTicketForm.buy_in}
                        onChange={(e) => setEditTicketForm(prev => ({ ...prev, buy_in: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-ticket-price">Asking Price ($)</Label>
                      <Input
                        id="edit-ticket-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editTicketForm.asking_price}
                        onChange={(e) => setEditTicketForm(prev => ({ ...prev, asking_price: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-ticket-guarantee">Money Guarantee ($)</Label>
                      <Input
                        id="edit-ticket-guarantee"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Optional"
                        value={editTicketForm.money_guarantee}
                        onChange={(e) => setEditTicketForm(prev => ({ ...prev, money_guarantee: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-ticket-description">Description</Label>
                    <Input
                      id="edit-ticket-description"
                      value={editTicketForm.description}
                      onChange={(e) => setEditTicketForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                    <div>
                      <Label htmlFor="edit-ticket-firstname">Seller First Name</Label>
                      <Input
                        id="edit-ticket-firstname"
                        value={editTicketForm.first_name}
                        onChange={(e) => setEditTicketForm(prev => ({ ...prev, first_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-ticket-lastname">Seller Last Name</Label>
                      <Input
                        id="edit-ticket-lastname"
                        value={editTicketForm.last_name}
                        onChange={(e) => setEditTicketForm(prev => ({ ...prev, last_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-ticket-alias">Casino Alias</Label>
                      <Input
                        id="edit-ticket-alias"
                        value={editTicketForm.casino_alias}
                        onChange={(e) => setEditTicketForm(prev => ({ ...prev, casino_alias: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setEditingTicket(null)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateTicket} disabled={editTicketLoading}>
                      {editTicketLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
