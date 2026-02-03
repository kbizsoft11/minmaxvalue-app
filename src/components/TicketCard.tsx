import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Calendar, MapPin, DollarSign, Users, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import CountdownTimer from "./CountdownTimer";

interface TicketCardProps {
  id: string;
  tournament: string;
  venue: string;
  date: string;
  buyIn: number;
  moneyGuarantee?: number;
  seller: string;
  price: number;
  status?: string;
  updatedAt?: string;
}

const TicketCard = ({ id, tournament, venue, date, buyIn, moneyGuarantee, seller, price, status, updatedAt }: TicketCardProps) => {
  const discountPercentage = Math.round(((buyIn - price) / buyIn) * 100);
  const hasDiscount = price < buyIn;
  const isReserved = status === "pending";
  
  // Calculate 24h expiry from when ticket became pending
  const getExpiryDate = () => {
    if (!updatedAt) return null;
    const updated = new Date(updatedAt);
    return new Date(updated.getTime() + 24 * 60 * 60 * 1000);
  };
  
  const expiryDate = isReserved ? getExpiryDate() : null;
  
  return (
    <Card className={`group overflow-hidden border-2 transition-all duration-300 bg-card/50 backdrop-blur ${
      isReserved 
        ? 'opacity-60 border-border' 
        : 'border-border hover:border-primary/50'
    }`}>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className={`text-xl font-bold transition-colors ${
              isReserved 
                ? 'text-muted-foreground' 
                : 'text-foreground group-hover:text-primary'
            }`}>
              {tournament}
            </h3>
            {isReserved && (
              <div className="flex flex-col items-end gap-1">
                <div className="px-3 py-1 bg-muted text-muted-foreground text-xs font-semibold rounded-full">
                  Reserved
                </div>
                {expiryDate && (
                  <CountdownTimer expiresAt={expiryDate} className="text-xs" />
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{venue}</span>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 py-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-foreground">{date}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-foreground">Buy-in: ${buyIn}</span>
          </div>
          {moneyGuarantee && (
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-foreground">Guarantee: ${moneyGuarantee.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-foreground">Seller: {seller}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <div className="text-lg text-muted-foreground line-through">
              ${buyIn.toLocaleString()}
            </div>
            <div className="text-2xl font-bold text-primary">
              ${price.toLocaleString()}
            </div>
            {hasDiscount && discountPercentage > 0 && (
              <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                -{discountPercentage}%
              </div>
            )}
          </div>
          {isReserved ? (
            <Button size="sm" disabled variant="secondary">
              Not Available
            </Button>
          ) : (
            <Link to={`/ticket/${id}`}>
              <Button size="sm">View Details</Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
};

export default TicketCard;
