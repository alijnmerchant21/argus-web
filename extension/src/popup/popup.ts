import { storage } from "../shared/storage";
import type { RuleAction } from "../shared/types";

const ACTION_LABEL: Record<RuleAction, string> = {
  block: "Block",
  warn: "Warn",
  flag: "Flag",
};

const ACTION_TONE: Record<RuleAction, string> = {
  block: "#e11d48",
  warn: "#b45309",
  flag: "#2563eb",
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortKey(apiKey: string): string {
  return `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`;
}

async function render(): Promise<void> {
  const [rules, cfg, enabled] = await Promise.all([
    storage.getRules(),
    storage.getConfig(),
    storage.isEnabled(),
  ]);
  const root = document.getElementById("root")!;
  const activeRules = rules.filter((r) => r.active);
  const logoUrl = chrome.runtime.getURL("argus-logo.png");
  const dashboardUrl = cfg?.baseUrl ?? "http://localhost:3000";

  root.innerHTML = `
    <main class="shell">
      <header class="hero">
        <img class="logo" src="${logoUrl}" alt="Argus" />
        <div class="title">
          <h1>Argus Guardrails</h1>
          <p>AI monitoring for active tabs</p>
        </div>
        <button id="enabled-toggle" class="switch ${enabled ? "on" : ""}" type="button" aria-label="Toggle Argus">
          <span></span>
        </button>
      </header>

      <section class="status ${cfg ? "connected" : "attention"}">
        <div>
          <p class="eyebrow">${cfg ? "Connected" : "Setup needed"}</p>
          <strong>${cfg ? shortKey(cfg.apiKey) : "Paste your dashboard key"}</strong>
        </div>
        <span class="status-dot"></span>
      </section>

      ${
        cfg
          ? ""
          : `<section class="panel config">
              <label>API key</label>
              <input id="api-key-input" type="password" placeholder="argus_..." />
              <label>Dashboard URL</label>
              <input id="base-url-input" type="url" placeholder="http://localhost:3000" />
              <button id="save-config" class="primary" type="button">Save and sync</button>
            </section>`
      }

      <section class="metrics">
        <div><strong>${rules.length}</strong><span>Total rules</span></div>
        <div><strong>${activeRules.length}</strong><span>Active</span></div>
        <div><strong>${enabled ? "On" : "Off"}</strong><span>Protection</span></div>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Active policy</p>
            <h2>What Argus will do</h2>
          </div>
        </div>
        ${
          activeRules.length
            ? `<div class="rule-list">
                ${activeRules
                  .slice(0, 5)
                  .map((rule) => {
                    const action = rule.action as RuleAction;
                    return `<div class="rule-row">
                      <span class="action" style="--tone:${ACTION_TONE[action]}">${ACTION_LABEL[action]}</span>
                      <div>
                        <strong>${esc(rule.title)}</strong>
                        <p>${esc(rule.keywords.slice(0, 3).join(", ") || "No keywords")}</p>
                      </div>
                    </div>`;
                  })
                  .join("")}
              </div>`
            : `<p class="empty">No active rules. Add rules on the dashboard, then sync.</p>`
        }
      </section>

      <section class="panel guide">
        <div><b>Block</b><span>Stops matching sends.</span></div>
        <div><b>Warn</b><span>Asks before sending.</span></div>
        <div><b>Flag</b><span>Logs and marks the tab without interrupting.</span></div>
      </section>

      <footer class="actions">
        <button id="sync-btn" class="secondary" type="button">Sync rules</button>
        <a class="primary" href="${dashboardUrl}/dashboard" target="_blank">Open dashboard</a>
      </footer>

      ${
        cfg
          ? `<button id="disconnect" class="disconnect" type="button">Disconnect this extension</button>`
          : ""
      }
    </main>
  `;

  document.getElementById("enabled-toggle")?.addEventListener("click", async () => {
    const next = !(await storage.isEnabled());
    await chrome.runtime.sendMessage({ action: "setEnabled", value: next });
    render();
  });

  document.getElementById("sync-btn")?.addEventListener("click", async () => {
    const btn = document.getElementById("sync-btn") as HTMLButtonElement;
    btn.textContent = "Syncing...";
    btn.disabled = true;
    await chrome.runtime.sendMessage({ action: "syncNow" });
    render();
  });

  document.getElementById("disconnect")?.addEventListener("click", async () => {
    await chrome.storage.local.clear();
    render();
  });

  document.getElementById("save-config")?.addEventListener("click", async () => {
    const apiKey = (document.getElementById("api-key-input") as HTMLInputElement).value.trim();
    const baseUrl =
      (document.getElementById("base-url-input") as HTMLInputElement).value.trim() ||
      "http://localhost:3000";
    if (!apiKey) return;
    await chrome.runtime.sendMessage({
      action: "saveConfig",
      config: { apiKey, apiBaseUrl: baseUrl },
    });
    render();
  });
}

render().catch(console.error);
