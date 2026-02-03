import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface DobSelectProps {
  day: string;
  month: string;
  year: string;
  onDayChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}

const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const months = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));

export const DobSelect = ({
  day,
  month,
  year,
  onDayChange,
  onMonthChange,
  onYearChange,
  disabled = false,
  required = false,
}: DobSelectProps) => {
  return (
    <div className="space-y-2">
      <Label>Date of Birth {required && "*"}</Label>
      <div className="grid grid-cols-3 gap-2">
        <Select value={day} onValueChange={onDayChange} disabled={disabled}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border z-50 max-h-[200px]">
            {days.map((d) => (
              <SelectItem key={d} value={d} className="cursor-pointer">
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={month} onValueChange={onMonthChange} disabled={disabled}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border z-50 max-h-[200px]">
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value} className="cursor-pointer">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={year} onValueChange={onYearChange} disabled={disabled}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border z-50 max-h-[200px]">
            {years.map((y) => (
              <SelectItem key={y} value={y} className="cursor-pointer">
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default DobSelect;
