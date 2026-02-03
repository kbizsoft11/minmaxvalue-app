import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  Ticket,
  Clock,
  AlertTriangle,
  Activity,
  Wallet,
  BarChart3,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

interface DateRange {
  label: string;
  days: number;
}

interface CompareMode {
  label: string;
  value: "wow" | "mom" | "none";
}

const DATE_RANGES: DateRange[] = [
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "90 Days", days: 90 },
];

const COMPARE_MODES: CompareMode[] = [
  { label: "WoW", value: "wow" },
  { label: "MoM", value: "mom" },
  { label: "None", value: "none" },
];

interface OverviewPlusData {
  // Left Block - Operational
  pendingVerifications: number;
  pendingApprovals: number;
  pendingPayoutsCount: number;
  supportTickets: number;

  // Middle Block - Health
  outstandingPayoutLiability: number;
  conversionRate: number;
  activeListings: number;
  avgTimeToSell: number;

  // Right Block - Growth
  newUsersThisWeek: number;
  newUsersLastWeek: number;
  newListingsThisWeek: number;
  newListingsLastWeek: number;

  // Other existing data
  gmv: number;
  gmvPrevious: number;
  platformRevenue: number;
  platformRevenuePrevious: number;
  activeBuyers: number;
  activeBuyersPrevious: number;
  activeSellers: number;
  activeSellersPrevious: number;
  conversionRatePrevious: number;
  sellThroughRate: number;
  inventoryAging: {
    "0-3": number;
    "4-7": number;
    "8-14": number;
    "15+": number;
  };
  walletEscrowBalance: number;
  platformFloat: number;
  refundRate: number;
  disputeCount: number;
  failedPayouts: number;
  failedTransactions: number;
  waitlistBacklog: number;

  // Charts
  gmvPerDay: { date: string; current: number; previous: number }[];
  funnelData: { stage: string; count: number }[];
}

const OverviewPlusTab = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<number>(7);
  const [compareMode, setCompareMode] = useState<"wow" | "mom" | "none">("wow");
  const [data, setData] = useState<OverviewPlusData | null>(null);

  const fetchData = async () => {
    setLoading(true);

    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - dateRange);

    let previousStart = new Date(currentStart);
    let previousEnd = new Date(now);
    previousEnd.setDate(previousEnd.getDate() - dateRange);

    if (compareMode === "wow") {
      previousStart.setDate(previousStart.getDate() - 7);
    } else if (compareMode === "mom") {
      previousStart.setDate(previousStart.getDate() - 30);
    }

    // Calculate week boundaries for new users/listings
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    // Fetch all required data in parallel
    const [
      purchasesResult,
      previousPurchasesResult,
      platformEarningsResult,
      previousPlatformEarningsResult,
      ticketsResult,
      payoutsResult,
      walletsResult,
      verificationsResult,
      waitlistResult,
      ticketViewsResult,
      profilesResult,
    ] = await Promise.all([
      // Current period purchases
      supabase
        .from("purchases")
        .select("id, buyer_id, ticket_price, service_fee, total_amount, purchased_at, ticket_id")
        .gte("purchased_at", currentStart.toISOString())
        .lte("purchased_at", now.toISOString()),
      // Previous period purchases
      supabase
        .from("purchases")
        .select("id, buyer_id, ticket_price, total_amount, purchased_at")
        .gte("purchased_at", previousStart.toISOString())
        .lt("purchased_at", currentStart.toISOString()),
      // Current platform earnings
      supabase
        .from("platform_earnings")
        .select("amount, created_at")
        .gte("created_at", currentStart.toISOString()),
      // Previous platform earnings
      supabase
        .from("platform_earnings")
        .select("amount, created_at")
        .gte("created_at", previousStart.toISOString())
        .lt("created_at", currentStart.toISOString()),
      // All tickets
      supabase.from("tickets").select("id, seller_id, status, created_at, updated_at"),
      // Payouts
      supabase.from("payouts").select("id, amount, status, requested_at"),
      // Wallets
      supabase.from("wallets").select("id, balance"),
      // Casino verifications
      supabase.from("casino_verifications").select("id, status"),
      // Waitlist
      supabase.from("waitlist").select("id"),
      // Ticket views for funnel
      supabase.from("ticket_views").select("id, ticket_id"),
      // Profiles for new users
      supabase.from("profiles").select("id, created_at"),
    ]);

    const purchases = purchasesResult.data || [];
    const previousPurchases = previousPurchasesResult.data || [];
    const platformEarnings = platformEarningsResult.data || [];
    const previousPlatformEarnings = previousPlatformEarningsResult.data || [];
    const tickets = ticketsResult.data || [];
    const payouts = payoutsResult.data || [];
    const wallets = walletsResult.data || [];
    const verifications = verificationsResult.data || [];
    const waitlist = waitlistResult.data || [];
    const ticketViews = ticketViewsResult.data || [];
    const profiles = profilesResult.data || [];

    // Calculate new users this week vs last week
    const newUsersThisWeek = profiles.filter((p) => {
      const createdAt = new Date(p.created_at);
      return createdAt >= thisWeekStart && createdAt <= now;
    }).length;
    const newUsersLastWeek = profiles.filter((p) => {
      const createdAt = new Date(p.created_at);
      return createdAt >= lastWeekStart && createdAt < thisWeekStart;
    }).length;

    // Calculate new listings this week vs last week
    const newListingsThisWeek = tickets.filter((t) => {
      const createdAt = new Date(t.created_at || "");
      return createdAt >= thisWeekStart && createdAt <= now;
    }).length;
    const newListingsLastWeek = tickets.filter((t) => {
      const createdAt = new Date(t.created_at || "");
      return createdAt >= lastWeekStart && createdAt < thisWeekStart;
    }).length;

    // Calculate KPIs
    const gmv = purchases.reduce((sum, p) => sum + p.total_amount, 0);
    const gmvPrevious = previousPurchases.reduce((sum, p) => sum + p.total_amount, 0);

    const platformRevenue = platformEarnings.reduce((sum, e) => sum + e.amount, 0);
    const platformRevenuePrevious = previousPlatformEarnings.reduce((sum, e) => sum + e.amount, 0);

    const activeBuyers = new Set(purchases.map((p) => p.buyer_id)).size;
    const activeBuyersPrevious = new Set(previousPurchases.map((p) => p.buyer_id)).size;

    const currentSellerIds = new Set(
      tickets
        .filter((t) => new Date(t.created_at || "") >= currentStart)
        .map((t) => t.seller_id)
    );
    const previousSellerIds = new Set(
      tickets
        .filter(
          (t) =>
            new Date(t.created_at || "") >= previousStart &&
            new Date(t.created_at || "") < currentStart
        )
        .map((t) => t.seller_id)
    );

    const activeSellers = currentSellerIds.size;
    const activeSellersPrevious = previousSellerIds.size;

    // Conversion rate
    const totalTickets = tickets.length;
    const soldTickets = tickets.filter((t) => t.status === "sold").length;
    const conversionRate = totalTickets > 0 ? (soldTickets / totalTickets) * 100 : 0;
    const conversionRatePrevious = conversionRate; // Simplified for now

    // Liquidity & Health
    const activeListings = tickets.filter((t) => t.status === "available").length;
    const sellThroughRate = totalTickets > 0 ? (soldTickets / totalTickets) * 100 : 0;

    // Average time to sell (simplified - using sold tickets from current period)
    let avgTimeToSell = 0;
    const soldTicketsData = tickets.filter((t) => t.status === "sold" && t.created_at && t.updated_at);
    if (soldTicketsData.length > 0) {
      const totalDays = soldTicketsData.reduce((sum, t) => {
        const created = new Date(t.created_at!);
        const updated = new Date(t.updated_at!);
        return sum + (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      }, 0);
      avgTimeToSell = totalDays / soldTicketsData.length;
    }

    // Inventory aging
    const availableTickets = tickets.filter((t) => t.status === "available");
    const inventoryAging = {
      "0-3": 0,
      "4-7": 0,
      "8-14": 0,
      "15+": 0,
    };
    availableTickets.forEach((t) => {
      if (!t.created_at) return;
      const daysOld = (now.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld <= 3) inventoryAging["0-3"]++;
      else if (daysOld <= 7) inventoryAging["4-7"]++;
      else if (daysOld <= 14) inventoryAging["8-14"]++;
      else inventoryAging["15+"]++;
    });

    // Financial Risk
    const pendingPayoutsList = payouts.filter((p) => p.status === "pending");
    const outstandingPayoutLiability = pendingPayoutsList.reduce((sum, p) => sum + p.amount, 0);
    const pendingPayoutsCount = pendingPayoutsList.length;
    const walletEscrowBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
    const platformFloat = walletEscrowBalance - outstandingPayoutLiability;
    const failedPayouts = payouts.filter((p) => p.status === "failed").length;

    // Refund rate (simplified)
    const refundRate = 0; // Would need refunds table

    // Operational Alerts
    const pendingVerifications = verifications.filter((v) => v.status === "pending").length;
    const pendingApprovals = tickets.filter((t) => t.status === "pending_approval").length;
    const waitlistBacklog = waitlist.length;

    // GMV per day chart
    const gmvPerDay: { date: string; current: number; previous: number }[] = [];
    for (let i = 0; i < dateRange; i++) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - (dateRange - 1 - i));
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const prevDayStart = new Date(dayStart);
      if (compareMode === "wow") prevDayStart.setDate(prevDayStart.getDate() - 7);
      else if (compareMode === "mom") prevDayStart.setDate(prevDayStart.getDate() - 30);

      const prevDayEnd = new Date(dayEnd);
      if (compareMode === "wow") prevDayEnd.setDate(prevDayEnd.getDate() - 7);
      else if (compareMode === "mom") prevDayEnd.setDate(prevDayEnd.getDate() - 30);

      const dayGmv = purchases
        .filter((p) => {
          const d = new Date(p.purchased_at || "");
          return d >= dayStart && d <= dayEnd;
        })
        .reduce((sum, p) => sum + p.total_amount, 0);

      const prevDayGmv = previousPurchases
        .filter((p) => {
          const d = new Date(p.purchased_at || "");
          return d >= prevDayStart && d <= prevDayEnd;
        })
        .reduce((sum, p) => sum + p.total_amount, 0);

      gmvPerDay.push({
        date: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        current: dayGmv / 100,
        previous: compareMode !== "none" ? prevDayGmv / 100 : 0,
      });
    }

    // Funnel data
    const totalListings = tickets.length;
    const totalViews = ticketViews.length;
    const totalPurchases = purchases.length;
    const completedSales = soldTickets;

    const funnelData = [
      { stage: "Listings", count: totalListings },
      { stage: "Views", count: totalViews },
      { stage: "Purchases", count: totalPurchases },
      { stage: "Completed", count: completedSales },
    ];

    setData({
      // Left Block - Operational
      pendingVerifications,
      pendingApprovals,
      pendingPayoutsCount,
      supportTickets: 0, // No support tickets table yet

      // Middle Block - Health
      outstandingPayoutLiability,
      conversionRate,
      activeListings,
      avgTimeToSell,

      // Right Block - Growth
      newUsersThisWeek,
      newUsersLastWeek,
      newListingsThisWeek,
      newListingsLastWeek,

      // Other data
      gmv,
      gmvPrevious,
      platformRevenue,
      platformRevenuePrevious,
      activeBuyers,
      activeBuyersPrevious,
      activeSellers,
      activeSellersPrevious,
      conversionRatePrevious,
      sellThroughRate,
      inventoryAging,
      walletEscrowBalance,
      platformFloat,
      refundRate,
      disputeCount: 0,
      failedPayouts,
      failedTransactions: 0,
      waitlistBacklog,
      gmvPerDay,
      funnelData,
    });

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, compareMode]);

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const formatChange = (change: number, isPercentagePoint = false) => {
    const sign = change >= 0 ? "+" : "";
    if (isPercentagePoint) {
      return `${sign}${change.toFixed(1)}pp`;
    }
    return `${sign}${change.toFixed(1)}%`;
  };

  const ChangeIndicator = ({
    current,
    previous,
    isPercentagePoint = false,
  }: {
    current: number;
    previous: number;
    isPercentagePoint?: boolean;
  }) => {
    if (compareMode === "none") return null;

    const change = isPercentagePoint ? current - previous : calcChange(current, previous);
    const isPositive = change >= 0;

    return (
      <div
        className={`flex items-center gap-1 text-xs ${
          isPositive ? "text-green-500" : "text-red-500"
        }`}
      >
        {isPositive ? (
          <ArrowUpRight className="h-3 w-3" />
        ) : (
          <ArrowDownRight className="h-3 w-3" />
        )}
        <span>{formatChange(change, isPercentagePoint)}</span>
      </div>
    );
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Date Range:</Label>
            <Select value={dateRange.toString()} onValueChange={(v) => setDateRange(parseInt(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((r) => (
                  <SelectItem key={r.days} value={r.days.toString()}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Compare:</Label>
            <Select value={compareMode} onValueChange={(v) => setCompareMode(v as any)}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPARE_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Top KPI Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Block - Operational */}
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Operational
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pending Verification</span>
              <span className={`font-bold ${data.pendingVerifications > 0 ? "text-yellow-500" : "text-green-500"}`}>
                {data.pendingVerifications}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pending Listing</span>
              <span className={`font-bold ${data.pendingApprovals > 0 ? "text-orange-500" : "text-green-500"}`}>
                {data.pendingApprovals}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pending Payout Requests</span>
              <span className={`font-bold ${data.pendingPayoutsCount > 0 ? "text-blue-500" : "text-muted-foreground"}`}>
                {data.pendingPayoutsCount}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Support Tickets</span>
              <span className="font-bold text-muted-foreground">{data.supportTickets}</span>
            </div>
          </div>
        </Card>

        {/* Middle Block - Health */}
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Health
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Payout Liability</span>
              <span className="font-bold">${(data.outstandingPayoutLiability / 100).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Conversion</span>
              <span className="font-bold">{data.conversionRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Active Listings</span>
              <span className="font-bold text-green-500">{data.activeListings}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Avg Time to Sell</span>
              <span className="font-bold">{data.avgTimeToSell.toFixed(1)} days</span>
            </div>
          </div>
        </Card>

        {/* Right Block - Growth */}
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Growth
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">New Users (This Week)</span>
              <span className="font-bold text-green-500">{data.newUsersThisWeek}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">New Users (Last Week)</span>
              <span className="font-bold text-muted-foreground">{data.newUsersLastWeek}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">New Listings (This Week)</span>
              <span className="font-bold text-green-500">{data.newListingsThisWeek}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">New Listings (Last Week)</span>
              <span className="font-bold text-muted-foreground">{data.newListingsLastWeek}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 2. Marketplace Liquidity & Health */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Marketplace Liquidity & Health
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Active Listings</span>
                <span className="font-bold text-green-500">{data.activeListings}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Sell-Through Rate</span>
                <span className="font-bold">{data.sellThroughRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Avg Time to Sell</span>
                <span className="font-bold">{data.avgTimeToSell.toFixed(1)} days</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-sm font-medium mb-3">Inventory Aging</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center p-2 bg-green-500/10 rounded">
                <p className="text-lg font-bold text-green-500">{data.inventoryAging["0-3"]}</p>
                <p className="text-xs text-muted-foreground">0-3d</p>
              </div>
              <div className="text-center p-2 bg-yellow-500/10 rounded">
                <p className="text-lg font-bold text-yellow-500">{data.inventoryAging["4-7"]}</p>
                <p className="text-xs text-muted-foreground">4-7d</p>
              </div>
              <div className="text-center p-2 bg-orange-500/10 rounded">
                <p className="text-lg font-bold text-orange-500">{data.inventoryAging["8-14"]}</p>
                <p className="text-xs text-muted-foreground">8-14d</p>
              </div>
              <div className="text-center p-2 bg-red-500/10 rounded">
                <p className="text-lg font-bold text-red-500">{data.inventoryAging["15+"]}</p>
                <p className="text-xs text-muted-foreground">15+d</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 3. Growth Flow Charts */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Growth Flow
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-sm font-medium mb-3">GMV per Day</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.gmvPerDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                  />
                  {compareMode !== "none" && (
                    <Line
                      type="monotone"
                      dataKey="previous"
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="5 5"
                      name="Previous Period"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="hsl(var(--primary))"
                    name="Current Period"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-sm font-medium mb-3">Marketplace Funnel</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="stage" type="category" width={80} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* 4. Financial Risk & Obligations */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Financial Risk & Obligations
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Payout Liability</p>
              <p className="text-lg font-bold">${(data.outstandingPayoutLiability / 100).toLocaleString()}</p>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Pending Payouts</p>
              <p className="text-lg font-bold">{data.pendingPayoutsCount}</p>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Wallet Balance</p>
              <p className="text-lg font-bold">${(data.walletEscrowBalance / 100).toLocaleString()}</p>
            </div>
          </Card>

          <Card className={`p-4 ${data.platformFloat < 0 ? "border-red-500/50 bg-red-500/5" : ""}`}>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Platform Float</p>
              <p className={`text-lg font-bold ${data.platformFloat < 0 ? "text-red-500" : "text-green-500"}`}>
                ${(data.platformFloat / 100).toLocaleString()}
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Refund Rate</p>
              <p className="text-lg font-bold">{data.refundRate.toFixed(1)}%</p>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Disputes</p>
              <p className="text-lg font-bold">{data.disputeCount}</p>
            </div>
          </Card>
        </div>
      </div>

      {/* 5. Operational Alerts */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Operational Alerts
        </h3>
        <div className="flex flex-wrap gap-3">
          {data.pendingVerifications > 0 && (
            <Badge variant="secondary" className="text-sm py-2 px-4 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
              <Clock className="h-4 w-4 mr-2" />
              {data.pendingVerifications} Pending Verifications
            </Badge>
          )}

          {data.pendingApprovals > 0 && (
            <Badge variant="secondary" className="text-sm py-2 px-4 bg-orange-500/10 text-orange-600 border-orange-500/30">
              <Ticket className="h-4 w-4 mr-2" />
              {data.pendingApprovals} Listings Awaiting Approval
            </Badge>
          )}

          {data.failedPayouts > 0 && (
            <Badge variant="destructive" className="text-sm py-2 px-4">
              <AlertTriangle className="h-4 w-4 mr-2" />
              {data.failedPayouts} Failed Payouts
            </Badge>
          )}

          {data.failedTransactions > 0 && (
            <Badge variant="destructive" className="text-sm py-2 px-4">
              <AlertTriangle className="h-4 w-4 mr-2" />
              {data.failedTransactions} Failed Transactions
            </Badge>
          )}

          {data.waitlistBacklog > 0 && (
            <Badge variant="secondary" className="text-sm py-2 px-4 bg-blue-500/10 text-blue-600 border-blue-500/30">
              <Users className="h-4 w-4 mr-2" />
              {data.waitlistBacklog} Waitlist Entries
            </Badge>
          )}

          {data.pendingVerifications === 0 &&
            data.pendingApprovals === 0 &&
            data.failedPayouts === 0 &&
            data.failedTransactions === 0 &&
            data.waitlistBacklog === 0 && (
              <Badge variant="secondary" className="text-sm py-2 px-4 bg-green-500/10 text-green-600 border-green-500/30">
                All Clear - No Pending Items
              </Badge>
            )}
        </div>
      </div>
    </div>
  );
};

export default OverviewPlusTab;
