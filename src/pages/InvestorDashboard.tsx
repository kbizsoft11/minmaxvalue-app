import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, DollarSign, Percent, ArrowUpRight, ArrowDownRight } from "lucide-react";
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
} from "recharts";

interface RevenueData {
  month: string;
  revenue: number;
  platformProfit: number;
  venueProfit: number;
}

interface GrowthMetrics {
  totalRevenue: number;
  totalPlatformProfit: number;
  totalVenueProfit: number;
  totalGMV: number;
  avgTicketPrice: number;
  conversionRate: number;
  momGrowth: number;
  totalTicketsSold: number;
}

const InvestorDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [metrics, setMetrics] = useState<GrowthMetrics>({
    totalRevenue: 0,
    totalPlatformProfit: 0,
    totalVenueProfit: 0,
    totalGMV: 0,
    avgTicketPrice: 0,
    conversionRate: 0,
    momGrowth: 0,
    totalTicketsSold: 0,
  });


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

    fetchInvestorData();
  };

  useEffect(() => {
    fetchInvestorData();
  }, [])

  const fetchInvestorData = async () => {
    setLoading(true);

    // Fetch purchases with dates for monthly breakdown
    const { data: purchases } = await supabase
      .from("purchases")
      .select("ticket_price, service_fee, total_amount, purchased_at");

    // Fetch platform earnings
    const { data: platformEarnings } = await supabase
      .from("platform_earnings")
      .select("amount, created_at");

    // Fetch venue earnings
    const { data: venueEarnings } = await supabase
      .from("organization_earnings")
      .select("amount, created_at");

    // Fetch tickets for conversion rate
    const { data: tickets } = await supabase
      .from("tickets")
      .select("status, asking_price");

    // Calculate monthly revenue data
    const monthlyData = new Map<string, { revenue: number; platformProfit: number; venueProfit: number }>();

    (purchases || []).forEach((p: any) => {
      const date = new Date(p.purchased_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { revenue: 0, platformProfit: 0, venueProfit: 0 });
      }
      const data = monthlyData.get(monthKey)!;
      data.revenue += p.total_amount;
    });

    (platformEarnings || []).forEach((e: any) => {
      const date = new Date(e.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { revenue: 0, platformProfit: 0, venueProfit: 0 });
      }
      monthlyData.get(monthKey)!.platformProfit += e.amount;
    });

    (venueEarnings || []).forEach((e: any) => {
      const date = new Date(e.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { revenue: 0, platformProfit: 0, venueProfit: 0 });
      }
      monthlyData.get(monthKey)!.venueProfit += e.amount;
    });

    // Sort and format for chart
    const sortedMonths = Array.from(monthlyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: formatMonth(month),
        revenue: data.revenue / 100,
        platformProfit: data.platformProfit / 100,
        venueProfit: data.venueProfit / 100,
      }));

    setRevenueData(sortedMonths);

    // Calculate aggregate metrics
    const totalRevenue = (purchases || []).reduce((sum, p: any) => sum + p.total_amount, 0);
    const totalPlatformProfit = (platformEarnings || []).reduce((sum, e: any) => sum + e.amount, 0);
    const totalVenueProfit = (venueEarnings || []).reduce((sum, e: any) => sum + e.amount, 0);
    const totalGMV = (purchases || []).reduce((sum, p: any) => sum + p.ticket_price, 0);

    const soldTickets = (tickets || []).filter((t: any) => t.status === "sold");
    const totalTickets = (tickets || []).length;
    const avgTicketPrice = soldTickets.length > 0
      ? soldTickets.reduce((sum: number, t: any) => sum + t.asking_price, 0) / soldTickets.length
      : 0;

    const conversionRate = totalTickets > 0 ? (soldTickets.length / totalTickets) * 100 : 0;

    // Calculate MoM growth
    let momGrowth = 0;
    if (sortedMonths.length >= 2) {
      const currentMonth = sortedMonths[sortedMonths.length - 1].revenue;
      const previousMonth = sortedMonths[sortedMonths.length - 2].revenue;
      if (previousMonth > 0) {
        momGrowth = ((currentMonth - previousMonth) / previousMonth) * 100;
      }
    }

    setMetrics({
      totalRevenue,
      totalPlatformProfit,
      totalVenueProfit,
      totalGMV,
      avgTicketPrice,
      conversionRate,
      momGrowth,
      totalTicketsSold: soldTickets.length,
    });

    setLoading(false);
  };

  const formatMonth = (monthKey: string): string => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Investor Dashboard</h1>
          <p className="text-muted-foreground">High-level revenue and growth metrics</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">All-time gross revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Platform Profit
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalPlatformProfit)}</div>
              <p className="text-xs text-muted-foreground">Service fee earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                MoM Growth
              </CardTitle>
              {metrics.momGrowth >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.momGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {metrics.momGrowth >= 0 ? '+' : ''}{metrics.momGrowth.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Revenue month-over-month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conversion Rate
              </CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">{metrics.totalTicketsSold} tickets sold</p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gross Merchandise Value (GMV)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(metrics.totalGMV)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Ticket Price
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(metrics.avgTicketPrice)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Venue Partner Earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(metrics.totalVenueProfit)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="month"
                      className="text-xs fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      className="text-xs fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="Revenue"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="platformProfit"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      name="Platform Profit"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                No revenue data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profit Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Profit Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="month"
                      className="text-xs fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      className="text-xs fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    />
                    <Bar dataKey="platformProfit" fill="hsl(var(--primary))" name="Platform Profit" />
                    <Bar dataKey="venueProfit" fill="hsl(var(--chart-3))" name="Venue Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No profit data available yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default InvestorDashboard;
