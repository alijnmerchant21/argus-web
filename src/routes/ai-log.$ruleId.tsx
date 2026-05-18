import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, Bot, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSessionFn } from "@/lib/auth";
import { getAIInteractionsFn, getReportLogsFn } from "@/lib/api-key";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-log/$ruleId")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async ({ params }) => ({
    report: await getReportLogsFn({ data: { ruleId: params.ruleId, limit: 1 } }),
    interactions: await getAIInteractionsFn({ data: { limit: 500 } }),
  }),
  head: () => ({
    meta: [{ title: "Full AI Log — Argus" }],
  }),
  component: FullLogPage,
});

function formatTime(ts: number | string): string {
  const n = Number(ts);
  if (!Number.isFinite(n)) return "";
  return new Date(n).toLocaleString();
}

function FullLogPage() {
  const { ruleId } = Route.useParams();
  const { report, interactions } = Route.useLoaderData();

  return (
    <main className="mx-auto w-[min(980px,calc(100%-2rem))] pb-20 pt-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="gap-2 rounded-full">
          <Link to="/report/$ruleId" params={{ ruleId }}>
            <ArrowLeft className="h-4 w-4" /> Report
          </Link>
        </Button>
      </div>

      <header>
        <p className="text-sm font-medium text-muted-foreground">Complete AI interaction log</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{report.rule.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Full prompts and AI responses observed by the extension. Rule actions only happen when a
          keyword match is detected.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-border bg-card">
        {interactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No AI interactions have been recorded yet.
          </div>
        ) : (
          <ScrollArea className="h-[min(720px,70vh)]">
            <div className="divide-y divide-border">
              {interactions.map((item) => {
                const isInput = item.side === "input";
                const Icon = isInput ? UserRound : Bot;
                return (
                  <article key={item.id} className="grid gap-3 p-4 sm:grid-cols-[9rem_1fr]">
                    <div className="space-y-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                          isInput
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {isInput ? "User" : "AI"}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {formatTime(item.created_at)}
                      </p>
                      <p className="truncate text-[11px] capitalize text-muted-foreground">
                        {item.platform || "ai"}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {item.content}
                      </p>
                      {item.url && (
                        <p className="mt-2 truncate text-[11px] text-muted-foreground">
                          {item.url}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </section>
    </main>
  );
}
