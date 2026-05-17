export function clearOverlays(): void {
  document.querySelectorAll("[data-argus]").forEach((el) => el.remove());
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function injectStyles(): void {
  if (document.getElementById("argus-styles")) return;
  const style   = document.createElement("style");
  style.id      = "argus-styles";
  style.textContent = `
    @keyframes argus-up {
      from { opacity:0; transform:translateX(-50%) translateY(14px); }
      to   { opacity:1; transform:translateX(-50%) translateY(0); }
    }
    @keyframes argus-in { from { opacity:0; } to { opacity:1; } }
  `;
  document.head.appendChild(style);
}

// Base overlay styles shared by block + warn
export function baseOverlay(): HTMLDivElement {
  injectStyles();
  const el        = document.createElement("div");
  el.style.cssText = `
    position:fixed; bottom:88px; left:50%;
    transform:translateX(-50%);
    width:min(480px,calc(100vw - 32px));
    background:#fff; border-radius:16px;
    padding:16px 20px;
    box-shadow:0 8px 32px rgba(0,0,0,0.15);
    z-index:2147483647;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    animation:argus-up .2s ease-out;
  `;
  return el;
}
