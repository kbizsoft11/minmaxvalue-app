import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Search, Ticket, ShieldCheck, Wallet, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Browse Available Tickets",
    description: "Search through verified tournament entries listed by other players. Filter by venue, date, buy-in, and more to find exactly what you're looking for.",
  },
  {
    icon: Ticket,
    title: "Purchase Securely",
    description: "Found the perfect ticket? Complete your purchase through our secure checkout. Provide your details for the casino transfer process.",
  },
  {
    icon: ShieldCheck,
    title: "Casino Verification",
    description: "Our partnered casinos verify and facilitate the ticket transfer. This ensures legitimacy and protects both buyers and sellers.",
  },
  {
    icon: Wallet,
    title: "Transfer Complete",
    description: "Once the casino approves, the ticket is transferred to the buyer's name and the seller receives their funds directly to their MinMaxValue wallet, ready for withdrawal.",
  },
];

const HowItWorks = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                How It Works
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              MinMaxValue makes buying and selling poker tournament tickets simple, secure, and transparent.
            </p>
          </div>

          <div className="space-y-8 mb-16">
            {steps.map((step, index) => (
              <Card key={index} className="p-6 flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-primary">Step {index + 1}</span>
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/browse">
                <Button size="lg">
                  Browse Tickets
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/list-ticket">
                <Button size="lg" variant="outline">
                  Sell Your Ticket
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HowItWorks;
