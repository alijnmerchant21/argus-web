import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, LineChart, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessionFn } from "@/lib/auth";

export const Route = createFileRoute("/report/$ruleId")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  head: ({ params }) => ({
    meta: [
      { title: `Report — ${params.ruleId.slice(0, 8)}… — Argus` },
      { name: "description", content: "Rule enforcement report (placeholder)." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { ruleId } = Route.useParams();

  return (
    <main className="mx-auto w-[min(900px,calc(100%-2rem))] pb-20 pt-8">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-2 rounded-full">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </Button>
      </div>

      <header className="animate-fade-up">
        <p className="text-sm font-medium text-muted-foreground">Rule report</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Placeholder insights</h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">Rule ID: {ruleId}</p>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          This page is a shell for charts, incident timelines, and export actions. Wire it to your analytics backend when
          ready.
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-up">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
            <Shield className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">Violations (7d)</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">—</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">Intercepts</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">—</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-up" style={{ animationDelay: "160ms" }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
            <LineChart className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">Trend</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">—</p>
        </div>
      </div>

      <div
        className="mt-8 rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center text-muted-foreground animate-fade-up"
        style={{ animationDelay: "200ms" }}
      >
        <p className="text-sm font-medium">Chart area placeholder</p>
        <p className="mt-2 text-sm">Drop in Recharts, your data grid, or a PDF export CTA.</p>
      </div>
    </main>
  );
}
