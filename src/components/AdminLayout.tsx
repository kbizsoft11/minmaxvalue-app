import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { BarChart3, DollarSign, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { label: "Operator", href: "/admin", icon: Settings },
  { label: "Investor", href: "/admin/investor", icon: BarChart3 },
  { label: "Payouts", href: "/admin/payouts", icon: DollarSign },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className="w-48 min-h-[calc(100vh-4rem)] border-r border-border bg-card/50">
          <nav className="p-4 space-y-2 sticky top-16 left-0 w-full">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-3">
              Dashboards
            </p>
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
