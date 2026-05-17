import type { MatchResult } from "../../shared/types";
import { clearOverlays, escapeHtml, baseOverlay } from "./index";

export function showWarnBanner(result: MatchResult): Promise<boolean> {
  clearOverlays();
  return new Promise((resolve) => {
    const el          = baseOverlay();
    el.setAttribute("data-argus", "warn");
    el.style.border   = "2px solid #f59e0b";
    el.style.background = "#fffbeb";

    el.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="font-size:20px;flex-shrink:0;">⚠️</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:14px;color:#92400e;margin-bottom:4px;">
            Heads up — Argus flagged this
          </div>
          <div style="font-size:13px;color:#374151;margin-bottom:8px;">
            ${escapeHtml(result.rule?.body || "This message matches a guardrail. Are you sure?")}
          </div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:12px;">
            Rule: <strong>${escapeHtml(result.rule?.title ?? "")}</strong>
          </div>
          <div style="display:flex;gap:8px;">
            <button data-argus-cancel style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;background:#fff;font-size:13px;font-weight:600;cursor:pointer;color:#374151;">
              Edit message
            </button>
            <button data-argus-proceed style="flex:1;padding:8px 12px;border-radius:8px;border:none;background:#f59e0b;font-size:13px;font-weight:600;cursor:pointer;color:#fff;">
              Send anyway →
            </button>
          </div>
        </div>
      </div>
    `;

    el.querySelector("[data-argus-cancel]")?.addEventListener("click",  () => { clearOverlays(); resolve(false); });
    el.querySelector("[data-argus-proceed]")?.addEventListener("click", () => { clearOverlays(); resolve(true);  });
    document.body.appendChild(el);
  });
}
