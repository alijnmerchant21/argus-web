import type { Rule, LogEntry, ArgusConfig } from "./types";

const KEYS = {
  rules: "argus_rules",
  lastSync: "argus_last_sync",
  apiKey: "argus_api_key",
  baseUrl: "argus_base_url",
  scopedRuleIds: "argus_scoped_rule_ids",
  enabled: "argus_enabled",
  logQueue: "argus_log_queue",
} as const;

export const storage = {
  async getRules(): Promise<Rule[]> {
    const d = await chrome.storage.local.get(KEYS.rules);
    return d[KEYS.rules] ?? [];
  },

  async setRules(rules: Rule[], syncedAt = Date.now()): Promise<void> {
    await chrome.storage.local.set({ [KEYS.rules]: rules, [KEYS.lastSync]: syncedAt });
  },

  async getConfig(): Promise<{ apiKey: string; baseUrl: string; scopedRuleIds?: string[] } | null> {
    const d = await chrome.storage.local.get([KEYS.apiKey, KEYS.baseUrl, KEYS.scopedRuleIds]);
    if (!d[KEYS.apiKey]) return null;
    return {
      apiKey: d[KEYS.apiKey],
      baseUrl: d[KEYS.baseUrl] ?? "http://localhost:3000",
      scopedRuleIds: d[KEYS.scopedRuleIds] ?? undefined,
    };
  },

  async setConfig(cfg: ArgusConfig): Promise<void> {
    const patch: Record<string, unknown> = {
      [KEYS.apiKey]: cfg.apiKey,
      [KEYS.baseUrl]: cfg.apiBaseUrl,
    };
    if (cfg.scopedRuleIds?.length) {
      patch[KEYS.scopedRuleIds] = cfg.scopedRuleIds;
    } else {
      await chrome.storage.local.remove(KEYS.scopedRuleIds);
    }
    await chrome.storage.local.set(patch);
  },

  async isEnabled(): Promise<boolean> {
    const d = await chrome.storage.local.get(KEYS.enabled);
    return d[KEYS.enabled] !== false;
  },

  async setEnabled(val: boolean): Promise<void> {
    await chrome.storage.local.set({ [KEYS.enabled]: val });
  },

  async getLastSync(): Promise<number | null> {
    const d = await chrome.storage.local.get(KEYS.lastSync);
    return d[KEYS.lastSync] ?? null;
  },

  async queueLog(entry: LogEntry): Promise<void> {
    const d = await chrome.storage.local.get(KEYS.logQueue);
    const q: LogEntry[] = d[KEYS.logQueue] ?? [];
    q.push(entry);
    await chrome.storage.local.set({ [KEYS.logQueue]: q });
  },

  async getLogQueue(): Promise<LogEntry[]> {
    const d = await chrome.storage.local.get(KEYS.logQueue);
    return d[KEYS.logQueue] ?? [];
  },

  async clearLogQueue(): Promise<void> {
    await chrome.storage.local.set({ [KEYS.logQueue]: [] });
  },

  async drainLogQueue(): Promise<LogEntry[]> {
    const q = await this.getLogQueue();
    if (q.length > 0) await this.clearLogQueue();
    return q;
  },
};
