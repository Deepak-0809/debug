import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const LAST_UPDATED = "5 October 2026";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export default function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  // On a fresh load (new tab or direct URL) there is no history to go back to,
  // so the button takes the user to the app's start page instead.
  const hasHistory = useLocation().key !== "default";
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (hasHistory ? navigate(-1) : navigate("/"))}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <header className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </header>
        {children}
        <footer className="border-t border-border pt-4 text-xs text-muted-foreground flex gap-4">
          <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
          <Link to="/terms" className="hover:underline">Terms of Service</Link>
          <Link to="/about" className="hover:underline">About</Link>
        </footer>
      </div>
    </div>
  );
}
