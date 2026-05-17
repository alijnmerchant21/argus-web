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
const SYNC_EVERY = 15; // minutes
const FLUSH_EVERY = 2; // minutes

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
        "— check API key / rule ownership; body:",
        resText.slice(0, 300),
      );
      return;
    }
    await storage.clearLogQueue();
  } catch (e) {
    console.warn("[Argus] flushLogs failed", e);
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
    flushLogs()
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
    storage
      .queueLog(msg.entry)
      .then(() => flushLogs())
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
