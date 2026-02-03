import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortIdProps {
  id: string;
  prefix?: string;
  className?: string;
}

const ShortId = ({ id, prefix = "", className }: ShortIdProps) => {
  const [copied, setCopied] = useState(false);
  
  const shortId = id.substring(0, 8);
  const displayId = prefix ? `${prefix}${shortId}` : shortId;
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors cursor-pointer group",
        className
      )}
      title={`Click to copy: ${id}`}
    >
      <span className="text-muted-foreground">{displayId}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
};

export default ShortId;
