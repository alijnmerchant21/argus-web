import type { Rule, MatchResult, RuleScope } from "../../shared/types";

const SEVERITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const ACTION_RANK:   Record<string, number> = { block: 3, warn: 2, flag: 1 };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordMatches(kw: string, lowerText: string): boolean {
  try {
    return new RegExp(`\\b${escapeRegex(kw.toLowerCase())}\\b`).test(lowerText);
  } catch {
    return lowerText.includes(kw.toLowerCase());
  }
}

export function checkText(text: string, rules: Rule[], scope: RuleScope): MatchResult {
  const lower      = text.toLowerCase();
  const applicable = rules
    .filter((r) => r.active && (r.scope === scope || r.scope === "both") && r.keywords.length > 0)
    .sort((a, b) => {
      const sd = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      return sd !== 0 ? sd : ACTION_RANK[b.action] - ACTION_RANK[a.action];
    });

  for (const rule of applicable) {
    const matched = rule.keywords.filter((kw) => keywordMatches(kw, lower));
    const triggered =
      rule.match_logic === "all"
        ? matched.length === rule.keywords.length
        : matched.length > 0;

    if (triggered) return { matched: true, rule, matchedKeywords: matched };
  }

  return { matched: false };
}
