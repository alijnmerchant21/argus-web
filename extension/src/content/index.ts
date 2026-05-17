import { buildMainWorldInjection } from "./buildMainWorldInjection";
import type { Rule } from "../shared/types";

const KEYS = { rules: "argus_rules", enabled: "argus_enabled" } as const;

function injectMainWorld(rules: Rule[], enabled: boolean): void {
  const prev = document.getElementById("argus-main-hook");
  if (prev) prev.remove();
  const el = document.createElement("script");
  el.id = "argus-main-hook";
  el.textContent = buildMainWorldInjection(rules, enabled);
  (document.head ?? document.documentElement).appendChild(el);
  el.remove();
}

async function loadAndInject(): Promise<void> {
  const data = await chrome.storage.local.get([KEYS.rules, KEYS.enabled]);
  const rules = (data[KEYS.rules] as Rule[] | undefined) ?? [];
  const enabled = data[KEYS.enabled] !== false;
  injectMainWorld(rules, enabled);
  window.postMessage(
    { source: "argus-isolated", type: "sync", payload: { rules, enabled } },
    "*",
  );
}

window.addEventListener("message", (ev) => {
  if (ev.source !== window) return;
  const d = ev.data;
  if (!d || d.source !== "argus-main" || d.type !== "argus-log") return;
  chrome.runtime.sendMessage({ action: "queueLog", entry: d.entry });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "rulesUpdated" || msg.action === "enabledChanged") {
    void loadAndInject();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[KEYS.rules] || changes[KEYS.enabled]) {
    void loadAndInject();
  }
});

void loadAndInject();
