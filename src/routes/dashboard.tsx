import { useCallback, useMemo, useState, useRef } from "react";
import { createFileRoute, Link, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Plus, FileText, BarChart3, X, Download,
  ShieldBan, AlertTriangle, Flag, Loader2,
  Stethoscope, Scale, GraduationCap, FlaskConical, Landmark, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getSessionFn } from "@/lib/auth";
import {
  getRulesFn, saveRuleFn, deleteRuleFn,
  type RuleView, type RuleAction, type RuleSeverity, type RuleScope, type MatchLogic,
} from "@/lib/rules";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
    return { session };
  },
  loader: async () => getRulesFn(),
  head: () => ({
    meta: [{ title: "Dashboard — Argus" }, { name: "description", content: "Define and manage Argus rules." }],
  }),
  component: DashboardPage,
});

// ── constants ──────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<RuleAction, { label: string; desc: string; Icon: React.ElementType; pastel: string; active: string }> = {
  block: { label: "Block",  desc: "Prevent the message from being sent",    Icon: ShieldBan,    pastel: "border-rose-200/80  bg-rose-50   text-rose-700",  active: "border-rose-400  bg-rose-100  text-rose-800  ring-2 ring-rose-300" },
  warn:  { label: "Warn",   desc: "Show a warning — user can still proceed", Icon: AlertTriangle, pastel: "border-amber-200/80 bg-amber-50  text-amber-700", active: "border-amber-400 bg-amber-100 text-amber-800 ring-2 ring-amber-300" },
  flag:  { label: "Flag",   desc: "Log the violation silently",              Icon: Flag,         pastel: "border-sky-200/80   bg-sky-50    text-sky-700",   active: "border-sky-400   bg-sky-100   text-sky-800   ring-2 ring-sky-300" },
};

const SEVERITY_COLORS: Record<RuleSeverity, string> = {
  low:    "border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200",
  medium: "border-amber-300  bg-amber-50   text-amber-800  ring-2 ring-amber-200",
  high:   "border-rose-300   bg-rose-50    text-rose-800   ring-2 ring-rose-200",
};

// ── templates ─────────────────────────────────────────────────────────────────

type Template = {
  title: string; domain: string; action: RuleAction; severity: RuleSeverity;
  keywords: string[]; body: string; notes: string;
  scope: RuleScope; match_logic: MatchLogic;
};

const TEMPLATE_GROUPS: { label: string; icon: React.ElementType; pastel: string; templates: Template[] }[] = [
  {
    label: "Doctors", icon: Stethoscope, pastel: "bg-sky-50 border-sky-200",
    templates: [
      { title: "No Patient PII",        domain: "Medical", action: "block", severity: "high",   keywords: ["patient name", "DOB", "medical record", "SSN"], body: "Sharing patient-identifying information with AI tools is not permitted.", notes: "HIPAA compliance", scope: "input", match_logic: "any" },
      { title: "Flag Diagnosis Requests", domain: "Medical", action: "flag",  severity: "medium", keywords: ["diagnose", "diagnosis", "do I have", "symptoms of"], body: "", notes: "Flag AI-generated diagnoses for review", scope: "output", match_logic: "any" },
      { title: "Medication Dosage Warning", domain: "Medical", action: "warn",  severity: "high",   keywords: ["dosage", "mg", "milligram", "prescribe", "prescription"], body: "Verify all dosage information with a licensed pharmacist or physician.", notes: "", scope: "output", match_logic: "any" },
    ],
  },
  {
    label: "Lawyers", icon: Scale, pastel: "bg-violet-50 border-violet-200",
    templates: [
      { title: "Flag Client Info Sharing",  domain: "Legal", action: "flag",  severity: "high",   keywords: ["client name", "case number", "settlement", "confidential"], body: "", notes: "Privilege protection", scope: "input", match_logic: "any" },
      { title: "Jurisdiction Advice Warning", domain: "Legal", action: "warn",  severity: "medium", keywords: ["in your state", "legally you can", "you are entitled"], body: "AI legal advice is not jurisdiction-verified. Always consult a qualified attorney.", notes: "", scope: "output", match_logic: "any" },
    ],
  },
  {
    label: "Researchers", icon: FlaskConical, pastel: "bg-emerald-50 border-emerald-200",
    templates: [
      { title: "Flag Fabricated Citations", domain: "Research", action: "flag",  severity: "high",   keywords: ["according to", "study shows", "published in", "researchers found"], body: "", notes: "Hallucinated citations are a known risk", scope: "output", match_logic: "any" },
      { title: "Warn Dataset Hallucination",  domain: "Research", action: "warn",  severity: "medium", keywords: ["dataset", "sample size", "p-value", "statistically"], body: "Verify all statistical claims against primary sources.", notes: "", scope: "output", match_logic: "any" },
    ],
  },
  {
    label: "Policy Makers", icon: Landmark, pastel: "bg-amber-50 border-amber-200",
    templates: [
      { title: "Sensitive Policy Leak Warning", domain: "Policy", action: "warn", severity: "high", keywords: ["draft legislation", "internal memo", "embargoed", "off the record"], body: "This content may be sensitive. Confirm it is approved for AI processing.", notes: "", scope: "input", match_logic: "any" },
    ],
  },
  {
    label: "Academists", icon: GraduationCap, pastel: "bg-rose-50 border-rose-200",
    templates: [
      { title: "Flag Ghostwriting",     domain: "Academia", action: "flag",  severity: "high",   keywords: ["write my essay", "write my paper", "write this for me", "do my homework"], body: "", notes: "Academic integrity", scope: "input", match_logic: "any" },
      { title: "Plagiarism Warning",    domain: "Academia", action: "warn",  severity: "medium", keywords: ["copy this", "rewrite verbatim", "exact words"], body: "Submitting AI-generated content as original work may violate academic integrity policies.", notes: "", scope: "input", match_logic: "any" },
    ],
  },
];

// ── template picker dialog ────────────────────────────────────────────────────

function TemplatePicker({ open, onClose, onSelect, onBlank }: {
  open: boolean;
  onClose: () => void;
  onSelect: (t: Template) => void;
  onBlank: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85dvh] w-[min(680px,calc(100vw-2rem))] overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl font-bold">Start a new rule</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">Pick a template or start from scratch.</p>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* blank */}
          <button
            type="button"
            onClick={onBlank}
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-5 py-4 text-left transition-all hover:border-foreground/30 hover:bg-muted/60"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">Blank rule</p>
              <p className="text-xs text-muted-foreground mt-0.5">Define everything yourself from scratch.</p>
            </div>
          </button>

          {/* domain groups */}
          {TEMPLATE_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="flex items-center gap-2 mb-2">
                <g.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.label}</span>
              </div>
              <div className="space-y-2">
                {g.templates.map((t) => (
                  <button
                    key={t.title}
                    type="button"
                    onClick={() => onSelect(t)}
                    className={cn(
                      "flex w-full items-start gap-4 rounded-xl border px-4 py-3 text-left transition-all hover:scale-[1.01] hover:shadow-sm",
                      g.pastel,
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{t.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {t.action === "block" ? "Blocks" : t.action === "warn" ? "Warns" : "Flags"} · {t.severity} severity
                        {t.keywords.length > 0 && ` · "${t.keywords[0]}"${t.keywords.length > 1 ? ` +${t.keywords.length - 1}` : ""}`}
                      </p>
                    </div>
                    <span className={cn(
                      "shrink-0 mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      t.action === "block" ? "border-rose-300 text-rose-700" : t.action === "warn" ? "border-amber-300 text-amber-700" : "border-sky-300 text-sky-700",
                    )}>{t.action}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── keyword tag input ─────────────────────────────────────────────────────────

function KeywordInput({ keywords, onChange, readOnly }: { keywords: string[]; onChange: (k: string[]) => void; readOnly: boolean }) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const w = raw.trim().toLowerCase().replace(/,+$/, "");
    if (!w || keywords.includes(w)) { setDraft(""); return; }
    onChange([...keywords, w]);
    setDraft("");
  };

  return (
    <div
      className={cn(
        "flex min-h-[2.75rem] flex-wrap gap-1.5 rounded-xl border px-3 py-2 transition-shadow",
        readOnly ? "cursor-default bg-muted" : "bg-background focus-within:ring-2 focus-within:ring-ring/30",
      )}
      onClick={() => !readOnly && inputRef.current?.focus()}
    >
      {keywords.map((kw) => (
        <span key={kw} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 shadow-sm">
          {kw}
          {!readOnly && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(keywords.filter((k) => k !== kw)); }} className="ml-0.5 text-slate-400 hover:text-slate-700" aria-label={`Remove ${kw}`}>
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
            if (e.key === "Backspace" && !draft && keywords.length) onChange(keywords.slice(0, -1));
          }}
          onBlur={() => { if (draft.trim()) add(draft); }}
          placeholder={keywords.length === 0 ? "Type a keyword and press Enter…" : "Add more…"}
          className="min-w-[9rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}

// ── segmented control ─────────────────────────────────────────────────────────

function SegControl<T extends string>({
  options, value, onChange, readOnly,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; readOnly: boolean }) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-muted p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={readOnly}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
            value === o.value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            readOnly && "cursor-default",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── section header ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{children}</span>
      <span className="flex-1 border-t border-border" />
    </div>
  );
}

// ── form default ──────────────────────────────────────────────────────────────

function emptyForm() {
  return {
    title: "", action: "block" as RuleAction, keywords: [] as string[],
    body: "", severity: "medium" as RuleSeverity,
    scope: "input" as RuleScope, match_logic: "any" as MatchLogic,
    domain: "", active: true, notes: "",
  };
}

type FormState = ReturnType<typeof emptyForm>;

function fromTemplate(t: Template): FormState {
  return {
    title: t.title, action: t.action, keywords: t.keywords,
    body: t.body, severity: t.severity,
    scope: t.scope, match_logic: t.match_logic,
    domain: t.domain, active: true, notes: t.notes,
  };
}

// ── main page ─────────────────────────────────────────────────────────────────

function DashboardPage() {
  const router   = useRouter();
  const navigate = useNavigate();
  const rules    = Route.useLoaderData();

  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [isNew,       setIsNew]       = useState(false);
  const [form,        setForm]        = useState<FormState>(emptyForm());
  const [readOnly,    setReadOnly]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [pickerOpen,  setPickerOpen]  = useState(false);

  const patch = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const selected = useMemo(() => rules.find((r) => r.id === selectedId) ?? null, [rules, selectedId]);

  const openPicker = () => setPickerOpen(true);

  const startNew = () => {
    setPickerOpen(false);
    setSelectedId(null);
    setIsNew(true);
    setForm(emptyForm());
    setReadOnly(false);
  };

  const startFromTemplate = (t: Template) => {
    setPickerOpen(false);
    setSelectedId(null);
    setIsNew(true);
    setForm(fromTemplate(t));
    setReadOnly(false);
  };

  const selectRule = (r: RuleView) => {
    setSelectedId(r.id);
    setIsNew(false);
    setForm({
      title: r.title, action: r.action, keywords: r.keywords,
      body: r.body, severity: r.severity,
      scope: r.scope, match_logic: r.match_logic,
      domain: r.domain, active: r.active, notes: r.notes,
    });
    setReadOnly(true);
  };

  const saveRule = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      const result = await saveRuleFn({
        data: {
          id:          isNew ? undefined : selectedId ?? undefined,
          title:       form.title.trim(),
          action:      form.action,
          keywords:    form.keywords,
          body:        form.body.trim(),
          severity:    form.severity,
          platforms:   [],
          scope:       form.scope,
          match_logic: form.match_logic,
          domain:      form.domain.trim(),
          active:      form.active,
          notes:       form.notes.trim(),
        },
      });
      setSelectedId(result.id);
      setIsNew(false);
      setReadOnly(true);
      await router.invalidate();
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async () => {
    if (!selectedId || deleting) return;
    setDeleting(true);
    try {
      await deleteRuleFn({ data: { id: selectedId } });
      setSelectedId(null);
      setIsNew(false);
      setForm(emptyForm());
      await router.invalidate();
    } finally {
      setDeleting(false);
    }
  };

  const showActions = selectedId && !isNew && readOnly;
  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-[min(1200px,calc(100%-2rem))] flex-col pb-6 pt-6 md:pt-8">
      <div className="flex flex-1 flex-col gap-6 md:flex-row md:gap-0">

        {/* ── Sidebar ────────────────────────────────── */}
        <aside className="flex w-full shrink-0 flex-col border-b border-border pb-4 md:w-64 md:border-b-0 md:border-r md:pb-0 md:pr-5">
          <div className="flex items-center justify-between gap-2 pb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rules</h2>
            <Button
              type="button" size="icon" variant="outline"
              className="h-9 w-9 shrink-0 rounded-full border-2 transition-transform hover:scale-105 active:scale-95"
              onClick={openPicker} aria-label="New rule"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="h-[min(320px,32vh)] md:h-[min(calc(100dvh-18rem),520px)]">
            <div className="space-y-4 pr-1">
              {rules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  No rules yet.{" "}
                  <button type="button" onClick={openPicker} className="font-medium text-foreground hover:underline">Add one →</button>
                </div>
              ) : (
                (() => {
                  const groups = rules.reduce<Record<string, RuleView[]>>((acc, r) => {
                    const key = r.domain?.trim() || "Other";
                    (acc[key] ??= []).push(r);
                    return acc;
                  }, {});
                  return Object.entries(groups).map(([group, groupRules]) => (
                    <div key={group}>
                      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group}</p>
                      <ul className="space-y-1">
                        {groupRules.map((r) => {
                          const cfg = ACTION_CONFIG[r.action];
                          return (
                            <li key={r.id}>
                              <button
                                type="button"
                                onClick={() => selectRule(r)}
                                className={cn(
                                  "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                                  selectedId === r.id
                                    ? "bg-slate-100 font-semibold text-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                  !r.active && "opacity-40",
                                )}
                              >
                                <cfg.Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                                {!r.active && <span className="shrink-0 text-[10px] text-muted-foreground">off</span>}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ));
                })()
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* ── Right panel ─────────────────────────────── */}
        <section className="min-h-[320px] flex-1 md:pl-6">
          {!selectedId && !isNew ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="max-w-sm text-muted-foreground">
                Pick a rule from the list, or press{" "}
                <button type="button" onClick={openPicker} className="font-semibold text-foreground hover:underline">+ New</button>{" "}
                to define one.
              </p>
            </div>
          ) : (
            <div className="animate-fade-up rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">

              {/* Title row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight">{isNew ? "New rule" : selected?.title ?? "Rule"}</h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {isNew ? "Define what Argus should enforce." : "Review or update this rule."}
                  </p>
                </div>
                {/* Active badge (read-only) or switch (edit) */}
                {readOnly ? (
                  <span className={cn(
                    "mt-1 shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
                    form.active
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-100 text-slate-400",
                  )}>
                    {form.active ? "Active" : "Inactive"}
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-2 pt-1">
                    <span className="text-xs font-medium text-muted-foreground">{form.active ? "Active" : "Inactive"}</span>
                    <Switch
                      checked={form.active}
                      onCheckedChange={(v) => patch("active", v)}
                      aria-label="Toggle rule active"
                    />
                  </div>
                )}
              </div>

              <div className="mt-7 space-y-6">

                {/* ── IDENTITY ── */}
                <SectionHeader>Identity</SectionHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-title">Rule name</Label>
                    <Input
                      id="rule-title" value={form.title}
                      onChange={(e) => patch("title", e.target.value)}
                      placeholder="e.g. No PII in prompts"
                      readOnly={readOnly}
                      className={cn("h-11 rounded-xl", readOnly && "bg-muted")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-domain">Domain / Author</Label>
                    <Input
                      id="rule-domain" value={form.domain}
                      onChange={(e) => patch("domain", e.target.value)}
                      placeholder="e.g. Legal team, Dr. Ahmed"
                      readOnly={readOnly}
                      className={cn("h-11 rounded-xl", readOnly && "bg-muted")}
                    />
                  </div>
                </div>

                {/* ── TRIGGER ── */}
                <SectionHeader>Trigger</SectionHeader>

                {/* Scope + Match logic in a tidy 2-col grid */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium leading-none">Check scope</span>
                    <SegControl<RuleScope>
                      options={[{ value: "input", label: "User input" }, { value: "output", label: "AI output" }, { value: "both", label: "Both" }]}
                      value={form.scope} onChange={(v) => patch("scope", v)} readOnly={readOnly}
                    />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">Which side of the conversation Argus watches.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium leading-none">Match logic</span>
                    <SegControl<MatchLogic>
                      options={[{ value: "any", label: "Any" }, { value: "all", label: "All" }]}
                      value={form.match_logic} onChange={(v) => patch("match_logic", v)} readOnly={readOnly}
                    />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      <strong>Any</strong> — one keyword triggers. <strong>All</strong> — every keyword must appear.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Keywords</Label>
                  <KeywordInput keywords={form.keywords} onChange={(kw) => patch("keywords", kw)} readOnly={readOnly} />
                  <p className="text-[11px] text-muted-foreground">Press Enter or comma to add. Argus scans prompts for these terms.</p>
                </div>

                {/* ── RESPONSE ── */}
                <SectionHeader>Response</SectionHeader>

                <div className="space-y-2">
                  <Label>Rule type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["block", "warn", "flag"] as RuleAction[]).map((a) => {
                      const cfg = ACTION_CONFIG[a];
                      const isActive = form.action === a;
                      return (
                        <button
                          key={a}
                          type="button"
                          disabled={readOnly}
                          onClick={() => patch("action", a)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-all duration-150",
                            isActive ? cfg.active : cfg.pastel,
                            !readOnly && "cursor-pointer hover:scale-[1.02]",
                            readOnly && "cursor-default opacity-80",
                          )}
                        >
                          <cfg.Icon className="h-4 w-4" />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{ACTION_CONFIG[form.action].desc}</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rule-body">Response message</Label>
                  <Textarea
                    id="rule-body" value={form.body}
                    onChange={(e) => patch("body", e.target.value)}
                    placeholder="What should the user see when this rule triggers?"
                    rows={3}
                    readOnly={readOnly}
                    className={cn("resize-y rounded-xl", readOnly && "resize-none bg-muted")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Severity</Label>
                  <div className="flex gap-2">
                    {(["low", "medium", "high"] as RuleSeverity[]).map((s) => (
                      <button
                        key={s} type="button" disabled={readOnly}
                        onClick={() => patch("severity", s)}
                        className={cn(
                          "rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition-all",
                          form.severity === s ? SEVERITY_COLORS[s] : "border-border bg-secondary text-muted-foreground hover:bg-muted",
                          !readOnly && "hover:scale-105",
                          readOnly && "cursor-default opacity-80",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── CONTEXT ── */}
                <SectionHeader>Context</SectionHeader>

                <div className="space-y-1.5">
                  <Label htmlFor="rule-notes">Internal notes</Label>
                  <Textarea
                    id="rule-notes" value={form.notes}
                    onChange={(e) => patch("notes", e.target.value)}
                    placeholder="Why does this rule exist? Who requested it? Not shown to end users."
                    rows={3}
                    readOnly={readOnly}
                    className={cn("resize-y rounded-xl", readOnly && "resize-none bg-muted")}
                  />
                  <p className="text-[11px] text-muted-foreground">Team-facing only — never shown in the extension.</p>
                </div>

              </div>

              {/* Save / Cancel */}
              {!readOnly && (
                <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
                  <Button
                    type="button"
                    className="fun-btn rounded-full bg-foreground text-background hover:bg-foreground/90"
                    onClick={saveRule}
                    disabled={saving || !form.title.trim()}
                  >
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : isNew ? "Save rule" : "Save changes"}
                  </Button>
                  {!isNew && (
                    <Button type="button" variant="ghost" className="rounded-full text-muted-foreground"
                      onClick={() => { if (selected) selectRule(selected); else setReadOnly(true); }}>
                      Cancel
                    </Button>
                  )}
                </div>
              )}

              {/* Rule actions (read-only) */}
              {showActions && (
                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-6">
                  <Button type="button" variant="outline" className="fun-btn rounded-full" onClick={() => setReadOnly(false)}>
                    Edit rule
                  </Button>
                  <Button
                    type="button" variant="outline" className="fun-btn gap-2 rounded-full"
                    onClick={() => navigate({ to: "/report/$ruleId", params: { ruleId: selectedId! } })}
                  >
                    <BarChart3 className="h-4 w-4" /> See report
                  </Button>
                  <Button
                    type="button" variant="outline" disabled
                    className="fun-btn gap-2 rounded-full opacity-50"
                    title="Coming soon — download an extension for this rule only"
                  >
                    <Download className="h-4 w-4" /> This rule only
                  </Button>
                  <Button
                    type="button" variant="ghost"
                    className="ml-auto rounded-full text-destructive hover:text-destructive"
                    onClick={deleteRule} disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              )}

              <p className="mt-8 text-center text-sm text-muted-foreground">
                <Link to="/" className="font-medium text-foreground underline-offset-4 hover:underline">Back to site</Link>
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ── Generate Extension ── */}
      <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-slate-700">Generate Extension Package</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {activeCount > 0
              ? `${activeCount} active rule${activeCount !== 1 ? "s" : ""} will be bundled into one Chrome extension. You can also download individual rules from each rule's actions.`
              : "Save at least one active rule, then bundle all your rules into one Chrome extension."}
          </p>
        </div>
        <Button type="button" disabled variant="outline" className="h-10 shrink-0 gap-2 rounded-full border-slate-300 text-sm font-semibold opacity-60">
          <Download className="h-4 w-4" /> Download .zip — coming soon
        </Button>
      </div>

      {/* Template picker */}
      <TemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onBlank={startNew}
        onSelect={startFromTemplate}
      />
    </div>
  );
}
