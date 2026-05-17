import type { MatchLogic, Rule, RuleAction, RuleScope, RuleSeverity } from "./types";

/** Coerce API / storage payloads so active, keywords, and ids behave predictably in the extension. */
export function normalizeRulesFromStorage(raw: unknown): Rule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = item as Record<string, unknown>;
    const ar = r.active;
    const inactive =
      ar === false || ar === 0 || ar === "0" || ar === "false" || ar === null;
    const keywords = Array.isArray(r.keywords)
      ? (r.keywords as unknown[]).map((k) => String(k).trim()).filter(Boolean)
      : [];
    return {
      id: String(r.id ?? "").trim(),
      title: String(r.title ?? "Rule"),
      action: (r.action as RuleAction) || "block",
      keywords,
      body: String(r.body ?? ""),
      severity: (r.severity as RuleSeverity) || "medium",
      scope: (r.scope as RuleScope) || "both",
      match_logic: (r.match_logic as MatchLogic) || "any",
      domain: String(r.domain ?? ""),
      active: !inactive,
    };
  });
}
