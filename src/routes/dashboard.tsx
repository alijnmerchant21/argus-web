import { useCallback, useMemo, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { Plus, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getSessionFn } from "@/lib/auth";
import { getRulesFn, saveRuleFn, deleteRuleFn, type Rule } from "@/lib/rules";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
    return { session };
  },
  loader: async () => {
    return await getRulesFn();
  },
  head: () => ({
    meta: [{ title: "Dashboard — Argus" }, { name: "description", content: "Define and manage Argus rules." }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const initialRules = Route.useLoaderData();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [readOnly, setReadOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const rules = initialRules;

  const selected = useMemo(() => rules.find((r) => r.id === selectedId) ?? null, [rules, selectedId]);

  const resetForm = useCallback(() => {
    setTitle("");
    setBody("");
    setSeverity("medium");
    setReadOnly(false);
  }, []);

  const startNew = () => {
    setSelectedId(null);
    setIsNew(true);
    resetForm();
  };

  const selectRule = (id: string) => {
    const r = rules.find((x) => x.id === id);
    if (!r) return;
    setSelectedId(id);
    setIsNew(false);
    setTitle(r.title);
    setBody(r.body);
    setSeverity(r.severity);
    setReadOnly(true);
  };

  const saveRule = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody || saving) return;
    setSaving(true);
    try {
      const result = await saveRuleFn({
        data: { id: isNew ? undefined : selectedId ?? undefined, title: trimmedTitle, body: trimmedBody, severity },
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
      resetForm();
      await router.invalidate();
    } finally {
      setDeleting(false);
    }
  };

  const showRuleActions = selectedId && !isNew;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-8rem)] w-[min(1200px,calc(100%-2rem))] flex-col gap-6 pb-16 pt-6 md:flex-row md:gap-0 md:pt-8">
      <aside className="flex w-full shrink-0 flex-col border-b border-border md:w-64 md:border-b-0 md:border-r md:pr-4">
        <div className="flex items-center justify-between gap-2 pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rules</h2>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0 rounded-full border-2"
            onClick={startNew}
            aria-label="New rule"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="h-[min(420px,40vh)] md:h-[min(calc(100dvh-16rem),560px)]">
          <ul className="space-y-1.5 pr-3">
            {rules.length === 0 ? (
              <li className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                No rules yet. Tap <span className="font-medium text-foreground">+</span> to add one.
              </li>
            ) : (
              rules.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => selectRule(r.id)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      selectedId === r.id
                        ? "border-foreground bg-secondary font-medium"
                        : "border-transparent bg-muted/40 hover:bg-muted",
                    )}
                  >
                    <span className="line-clamp-2">{r.title}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>

      </aside>

      <section className="min-h-[320px] flex-1 md:pl-6">
        {!selectedId && !isNew ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="max-w-sm text-muted-foreground">
              Select a rule from the list, or use the <strong className="text-foreground">+</strong> button to define a
              new one.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-bold tracking-tight">{isNew ? "New rule" : "Rule"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isNew ? "Describe what Argus should enforce." : "Review or update this rule."}
            </p>

            <div className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="rule-title">Title</Label>
                <Input
                  id="rule-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. No PII in outbound prompts"
                  readOnly={readOnly}
                  className={readOnly ? "bg-muted" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-body">Rule</Label>
                <Textarea
                  id="rule-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Plain language your team and Argus can interpret."
                  rows={6}
                  readOnly={readOnly}
                  className={readOnly ? "resize-none bg-muted" : "resize-y"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-severity">Severity</Label>
                <Input
                  id="rule-severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  placeholder="low / medium / high"
                  readOnly={readOnly}
                  className={readOnly ? "bg-muted" : ""}
                />
              </div>
            </div>

            {(!readOnly || isNew) && (
              <div className="mt-8 flex flex-wrap gap-3">
                <Button type="button" className="rounded-full" onClick={saveRule} disabled={saving}>
                  {saving ? "Saving…" : isNew ? "Save rule" : "Save changes"}
                </Button>
                {!isNew && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full text-muted-foreground"
                    onClick={() => { setReadOnly(true); }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}

            {showRuleActions && (
              <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-6">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setReadOnly(false)}>
                  Edit rule
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full gap-2"
                  onClick={() => navigate({ to: "/report/$ruleId", params: { ruleId: selectedId! } })}
                >
                  <BarChart3 className="h-4 w-4" />
                  See report
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full text-destructive hover:text-destructive ml-auto"
                  onClick={deleteRule}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
            )}

            <p className="mt-8 text-center text-sm text-muted-foreground">
              <Link to="/" className="font-medium text-foreground underline-offset-4 hover:underline">
                Back to site
              </Link>
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
