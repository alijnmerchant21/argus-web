import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { ExpertCard } from "@/components/site/ExpertCard";
import { WaitlistDialog } from "@/components/site/WaitlistDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Argus — Define the line AI cannot cross" },
      {
        name: "description",
        content: "Argus lets domain experts define rules that AI must not cross. Install, define, guard.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <main className="mx-auto mt-6 w-[min(1200px,calc(100%-2rem))] pb-16 sm:mt-10 lg:mt-14">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">

        {/* ── Left: hero copy ── */}
        <section className="flex flex-col justify-center">
          <h1
            className="animate-fade-up animate-bob text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "0ms" }}
          >
            Argus
          </h1>
          <p
            className="animate-fade-up mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ animationDelay: "80ms" }}
          >
            Argus lets you define a line that AI cannot cross.
            Install Argus; Define your rules and let Argus Guard you.
          </p>
          <div
            className="animate-fade-up mt-7 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "160ms" }}
          >
            <Button
              asChild
              size="lg"
              className="learn-more-btn h-12 rounded-full bg-foreground px-6 text-sm font-medium text-background hover:bg-foreground/90"
            >
              <Link to="/how-it-works">
                Learn More <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="waitlist-btn fun-btn h-12 rounded-full border-2 px-6 text-sm font-semibold"
              onClick={() => setWaitlistOpen(true)}
            >
              Join Waitlist <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} />
          <div
            className="animate-fade-up mt-4"
            style={{ animationDelay: "240ms" }}
          >
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="fun-btn inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Play className="h-4 w-4 shrink-0" /> Founder&apos;s note
            </a>
          </div>
        </section>

        {/* ── Right: irregular bento expert grid ── */}
        <section
          className="animate-fade-up"
          style={{ animationDelay: "200ms" }}
        >
          {/*
            6-col grid, 3 row heights.
            Row 1+2: Doctors (col 1-4)  |  Lawyers (col 5-6, row 1) / Policy Makers (col 5-6, row 2)
            Row 3:   Academist (col 1-2) | Researchers (col 3-4) | +more (col 5-6)
          */}
          <div className="grid grid-cols-6 grid-rows-[minmax(120px,auto)_minmax(120px,auto)_minmax(105px,auto)] gap-3">
            <ExpertCard
              label="Doctors"
              symbol="🩺"
              pastel="bg-sky-100"
              className="col-span-4 row-span-2"
              delay={240}
              size="xl"
            />
            <ExpertCard
              label="Lawyers"
              symbol="⚖️"
              pastel="bg-violet-100"
              className="col-span-2 row-span-1"
              delay={300}
              size="md"
            />
            <ExpertCard
              label="Policy Makers"
              symbol="🏛️"
              pastel="bg-amber-100"
              className="col-span-2 row-span-1"
              delay={360}
              size="md"
            />
            <ExpertCard
              label="Academist"
              symbol="🎓"
              pastel="bg-rose-100"
              className="col-span-2 row-span-1"
              delay={420}
              size="sm"
            />
            <ExpertCard
              label="Researchers"
              symbol="🔬"
              pastel="bg-emerald-100"
              className="col-span-2 row-span-1"
              delay={480}
              size="sm"
            />
            <ExpertCard
              label="+more"
              symbol="✨"
              pastel="bg-zinc-100"
              className="col-span-2 row-span-1"
              delay={540}
              size="sm"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
