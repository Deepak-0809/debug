import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleTextProps {
  text: string;
  maxLines?: number;
  maxChars?: number;
  className?: string;
}

export default function CollapsibleText({
  text,
  maxLines = 5,
  maxChars = 300,
  className = "",
}: CollapsibleTextProps) {
  const [expanded, setExpanded] = useState(false);

  const lines = text.split("\n");
  const isLong = lines.length > maxLines || text.length > maxChars;

  if (!isLong) {
    return (
      <pre className={`whitespace-pre-wrap break-all ${className}`}>{text}</pre>
    );
  }

  const truncated = lines.slice(0, maxLines).join("\n").slice(0, maxChars);

  return (
    <div>
      <pre className={`whitespace-pre-wrap break-all ${className}`}>
        {expanded ? text : truncated + (text.length > truncated.length ? "…" : "")}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 mt-1 text-[10px] text-muted-foreground hover:text-foreground gap-1"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3 w-3" /> Show less
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" /> Show more ({lines.length} lines)
          </>
        )}
      </Button>
    </div>
  );
}
