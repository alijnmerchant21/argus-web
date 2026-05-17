export type RuleAction   = "block" | "warn" | "flag";
export type RuleSeverity = "low" | "medium" | "high";
export type RuleScope    = "input" | "output" | "both";
export type MatchLogic   = "any" | "all";

export interface Rule {
  id:          string;
  title:       string;
  action:      RuleAction;
  keywords:    string[];
  body:        string;
  severity:    RuleSeverity;
  scope:       RuleScope;
  match_logic: MatchLogic;
  domain:      string;
  active:      boolean;
}

export interface MatchResult {
  matched:         boolean;
  rule?:           Rule;
  matchedKeywords?: string[];
}

export interface LogEntry {
  rule_id:     string;
  rule_title:  string;
  action:      RuleAction;
  matched_kw:  string;
  platform:    string;
  prompt_text: string;
  created_at:  number;
}

export interface ArgusConfig {
  apiKey:          string;
  apiBaseUrl:      string;
  generatedAt?:    number;
  /** When set, the extension syncs ONLY these rule IDs (single-rule bundle). */
  scopedRuleIds?:  string[];
}
