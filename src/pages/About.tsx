import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Users, Zap } from "lucide-react";

const values = [
  {
    icon: ShieldCheck,
    title: "Trust & Security",
    description: "Every transaction is verified through our partnered casinos. We never cut corners on security.",
  },
  {
    icon: Users,
    title: "Community First",
    description: "Built by poker players, for poker players. We understand the tournament grind.",
  },
  {
    icon: Zap,
    title: "Efficiency",
    description: "Quick transfers, transparent fees, and a streamlined process that respects your time.",
  },
];

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                About MinMaxValue
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The trusted marketplace for poker tournament ticket transfers.
            </p>
          </div>

          <div className="prose prose-lg dark:prose-invert max-w-none mb-16">
            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                MinMaxValue exists to solve a simple problem: what happens when you can't make a tournament you've already registered for? Before us, players had limited options - forfeit their buy-in, or navigate risky informal transfers.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We built a secure, transparent marketplace that benefits everyone. Sellers recover value from entries they can't use. Buyers find opportunities at competitive prices. Casinos get verified transfers that protect the integrity of their events.
              </p>
            </Card>

            <Card className="p-8">
              <h2 className="text-2xl font-bold mb-4">How We're Different</h2>
              <p className="text-muted-foreground leading-relaxed">
                Unlike informal transfer arrangements, every MinMaxValue transaction goes through official casino verification. This protects buyers from fraud, gives sellers payment security, and ensures casinos maintain accurate player records.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We work directly with casino partners to facilitate transfers. When a sale is completed, the casino updates their records and both parties are protected. It's the way tournament transfers should work.
              </p>
            </Card>
          </div>

          <h2 className="text-2xl font-bold text-center mb-8">Our Values</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {values.map((value, index) => (
              <Card key={index} className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <value.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
