import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Browse from "./pages/Browse";
import ListTicket from "./pages/ListTicket";
import MyListings from "./pages/MyListings";
import Auth from "./pages/Auth";
import TicketDetail from "./pages/TicketDetail";
import Checkout from "./pages/Checkout";
import Watchlist from "./pages/Watchlist";
import AdminDashboard from "./pages/AdminDashboard";
import InvestorDashboard from "./pages/InvestorDashboard";
import SellerDashboard from "./pages/SellerDashboard";
import TicketHistory from "./pages/TicketHistory";
import OrderDetail from "./pages/OrderDetail";
import MyAccount from "./pages/MyAccount";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import CasinoDashboard from "./pages/CasinoDashboard";
import HowItWorks from "./pages/HowItWorks";
import UseCases from "./pages/UseCases";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "@/stripe";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import AdminRoute from "./components/AdminRoute";
import AdminPayouts from "./pages/AdminPayouts";

const queryClient = new QueryClient();

// Toggle this to show/hide the coming soon page
// Set to true to show coming soon page, false to show full app
const SHOW_COMING_SOON = true;

const App = () => {
  // If in coming soon mode, show only the coming soon page
  if (SHOW_COMING_SOON) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ComingSoon />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Otherwise show the full app
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/list-ticket" element={<ListTicket />} />
              <Route path="/my-listings" element={<MyListings />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/ticket/:id" element={<TicketDetail />} />
              <Route path="/checkout/:ticketId" element={
                <Elements stripe={stripePromise}>
                  <Checkout />
                </Elements>
              } />
              <Route path="/checkout/success" element={<CheckoutSuccess />} />
              <Route path="/admin" element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } />
              <Route path="/admin/investor" element={
                <AdminRoute>
                  <InvestorDashboard />
                </AdminRoute>
              } />
              <Route path="/admin/payouts" element={
                <AdminRoute>
                  <AdminPayouts />
                </AdminRoute>
              } />
              <Route path="/casino" element={
                <AdminRoute>
                  <CasinoDashboard />
                </AdminRoute>
              } />
              <Route path="/seller-dashboard" element={<SellerDashboard />} />
              <Route path="/ticket-history" element={<TicketHistory />} />
              <Route path="/order/:purchaseId" element={<OrderDetail />} />
              <Route path="/account" element={<MyAccount />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/use-cases" element={<UseCases />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
