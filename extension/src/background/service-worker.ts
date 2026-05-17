import { storage } from "../shared/storage";

const SYNC_ALARM  = "argus-sync";
const FLUSH_ALARM = "argus-flush";
const SYNC_EVERY  = 15;  // minutes
const FLUSH_EVERY = 2;   // minutes

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
  chrome.alarms.create(SYNC_ALARM,  { periodInMinutes: SYNC_EVERY  });
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_EVERY });
}

// ── Read config.json and rules.json injected at download time ─────────────────
async function bootstrapFromBundledConfig(): Promise<void> {
  try {
    const configUrl = chrome.runtime.getURL("config.json");
    const rulesUrl  = chrome.runtime.getURL("rules.json");
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
  if (alarm.name === SYNC_ALARM)  await syncRules();
  if (alarm.name === FLUSH_ALARM) await flushLogs();
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
    if (!res.ok) return;
    const rules = await res.json();
    await storage.setRules(rules);
    broadcastRulesUpdated();
  } catch (e) {
    console.warn("[Argus] syncRules failed", e);
  }
}

// ── Log flush ────────────────────────────────────────────────────────────────
async function flushLogs(): Promise<void> {
  const cfg  = await storage.getConfig();
  if (!cfg?.apiKey) return;
  const logs = await storage.drainLogQueue();
  if (!logs.length) return;

  try {
    const res = await fetch(`${cfg.baseUrl}/api/logs`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body:    JSON.stringify({ logs }),
    });
    if (!res.ok) {
      // Put logs back — don't lose them on transient error
      for (const log of logs) await storage.queueLog(log);
    }
  } catch {
    for (const log of logs) await storage.queueLog(log);
  }
}

// ── Message bus ──────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "syncNow") {
    syncRules().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.action === "flushNow") {
    flushLogs().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
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
