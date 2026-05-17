import { storage } from "../shared/storage";

async function render(): Promise<void> {
  const [rules, cfg, enabled] = await Promise.all([
    storage.getRules(),
    storage.getConfig(),
    storage.isEnabled(),
  ]);
  const root   = document.getElementById("root")!;
  const active = rules.filter((r) => r.active).length;

  const logoUrl = chrome.runtime.getURL("argus-logo.png");

  root.innerHTML = `
    <div style="padding:16px;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <img src="${logoUrl}" alt="" width="36" height="36" style="width:36px;height:36px;object-fit:contain;border-radius:8px;flex-shrink:0;background:#000;" />
        <div style="font-weight:700;font-size:16px;line-height:1.2;">Argus Guardrails</div>
        <div style="margin-left:auto;">
          <label id="toggle-label" style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <span style="font-size:12px;color:#64748b;" id="toggle-text">${enabled ? "On" : "Off"}</span>
            <div id="switch" style="
              width:36px;height:20px;border-radius:10px;
              background:${enabled ? "#22c55e" : "#e2e8f0"};
              position:relative;transition:background .2s;cursor:pointer;
            ">
              <div style="
                width:16px;height:16px;border-radius:50%;background:#fff;
                position:absolute;top:2px;left:${enabled ? "18px" : "2px"};
                transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2);
              "></div>
            </div>
          </label>
        </div>
      </div>

      <!-- Stats -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">
          <div style="font-size:22px;font-weight:700;">${rules.length}</div>
          <div style="font-size:11px;color:#64748b;">Total rules</div>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">
          <div style="font-size:22px;font-weight:700;color:#22c55e;">${active}</div>
          <div style="font-size:11px;color:#64748b;">Active rules</div>
        </div>
      </div>

      <!-- Config section -->
      ${!cfg ? `
        <div style="background:#fff;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:12px;">
          <div style="font-size:12px;color:#92400e;font-weight:600;margin-bottom:8px;">⚠️ Not configured</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:8px;">Enter your API key from the Argus dashboard.</div>
          <input id="api-key-input" type="password" placeholder="argus_…" style="
            width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;
            font-size:12px;margin-bottom:6px;
          " />
          <input id="base-url-input" type="url" placeholder="http://localhost:3000" style="
            width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;
            font-size:12px;margin-bottom:8px;
          " />
          <button id="save-config" style="
            width:100%;padding:7px;border:none;border-radius:7px;
            background:#0f172a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;
          ">Save &amp; Sync</button>
        </div>
      ` : `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:14px;">✅</span>
          <div>
            <div style="font-size:11px;font-weight:600;color:#15803d;">Connected</div>
            <div style="font-size:10px;color:#64748b;">Key: ${cfg.apiKey.slice(0, 8)}…</div>
          </div>
          <button id="disconnect" style="margin-left:auto;border:1px solid #e2e8f0;background:#fff;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;color:#ef4444;">
            Disconnect
          </button>
        </div>
      `}

      <!-- Actions -->
      <div style="display:flex;gap:8px;">
        <button id="sync-btn" style="
          flex:1;padding:8px;border:1px solid #e2e8f0;border-radius:8px;
          background:#fff;font-size:12px;font-weight:600;cursor:pointer;color:#374151;
        ">↻ Sync rules</button>
        <a href="${cfg?.baseUrl ?? "http://localhost:3000"}/dashboard" target="_blank" style="
          flex:1;padding:8px;border:none;border-radius:8px;
          background:#0f172a;color:#fff;font-size:12px;font-weight:600;
          text-decoration:none;text-align:center;
        ">Open dashboard ↗</a>
      </div>
    </div>
  `;

  // Toggle
  document.getElementById("switch")?.addEventListener("click", async () => {
    const next = !(await storage.isEnabled());
    await chrome.runtime.sendMessage({ action: "setEnabled", value: next });
    render();
  });

  // Sync
  document.getElementById("sync-btn")?.addEventListener("click", async () => {
    const btn      = document.getElementById("sync-btn") as HTMLButtonElement;
    btn.textContent = "Syncing…";
    btn.disabled    = true;
    await chrome.runtime.sendMessage({ action: "syncNow" });
    render();
  });

  // Disconnect
  document.getElementById("disconnect")?.addEventListener("click", async () => {
    await chrome.storage.local.clear();
    render();
  });

  // Save config
  document.getElementById("save-config")?.addEventListener("click", async () => {
    const apiKey  = (document.getElementById("api-key-input")  as HTMLInputElement).value.trim();
    const baseUrl = (document.getElementById("base-url-input") as HTMLInputElement).value.trim()
                    || "http://localhost:3000";
    if (!apiKey) return;
    await chrome.runtime.sendMessage({ action: "saveConfig", config: { apiKey, apiBaseUrl: baseUrl } });
    render();
  });
}

render().catch(console.error);
