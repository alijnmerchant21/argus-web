import type { MatchResult, Rule } from "./types";

function keywordMatches(kw: string, lowerText: string): boolean {
  try {
    return new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(
      lowerText,
    );
  } catch {
    return lowerText.includes(kw.toLowerCase());
  }
}

/** Same priority as main-world hook: input / both scope, keywords, severity × action. */
export function evaluateInputRules(text: string, rules: Rule[]): MatchResult {
  const lower = text.toLowerCase();
  const SE: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const AE: Record<string, number> = { block: 3, warn: 2, flag: 1 };
  const applicable = rules
    .filter(
      (r) =>
        r.active &&
        (r.scope === "input" || r.scope === "both") &&
        r.keywords &&
        r.keywords.length,
    )
    .sort((a, b) => {
      const sd = (SE[b.severity] || 0) - (SE[a.severity] || 0);
      return sd !== 0 ? sd : (AE[b.action] || 0) - (AE[a.action] || 0);
    });
  for (const rule of applicable) {
    const matched = rule.keywords.filter((k) => keywordMatches(k, lower));
    const triggered =
      rule.match_logic === "all"
        ? matched.length === rule.keywords.length
        : matched.length > 0;
    if (triggered) return { matched: true, rule, matchedKeywords: matched };
  }
  return { matched: false };
}
