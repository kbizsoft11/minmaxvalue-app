import { useState, useEffect } from "react";
import { Calendar, MapPin, DollarSign, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

interface BrowseFiltersProps {
  onFilterChange: (filters: {
    dateRange?: DateRange;
    location?: string;
    priceRange: [number, number];
  }) => void;
  minPrice: number;
  maxPrice: number;
}

const BrowseFilters = ({ onFilterChange, minPrice, maxPrice }: BrowseFiltersProps) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [location, setLocation] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([minPrice, maxPrice]);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

  // Update price range when min/max prices change
  useEffect(() => {
    setPriceRange([minPrice, maxPrice]);
  }, [minPrice, maxPrice]);

  const handleFilterChange = (
    newDateRange?: DateRange,
    newLocation?: string,
    newPriceRange?: [number, number]
  ) => {
    onFilterChange({
      dateRange: newDateRange ?? dateRange,
      location: newLocation ?? location,
      priceRange: newPriceRange ?? priceRange,
    });
  };

  const clearDateRange = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDateRange(undefined);
    setIsDatePopoverOpen(false);
    handleFilterChange(undefined, undefined, undefined);
  };

  return (
    <div className="flex flex-col md:flex-row gap-3 p-4 bg-card rounded-2xl shadow-lg border border-border/50 mb-8">
      {/* Date Filter */}
      <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
        <div className="flex-1 relative">
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-14 rounded-xl",
                !dateRange?.from && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              <div className="flex flex-col flex-1">
                <span className="text-xs font-medium text-muted-foreground">When</span>
                <span className="text-sm">
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd")
                    )
                  ) : (
                    "Add dates"
                  )}
                </span>
              </div>
            </Button>
          </PopoverTrigger>
          {dateRange?.from && (
            <button
              onClick={clearDateRange}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-1 hover:bg-destructive/10 rounded-full transition-colors"
              aria-label="Clear dates"
            >
              <X className="h-4 w-4 hover:text-destructive transition-colors" />
            </button>
          )}
        </div>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col">
            <CalendarComponent
              mode="range"
              selected={dateRange}
              onSelect={(newDateRange) => {
                setDateRange(newDateRange);
                handleFilterChange(newDateRange, undefined, undefined);
              }}
              initialFocus
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
            {dateRange?.from && (
              <div className="p-3 border-t border-border flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={clearDateRange}
                >
                  Clear dates
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Location Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "flex-1 justify-start text-left font-normal h-14 rounded-xl",
              !location && "text-muted-foreground"
            )}
          >
            <MapPin className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground">Where</span>
              <span className="text-sm">
                {location || "Add location"}
              </span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Search by location</label>
              <Input
                placeholder="Las Vegas, Barcelona, etc."
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  handleFilterChange(undefined, e.target.value, undefined);
                }}
                className="mt-2"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Price Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="flex-1 justify-start text-left font-normal h-14 rounded-xl"
          >
            <DollarSign className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground">Price</span>
              <span className="text-sm">
                ${priceRange[0].toLocaleString()} - ${priceRange[1].toLocaleString()}
              </span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Price range</label>
              <div className="mt-4 px-2">
                <Slider
                  min={minPrice}
                  max={maxPrice}
                  step={100}
                  value={priceRange}
                  onValueChange={(value) => {
                    const newRange: [number, number] = [value[0], value[1]];
                    setPriceRange(newRange);
                    handleFilterChange(undefined, undefined, newRange);
                  }}
                  className="w-full"
                />
              </div>
              <div className="flex justify-between mt-4 text-sm text-muted-foreground">
                <span>${priceRange[0].toLocaleString()}</span>
                <span>${priceRange[1].toLocaleString()}</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default BrowseFilters;
