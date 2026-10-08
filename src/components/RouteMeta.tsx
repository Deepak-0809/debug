import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const BASE_URL = "https://debugforcompetitiveprogramming.lovable.app";

const META: Record<string, { title: string; description: string }> = {
  "/": { title: "DebugCP – AI Competitive Programming Debugger", description: "Paste buggy code and a correct solution to automatically find failing test cases and get a precise AI bug diagnosis." },
  "/login": { title: "Log In – DebugCP", description: "Sign in to DebugCP to find failing test cases and diagnose bugs in your competitive programming solutions." },
  "/signup": { title: "Sign Up – DebugCP", description: "Create a free DebugCP account and start finding failing test cases in your competitive programming code." },
  "/forgot-password": { title: "Forgot Password – DebugCP", description: "Reset your DebugCP account password." },
  "/reset-password": { title: "Set New Password – DebugCP", description: "Choose a new password for your DebugCP account." },
  "/about": { title: "About DebugCP – AI Code Debugger for Competitive Programming", description: "Learn how DebugCP's AI differential debugging compares buggy and correct code to uncover edge-case failures." },
  "/history": { title: "Run History – DebugCP", description: "Review your past DebugCP debugging runs, failing test cases, and diagnoses." },
  "/pricing": { title: "Pricing – DebugCP", description: "Compare DebugCP Free, Plus, and Pro plans for AI-powered competitive programming debugging." },
  "/billing": { title: "Billing – DebugCP", description: "Manage your DebugCP plan, usage, and payment history." },
  "/privacy": { title: "Privacy Policy – DebugCP", description: "How DebugCP collects, uses, and protects your data." },
  "/terms": { title: "Terms of Service – DebugCP", description: "The terms that govern your use of DebugCP." },
};

export default function RouteMeta() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, "") || "/";
  const meta = META[path] ?? (path.startsWith("/history/")
    ? { title: "Run Detail – DebugCP", description: "Details of a DebugCP debugging run." }
    : { title: "Page Not Found – DebugCP", description: "This page does not exist on DebugCP." });
  const url = `${BASE_URL}${path === "/" ? "/" : path}`;
  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
    </Helmet>
  );
}
