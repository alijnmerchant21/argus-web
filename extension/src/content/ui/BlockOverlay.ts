import type { MatchResult } from "../../shared/types";
import { clearOverlays, escapeHtml, baseOverlay } from "./index";

export function showBlockOverlay(result: MatchResult): void {
  clearOverlays();
  const el          = baseOverlay();
  el.setAttribute("data-argus", "block");
  el.style.border   = "2px solid #ef4444";

  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="font-size:20px;flex-shrink:0;">🛡️</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:14px;color:#dc2626;margin-bottom:4px;">
          Blocked by Argus
        </div>
        <div style="font-size:13px;color:#374151;margin-bottom:6px;">
          ${escapeHtml(result.rule?.body || "This message violates a guardrail.")}
        </div>
        <div style="font-size:11px;color:#9ca3af;">
          Rule: <strong>${escapeHtml(result.rule?.title ?? "")}</strong>
          ${result.matchedKeywords?.length ? ` · matched: "<em>${escapeHtml(result.matchedKeywords[0])}</em>"` : ""}
        </div>
      </div>
      <button data-argus-dismiss style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:20px;color:#9ca3af;padding:0;line-height:1;" aria-label="Dismiss">×</button>
    </div>
  `;

  el.querySelector("[data-argus-dismiss]")?.addEventListener("click", clearOverlays);
  document.body.appendChild(el);
}
