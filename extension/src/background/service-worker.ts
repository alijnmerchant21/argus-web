import { storage } from "../shared/storage";

/** Main world reads bootstrap from DOM; inject into the frame that set it (subframes matter on ChatGPT). */
async function injectArgusMainWorld(tabId: number, frameId: number | undefined): Promise<void> {
  const target: chrome.scripting.InjectionTarget =
    frameId != null ? { tabId, frameIds: [frameId] } : { tabId };
  await chrome.scripting.executeScript({
    target,
    world: "MAIN",
    files: ["argus-main-world.js"],
  });
}

const SYNC_ALARM = "argus-sync";
const FLUSH_ALARM = "argus-flush";
const INTERACTION_FLUSH_ALARM = "argus-interaction-flush";
const SYNC_EVERY = 15; // minutes
const FLUSH_EVERY = 2; // minutes
const recentLogKeys = new Map<string, number>();
const recentInteractionKeys = new Map<string, number>();

function logFingerprint(entry: {
  rule_id?: string;
  action?: string;
  prompt_text?: string;
}): string {
  const prompt = String(entry.prompt_text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return `${String(entry.rule_id ?? "")}::${String(entry.action ?? "")}::${prompt}`;
}

function shouldAcceptQueuedLog(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const now = Date.now();
  for (const [key, until] of recentLogKeys) {
    if (until <= now) recentLogKeys.delete(key);
  }
  const key = logFingerprint(entry as { rule_id?: string; action?: string; prompt_text?: string });
  if ((recentLogKeys.get(key) ?? 0) > now) return false;
  recentLogKeys.set(key, now + 12000);
  return true;
}

function interactionFingerprint(entry: {
  side?: string;
  platform?: string;
  content?: string;
}): string {
  const content = String(entry.content ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return `${String(entry.side ?? "")}::${String(entry.platform ?? "")}::${content}`;
}

function shouldAcceptQueuedInteraction(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const now = Date.now();
  for (const [key, until] of recentInteractionKeys) {
    if (until <= now) recentInteractionKeys.delete(key);
  }
  const key = interactionFingerprint(
    entry as { side?: string; platform?: string; content?: string },
  );
  if ((recentInteractionKeys.get(key) ?? 0) > now) return false;
  recentInteractionKeys.set(key, now + 30000);
  return true;
}

function pulseFlagBadge(tabId?: number): void {
  if (tabId == null) return;
  void chrome.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" }).catch(() => {});
  void chrome.action.setBadgeText({ tabId, text: "!" }).catch(() => {});
  setTimeout(() => {
    void chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  }, 7000);
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  await bootstrapFromBundledConfig();
  setupAlarms();
  syncRules();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarms();
  syncRules();
});

function setupAlarms(): void {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_EVERY });
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_EVERY });
  chrome.alarms.create(INTERACTION_FLUSH_ALARM, { periodInMinutes: FLUSH_EVERY });
}

// ── Read config.json and rules.json injected at download time ─────────────────
async function bootstrapFromBundledConfig(): Promise<void> {
  try {
    const configUrl = chrome.runtime.getURL("config.json");
    const rulesUrl = chrome.runtime.getURL("rules.json");
    const [cfgRes, rulesRes] = await Promise.all([fetch(configUrl), fetch(rulesUrl)]);
    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      await storage.setConfig(cfg);
    }
    if (rulesRes.ok) {
      const rules = await rulesRes.json();
      await storage.setRules(rules);
    }
  } catch (e) {
    console.warn("[Argus] bootstrapFromBundledConfig failed", e);
  }
}

// ── Alarms ───────────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM) await syncRules();
  if (alarm.name === FLUSH_ALARM) await flushLogs();
  if (alarm.name === INTERACTION_FLUSH_ALARM) await flushInteractions();
});

// ── Rule sync ────────────────────────────────────────────────────────────────
async function syncRules(): Promise<void> {
  const cfg = await storage.getConfig();
  if (!cfg?.apiKey) return;

  const lastSync = await storage.getLastSync();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (lastSync) headers["If-Modified-Since"] = new Date(lastSync).toUTCString();

  // Scoped bundles only fetch the rules they were built for.
  // This prevents a single-rule extension from silently picking up
  // all other active rules after the first sync.
  const url = new URL(`${cfg.baseUrl}/api/rules`);
  if (cfg.scopedRuleIds?.length) {
    url.searchParams.set("ids", cfg.scopedRuleIds.join(","));
  }

  try {
    const res = await fetch(url.toString(), { headers });
    if (res.status === 304) return;
    if (!res.ok) {
      console.warn("[Argus] syncRules HTTP", res.status, await res.text().catch(() => ""));
      return;
    }
    const rules = await res.json();
    await storage.setRules(rules);
    broadcastRulesUpdated();
  } catch (e) {
    console.warn("[Argus] syncRules failed", e);
  }
}

// ── Log flush ────────────────────────────────────────────────────────────────
async function flushLogs(): Promise<void> {
  const cfg = await storage.getConfig();
  if (!cfg?.apiKey) return;
  const logs = await storage.getLogQueue();
  if (!logs.length) return;

  try {
    const res = await fetch(`${cfg.baseUrl}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ logs }),
    });
    const resText = await res.text().catch(() => "");
    if (!res.ok) {
      console.warn("[Argus] flushLogs HTTP", res.status, resText.slice(0, 500));
      return;
    }
    let accepted = -1;
    try {
      const j = JSON.parse(resText) as { accepted?: number };
      accepted = typeof j.accepted === "number" ? j.accepted : -1;
    } catch {
      console.warn("[Argus] flushLogs: response was not JSON", resText.slice(0, 200));
      return;
    }
    if (accepted !== logs.length) {
      console.warn(
        "[Argus] flushLogs: server accepted",
        accepted,
        "of",
        logs.length,
        "— dropping stale rejected entries; body:",
        resText.slice(0, 300),
      );
    }
    await storage.clearLogQueue();
  } catch (e) {
    console.warn("[Argus] flushLogs failed", e);
  }
}

async function flushInteractions(): Promise<void> {
  const cfg = await storage.getConfig();
  if (!cfg?.apiKey) return;
  const interactions = await storage.getInteractionQueue();
  if (!interactions.length) return;

  try {
    const res = await fetch(`${cfg.baseUrl}/api/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ interactions }),
    });
    const resText = await res.text().catch(() => "");
    if (!res.ok) {
      console.warn("[Argus] flushInteractions HTTP", res.status, resText.slice(0, 500));
      return;
    }
    let accepted = -1;
    try {
      const j = JSON.parse(resText) as { accepted?: number };
      accepted = typeof j.accepted === "number" ? j.accepted : -1;
    } catch {
      console.warn("[Argus] flushInteractions: response was not JSON", resText.slice(0, 200));
      return;
    }
    if (accepted !== interactions.length) {
      console.warn(
        "[Argus] flushInteractions: server accepted",
        accepted,
        "of",
        interactions.length,
      );
    }
    await storage.clearInteractionQueue();
  } catch (e) {
    console.warn("[Argus] flushInteractions failed", e);
  }
}

// ── Message bus ──────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "syncNow") {
    syncRules()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.action === "flushNow") {
    Promise.all([flushLogs(), flushInteractions()])
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.action === "setEnabled") {
    storage.setEnabled(msg.value).then(() => {
      broadcastToTabs({ action: "enabledChanged", value: msg.value });
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.action === "saveConfig") {
    storage.setConfig(msg.config).then(() => {
      syncRules().then(() => sendResponse({ ok: true }));
    });
    return true;
  }
  if (msg.action === "queueLog") {
    if (!shouldAcceptQueuedLog(msg.entry)) {
      sendResponse({ ok: true, deduped: true });
      return false;
    }
    if (msg.entry?.action === "flag") pulseFlagBadge(sender.tab?.id);
    storage
      .queueLog(msg.entry)
      .then(() => flushLogs())
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.action === "queueInteraction") {
    if (!shouldAcceptQueuedInteraction(msg.entry)) {
      sendResponse({ ok: true, deduped: true });
      return false;
    }
    storage
      .queueInteraction(msg.entry)
      .then(() => flushInteractions())
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.action === "injectMainWorld") {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      sendResponse({ ok: false, error: "no-tab" });
      return false;
    }
    injectArgusMainWorld(tabId, sender.frameId)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => {
        console.warn("[Argus] injectMainWorld failed", e);
        sendResponse({ ok: false, error: String(e) });
      });
    return true;
  }
});

function broadcastRulesUpdated(): void {
  broadcastToTabs({ action: "rulesUpdated" });
}

function broadcastToTabs(msg: object): void {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    }
  });
}
