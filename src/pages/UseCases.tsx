import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Calendar, DollarSign, Users, Clock, ArrowRight } from "lucide-react";

const useCases = [
  {
    icon: Calendar,
    title: "Schedule Conflicts",
    description: "Life happens. When you can't make a tournament you've already won a ticket for, sell your seat to another player instead of losing your buy-in entirely.",
    example: "You won a $5,000 tournament seat but a work emergency came up. Sell your seat at a slight discount and recover most of your investment.",
  },
  {
    icon: DollarSign,
    title: "Discounted Entry",
    description: "Looking for value? Find tournament entries below the original buy-in price. Other players' schedule changes become your opportunity.",
    example: "Find a $10,000 buy-in seat listed for $9,000 - instant 10% savings on your tournament entry.",
  },
];

const UseCases = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Use Cases
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover how players use MinMaxValue to optimize their tournament experience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {useCases.map((useCase, index) => (
              <Card key={index} className="p-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <useCase.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{useCase.title}</h3>
                <p className="text-muted-foreground mb-4">{useCase.description}</p>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm italic text-muted-foreground">{useCase.example}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Join the Marketplace</h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/browse">
                <Button size="lg">
                  Browse Tickets
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline">
                  Create Account
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

export default UseCases;
