import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ArrowLeft,
  ShieldBan,
  AlertTriangle,
  Flag,
  ChevronDown,
  ChevronUp,
  List,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getSessionFn } from "@/lib/auth";
import { getAIInteractionsFn, getReportLogsFn } from "@/lib/api-key";

export const Route = createFileRoute("/report/$ruleId")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async ({ params }) => ({
    report: await getReportLogsFn({ data: { ruleId: params.ruleId, limit: 100 } }),
    interactions: await getAIInteractionsFn({ data: { limit: 100 } }),
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Report — Argus` },
      { name: "description", content: "Rule enforcement report." },
    ],
  }),
  component: ReportPage,
});

const ACTION_STYLE = {
  block: { label: "Blocked", icon: ShieldBan, bg: "bg-rose-50   border-rose-200  text-rose-700" },
  warn: {
    label: "Warned",
    icon: AlertTriangle,
    bg: "bg-amber-50  border-amber-200 text-amber-700",
  },
  flag: { label: "Flagged", icon: Flag, bg: "bg-sky-50    border-sky-200   text-sky-700" },
};

function timeAgo(ts: number | string): string {
  const n = Number(ts);
  if (!Number.isFinite(n)) return "";
  const s = Math.floor((Date.now() - n) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(n).toLocaleDateString();
}

function LogRow({
  log,
}: {
  log: {
    id: string;
    action: string;
    matched_kw: string;
    platform: string;
    prompt_text: string;
    created_at: number;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ACTION_STYLE[log.action as keyof typeof ACTION_STYLE] ?? ACTION_STYLE.flag;
  const Icon = cfg.icon;

  return (
    <div className="rounded-xl border border-border bg-card transition-all">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs",
            cfg.bg,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm font-medium">
            {log.matched_kw ? `"${log.matched_kw}"` : cfg.label}
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            {log.platform || "unknown"} · {timeAgo(log.created_at)}
          </span>
        </span>
        {log.prompt_text ? (
          expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        ) : null}
      </button>

      {expanded && log.prompt_text && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Prompt
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {log.prompt_text}
          </p>
        </div>
      )}
    </div>
  );
}

function InteractionRow({
  item,
}: {
  item: {
    id: string;
    side: "input" | "output";
    platform: string;
    url: string;
    content: string;
    created_at: number;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const isInput = item.side === "input";

  return (
    <div className="rounded-xl border border-border bg-card transition-all">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            "shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold uppercase",
            isInput
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {isInput ? "User" : "AI"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.content}</span>
          <span className="text-xs text-muted-foreground capitalize">
            {item.platform || "ai"} · {timeAgo(item.created_at)}
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-border px-4 py-3">
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{item.content}</p>
          {item.url && <p className="truncate text-[11px] text-muted-foreground">{item.url}</p>}
        </div>
      )}
    </div>
  );
}

function ReportPage() {
  const { ruleId } = Route.useParams();
  const data = Route.useLoaderData();
  const [actionFilter, setActionFilter] = useState<"all" | "block" | "warn" | "flag">("all");

  const { rule, summary, logs } = data.report;
  const interactions = data.interactions;
  const visibleLogs =
    actionFilter === "all" ? logs : logs.filter((log) => log.action === actionFilter);

  const statCards = [
    {
      label: "Total events",
      value: summary.total,
      bg: "bg-slate-50   border-slate-200",
      filter: "all" as const,
    },
    {
      label: "Blocked",
      value: summary.blocked,
      bg: "bg-rose-50    border-rose-200",
      filter: "block" as const,
    },
    {
      label: "Warned",
      value: summary.warned,
      bg: "bg-amber-50   border-amber-200",
      filter: "warn" as const,
    },
    {
      label: "Flagged",
      value: summary.flagged,
      bg: "bg-sky-50     border-sky-200",
      filter: "flag" as const,
    },
  ];

  return (
    <main className="mx-auto w-[min(900px,calc(100%-2rem))] pb-20 pt-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-2 rounded-full">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </Button>
      </div>

      <header className="animate-fade-up">
        <p className="text-sm font-medium text-muted-foreground">Rule report</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{rule.title}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">ID: {ruleId}</p>
        <Button asChild variant="outline" className="mt-4 gap-2 rounded-full">
          <Link to="/ai-log/$ruleId" params={{ ruleId }}>
            <List className="h-4 w-4" /> View full AI log
          </Link>
        </Button>
      </header>

      {/* Summary cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {statCards.map((s, i) => (
          <button
            type="button"
            key={s.label}
            onClick={() => setActionFilter(s.filter)}
            className={cn(
              "animate-fade-up rounded-2xl border p-5 text-left shadow-sm transition",
              s.bg,
              actionFilter === s.filter && "ring-2 ring-foreground/20",
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{s.value}</p>
          </button>
        ))}
      </div>

      {/* Log list */}
      <div className="mt-10 animate-fade-up" style={{ animationDelay: "240ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent events {logs.length > 0 && `(${logs.length})`}
            {actionFilter !== "all" && ` · ${ACTION_STYLE[actionFilter].label}`}
          </h2>
        </div>

        {visibleLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center text-muted-foreground">
            <p className="text-sm font-medium">No events yet</p>
            <p className="mt-1 text-xs">
              Events appear here once the extension starts intercepting prompts.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[min(520px,60vh)]">
            <div className="space-y-2 pr-1">
              {visibleLogs.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="mt-10 animate-fade-up" style={{ animationDelay: "320ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            AI interactions {interactions.length > 0 && `(${interactions.length})`}
          </h2>
        </div>

        {interactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center text-muted-foreground">
            <p className="text-sm font-medium">No AI interactions yet</p>
            <p className="mt-1 text-xs">
              All AI prompts and responses appear here once the extension observes them.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[min(520px,60vh)]">
            <div className="space-y-2 pr-1">
              {interactions.map((item) => (
                <InteractionRow key={item.id} item={item} />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </main>
  );
}
