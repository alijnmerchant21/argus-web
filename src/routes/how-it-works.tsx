import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Radio, ScrollText, MessageCircleQuestion, ArrowRight } from "lucide-react";
import { StepCard } from "@/components/site/StepCard";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it Works — Argus" },
      { name: "description", content: "Argus has three parts: Capture, Rule Engine, and Interrogation UI." },
      { property: "og:title", content: "How it Works — Argus" },
      {
        property: "og:description",
        content: "Capture, Rule Engine, Interrogation UI — how Argus keeps AI inside the line.",
      },
    ],
  }),
  component: HowItWorks,
});

const steps = [
  {
    number: "01",
    title: "Capture",
    description:
      "A lightweight daemon that intercepts your AI. Plus a browser extension for experts who don't control AI on the local machine.",
    Icon: Radio,
    tone: "sky" as const,
  },
  {
    number: "02",
    title: "Rule Engine",
    description: "Domain experts define rules. Argus enforces these rules and flags it when it's broken.",
    Icon: ScrollText,
    tone: "rose" as const,
  },
  {
    number: "03",
    title: "Interrogation UI",
    description: "A web interface where you can see AI decisions, and ask follow-up questions on what happened.",
    Icon: MessageCircleQuestion,
    tone: "mint" as const,
  },
];

function HowItWorks() {
  return (
    <main className="relative mx-auto mt-8 w-[min(1100px,calc(100%-2rem))] pb-24 sm:mt-12">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute -left-40 top-8 -z-10 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl hiw-aurora" />
      <div className="pointer-events-none absolute -right-32 top-48 -z-10 h-72 w-72 rounded-full bg-violet-200/30 blur-3xl hiw-aurora-delayed" />
      <div className="pointer-events-none absolute bottom-32 left-1/3 -z-10 h-64 w-64 rounded-full bg-emerald-200/25 blur-3xl hiw-aurora" style={{ animationDelay: "-4s" }} />

      <header className="max-w-2xl" style={{ animationDelay: "0ms" }}>
        <p className="animate-fade-up text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          How it works
        </p>
        <h1 className="animate-fade-up animate-bob mt-3 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl" style={{ animationDelay: "60ms" }}>
          Three steps.
          <br />
          <span className="text-slate-400">One safer path.</span>
        </h1>
        <p className="animate-fade-up mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg" style={{ animationDelay: "120ms" }}>
          Argus sits between experts and AI — capturing traffic, applying rules, and explaining every decision that was flagged.
        </p>
      </header>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <StepCard key={s.number} {...s} delay={180 + i * 120} />
        ))}
      </div>

      <section
        className="animate-fade-up mt-16 rounded-3xl border border-border/70 bg-secondary/50 p-10 text-center sm:p-14"
        style={{ animationDelay: "540ms" }}
      >
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to draw the line?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Open the dashboard and start defining rules your team can trust.
        </p>
        <div className="mt-7">
          <Button
            asChild
            size="lg"
            className="hiw-cta-pulse h-12 rounded-full bg-foreground px-6 text-sm font-medium text-background hover:bg-foreground/90"
          >
            <Link to="/dashboard">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
