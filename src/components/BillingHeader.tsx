import { ArrowLeft, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function BillingHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="Back to Debug" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Bug className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
      </div>
    </header>
  );
}