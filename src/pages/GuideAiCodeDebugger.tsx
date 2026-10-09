import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bug, Sun, Moon, ArrowRight } from "lucide-react";

const comparisonPoints = [
  {
    title: "They don't show you the input",
    description:
      "A human review can say \"your logic is off somewhere\" without ever producing the exact test case that breaks your code. Differential debugging always produces a concrete failing input.",
  },
  {
    title: "They can't see your hidden test",
    description:
      "On Codeforces and similar judges, the failing test is hidden. No generic AI assistant can query the judge — but a differential debugger can reconstruct an equivalent failing case from your code and a reference solution.",
  },
  {
    title: "They guess instead of executing",
    description:
      "Most AI coding assistants reason about your code in text. DebugCP actually executes generated test cases against both programs and compares real outputs, so the failing case is verified, not guessed.",
  },
];

const bugTypes = [
  {
    title: "Wrong-answer edge cases",
    description:
      "Off-by-one errors, empty or single-element inputs, duplicate values, maximum constraints, and overflow — the cases that pass the samples and fail the hidden tests.",
  },
  {
    title: "Runtime crashes",
    description:
      "Segmentation faults, out-of-bounds indexing, and uncaught exceptions, detected during execution before outputs are compared.",
  },
  {
    title: "Time-limit problems",
    description:
      "Solutions that are correct on small inputs but too slow at full constraints are surfaced before you burn another submission.",
  },
  {
    title: "Compile errors",
    description:
      "Syntax and compilation mistakes are caught immediately, with the compiler's message pointing at the offending line.",
  },
];

const faqs = [
  {
    q: "Do I need a correct solution to use it?",
    a: "Yes. DebugCP's differential debugging compares your buggy code against a reference solution — usually an accepted solution or a brute-force version of your own idea. That reference is what makes the failing input findable.",
  },
  {
    q: "Which languages are supported?",
    a: "C++, C, Python, Java, and JavaScript. The language is detected automatically, and class-based solutions (like LeetCode-style classes) are wrapped so they run correctly.",
  },
  {
    q: "How much does it cost?",
    a: "There is a free plan with 5 failing-test searches and 20 single-test executions per month. Plus (₹299/month) raises that to 20 searches and 100 single tests, and Pro (₹799/month) gives 100 searches with unlimited single tests.",
  },
  {
    q: "What if no failing test is found?",
    a: "The AI tries several increasingly adversarial test batches. If no case separates your code from the reference, the diagnosis says so — that usually means the two programs agree on tested inputs and the issue is elsewhere.",
  },
];

export default function GuideAiCodeDebugger() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem("theme") !== "light"
  );

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };

  return (
    <div
      className={`${isDark ? "dark" : ""} min-h-screen bg-background text-foreground`}
    >
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          })}
        </script>
      </Helmet>
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back to home" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Bug className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">DebugCP</span>
          </div>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              className="h-8 w-8"
              onClick={toggleTheme}
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-12">
        {/* Hero */}
        <section className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Guide
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            AI Code Debugger: How Differential Debugging Finds the Exact Failing
            Test Case
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            You've written a solution, it passes every sample, and the judge
            still says Wrong Answer — with the failing test hidden. This guide
            explains how an AI code debugger built on differential debugging
            finds that failing input for you, and how DebugCP applies the
            technique to competitive programming.
          </p>
        </section>

        {/* What is an AI code debugger */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">
            What is an AI code debugger?
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            An AI code debugger is a tool that uses AI models to locate the
            cause of a bug in your program, not just to autocomplete code. In
            competitive programming, the frustrating bugs are rarely syntax
            errors — they are logical mistakes that only appear on specific
            inputs: an edge case, a large constraint, an unexpected ordering.
            A good AI debugger answers two questions with evidence:
          </p>
          <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc pl-6">
            <li>
              <strong className="text-foreground">Which input breaks my code?</strong>{" "}
              A concrete test case you can run yourself, not a vague hint.
            </li>
            <li>
              <strong className="text-foreground">Which line is wrong, and what should it be?</strong>{" "}
              A specific diagnosis with a precise fix, not generic advice.
            </li>
          </ul>
        </section>

        {/* Differential debugging */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">
            Differential debugging: the technique behind it
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            DebugCP is built on differential debugging — a classic testing
            technique made practical by AI. The idea is simple: if you have a
            program that works (an accepted solution, or a slow-but-correct
            brute force), you can find the bug by comparing the two programs on
            many inputs and zooming in on the first one where they disagree.
          </p>
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              The pipeline
            </h3>
            <ol className="space-y-3">
              {[
                {
                  title: "Paste both programs",
                  body: "Your buggy solution and a correct reference solution, in any of the supported languages.",
                },
                {
                  title: "AI reads the problem from your code",
                  body: "It parses constraints and input format, detects the language, and checks for syntax or compile errors first.",
                },
                {
                  title: "Adversarial test cases are generated",
                  body: "AI-generated tests are produced across categories — edge cases, duplicates, extreme values, maximum sizes — and executed against both programs.",
                },
                {
                  title: "The first mismatch is your bug",
                  body: "When the outputs differ, that input is the failing test case. It's shown side by side with both outputs, so you can reproduce it instantly.",
                },
                {
                  title: "AI pinpoints the diagnosis",
                  body: "With the failing input and both outputs in hand, the AI explains the root cause with specific line references and a concrete fix — maximum five issues, no filler.",
                },
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed">
                    <strong className="text-foreground font-semibold">
                      {step.title}.
                    </strong>{" "}
                    <span className="text-muted-foreground">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Why this beats asking an AI chatbot to read your code: the failing
            test case is verified by actually running it. If both programs
            disagree on it, it's real. If a generated test doesn't separate the
            two programs, the pipeline tries a harder batch — up to three
            increasingly adversarial rounds.
          </p>
        </section>

        {/* Why generic assistants fall short */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">
            Why generic AI assistants fall short for competitive programming
          </h2>
          <div className="grid gap-4">
            {comparisonPoints.map((point, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-5 space-y-2"
              >
                <h3 className="text-sm font-bold text-foreground">
                  {point.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* What it catches */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">
            What an AI code debugger catches
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bugTypes.map((type, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-5 space-y-2"
              >
                <h3 className="text-sm font-bold text-foreground">
                  {type.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {type.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How to use */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">
            How to debug a Wrong Answer with DebugCP
          </h2>
          <ol className="space-y-3 text-muted-foreground leading-relaxed list-decimal pl-6">
            <li>
              Create a free account — no card needed for the free plan.
            </li>
            <li>
              Paste your buggy solution and a correct reference solution.
            </li>
            <li>
              Start the search. The AI generates and runs adversarial test
              batches until one input makes the two programs disagree.
            </li>
            <li>
              Read the failing input and the side-by-side outputs, then apply
              the AI's line-specific diagnosis.
            </li>
            <li>
              If you already suspect an input, use a single-test run to compare
              both programs on it directly.
            </li>
          </ol>
          <p className="text-muted-foreground leading-relaxed">
            Every debugging session — test cases, outputs, and the diagnosis —
            is saved to your run history for 90 days, so you can revisit how a
            bug was found.
          </p>
        </section>

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
                <h3 className="text-sm font-bold text-foreground">{faq.q}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-xl border border-border bg-card p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl font-bold">
            Have a Wrong Answer with a hidden test?
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Paste both codes and let the differential debugger find the exact
            input that breaks your solution — free plan included.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => navigate("/signup")} className="gap-2">
              Start Debugging Free <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate("/login")}>
              Log In
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
