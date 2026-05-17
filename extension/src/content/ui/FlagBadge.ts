import type { MatchResult } from "../../shared/types";
import { escapeHtml, injectStyles } from "./index";

export function showFlagBadge(result: MatchResult): void {
  injectStyles();
  const el          = document.createElement("div");
  el.setAttribute("data-argus", "flag");
  el.style.cssText  = `
    position:fixed;bottom:20px;right:20px;
    background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
    padding:8px 12px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:12px;color:#64748b;
    box-shadow:0 2px 8px rgba(0,0,0,0.08);
    z-index:2147483647;
    display:flex;align-items:center;gap:6px;
    animation:argus-in .2s ease-out;
  `;
  el.innerHTML = `<span>🛡️</span><span>Argus logged: <strong>${escapeHtml(result.rule?.title ?? "rule")}</strong></span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
