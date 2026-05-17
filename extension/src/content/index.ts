import type { Rule } from "../shared/types";
import { setDomGuardState, startDomSendInterception } from "./domSendInterception";

const KEYS = { rules: "argus_rules", enabled: "argus_enabled" } as const;
const BOOTSTRAP_NODE_ID = "__argus_bootstrap_v1__";

/** Hidden div: same DOM in isolated + main world; avoids MV3 CSP from scripting.executeScript({ func }). */
function publishBootstrapToDom(rules: Rule[], enabled: boolean): void {
  const root = document.documentElement ?? document.body;
  let el = document.getElementById(BOOTSTRAP_NODE_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = BOOTSTRAP_NODE_ID;
    el.setAttribute("hidden", "");
    el.style.display = "none";
    root.appendChild(el);
  }
  el.textContent = JSON.stringify({ rules, enabled });
}

async function loadAndInject(): Promise<void> {
  const data = await chrome.storage.local.get([KEYS.rules, KEYS.enabled]);
  const rules = (data[KEYS.rules] as Rule[] | undefined) ?? [];
  const enabled = data[KEYS.enabled] !== false;

  setDomGuardState(rules, enabled);
  publishBootstrapToDom(rules, enabled);
  console.info(
    `[Argus] isolated script — ${rules.length} rule(s) — ${self === top ? "top" : "iframe"} — ${location.href.slice(0, 96)}`,
  );

  let lastErr: unknown;
  for (let i = 0; i < 5; i++) {
    try {
      const res = (await chrome.runtime.sendMessage({
        action: "injectMainWorld",
      })) as { ok?: boolean; error?: string } | undefined;
      if (res?.ok) {
        lastErr = undefined;
        break;
      }
      lastErr = res?.error ?? res;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 80 * (i + 1)));
  }
  if (lastErr !== undefined) {
    console.warn("[Argus] injectMainWorld:", lastErr);
  }

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
startDomSendInterception();
