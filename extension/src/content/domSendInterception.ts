/**
 * DOM-level send interception (argus1-style): capture submit / Enter / send click.
 * Works when network fetch/XHR hooks miss (CSP, workers, opaque clients, etc.).
 */
import { evaluateInputRules } from "../shared/ruleEvaluation";
import type { Rule, RuleAction } from "../shared/types";

const KEYS = { rules: "argus_rules", enabled: "argus_enabled" } as const;

let guardRules: Rule[] = [];
let guardEnabled = true;
/** Next send is allowed through after a successful "warn → proceed". */
let bypassOnce = false;

export function setDomGuardState(rules: Rule[], enabled: boolean): void {
  guardRules = rules;
  guardEnabled = enabled;
}

function platformFromHost(): string {
  const h = location.hostname;
  if (h.includes("claude")) return "claude";
  if (h.includes("gemini")) return "gemini";
  if (h.includes("openai") || h.includes("chatgpt")) return "chatgpt";
  return "web";
}

function queueDomLog(rule: Rule, action: RuleAction, prompt: string, matchedKw: string): void {
  void chrome.runtime.sendMessage({
    action: "queueLog",
    entry: {
      rule_id: rule.id,
      rule_title: rule.title,
      action,
      matched_kw: matchedKw,
      platform: platformFromHost(),
      prompt_text: prompt.slice(0, 20000),
      created_at: Date.now(),
    },
  });
}

interface ComposerRef {
  getText: () => string;
}

function composerFromTarget(target: EventTarget | null): ComposerRef | null {
  if (!(target instanceof Node)) return null;
  let el: Node | null = target instanceof Element ? target : null;
  if (target instanceof Text) el = target.parentElement;
  while (el) {
    if (el instanceof HTMLTextAreaElement) {
      return { getText: () => el!.value };
    }
    if (el instanceof HTMLElement && el.isContentEditable) {
      const h = el;
      return { getText: () => (h.innerText || h.textContent || "").trim() };
    }
    el = el.parentElement;
  }
  return null;
}

function findGlobalComposer(): ComposerRef | null {
  const selectors = [
    '#prompt-textarea[contenteditable="true"]',
    "textarea[data-id='root']",
    "textarea#prompt-textarea",
    "textarea[placeholder*='Message' i]",
    "textarea[placeholder*='Ask' i]",
    "[data-testid='composer-text-input']",
    "div.ProseMirror[contenteditable='true']",
    "div[contenteditable='true'][role='textbox']",
    "textarea",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLTextAreaElement && el.offsetParent !== null) {
      return { getText: () => el.value };
    }
    if (el instanceof HTMLElement && el.isContentEditable && el.offsetParent !== null) {
      const h = el;
      return { getText: () => (h.innerText || h.textContent || "").trim() };
    }
  }
  const ta = document.querySelector("textarea");
  if (ta instanceof HTMLTextAreaElement && ta.offsetParent !== null) {
    return { getText: () => ta.value };
  }
  return null;
}

function isSendButton(el: Element): boolean {
  const btn = el.closest("button");
  if (!btn) return false;
  if (btn.getAttribute("data-testid") === "send-button") return true;
  const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
  if (aria.includes("send")) return true;
  return false;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clearDomOverlays(): void {
  document.querySelectorAll("[data-argus-dom-ui]").forEach((n) => n.remove());
}

function showDomBlock(rule: Rule, matchedKw: string, prompt: string): void {
  clearDomOverlays();
  const wrap = document.createElement("div");
  wrap.setAttribute("data-argus-dom-ui", "block");
  wrap.style.cssText =
    "position:fixed;top:20px;left:50%;transform:translateX(-50%);max-width:480px;width:calc(100vw - 32px);background:#fff;border:2px solid #ef4444;border-radius:16px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,.2);z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
  wrap.innerHTML = `<div style="font-weight:700;color:#dc2626;margin-bottom:6px">Blocked by Argus</div>
    <div style="font-size:13px;color:#374151">${esc(rule.body || "This message violates a guardrail.")}</div>
    <div style="font-size:11px;color:#9ca3af;margin-top:8px">Rule: <strong>${esc(rule.title)}</strong>${matchedKw ? ` · “${esc(matchedKw)}”` : ""}</div>
    <button type="button" data-argus-dismiss style="margin-top:12px;padding:6px 12px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;cursor:pointer;font-size:12px">Dismiss</button>`;
  wrap.querySelector("[data-argus-dismiss]")?.addEventListener("click", () => wrap.remove());
  document.body.appendChild(wrap);
  queueDomLog(rule, "block", prompt, matchedKw);
}

function showDomWarn(rule: Rule, matchedKw: string, prompt: string): Promise<boolean> {
  clearDomOverlays();
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.setAttribute("data-argus-dom-ui", "warn");
    wrap.style.cssText =
      "position:fixed;top:20px;left:50%;transform:translateX(-50%);max-width:480px;width:calc(100vw - 32px);background:#fffbeb;border:2px solid #f59e0b;border-radius:16px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,.2);z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
    wrap.innerHTML = `<div style="font-weight:700;color:#92400e;margin-bottom:6px">Argus warning</div>
      <div style="font-size:13px;color:#374151">${esc(rule.body || "This message matches a guardrail.")}</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:8px">Rule: <strong>${esc(rule.title)}</strong></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button type="button" data-argus-cancel style="flex:1;padding:8px;border-radius:8px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-size:13px;font-weight:600">Edit</button>
        <button type="button" data-argus-ok style="flex:1;padding:8px;border-radius:8px;border:none;background:#f59e0b;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Send anyway</button>
      </div>`;
    wrap.querySelector("[data-argus-cancel]")?.addEventListener("click", () => {
      wrap.remove();
      resolve(false);
    });
    wrap.querySelector("[data-argus-ok]")?.addEventListener("click", () => {
      wrap.remove();
      resolve(true);
    });
    document.body.appendChild(wrap);
    queueDomLog(rule, "warn", prompt, matchedKw);
  });
}

function showDomFlag(rule: Rule, matchedKw: string, prompt: string): void {
  clearDomOverlays();
  const tip = document.createElement("div");
  tip.setAttribute("data-argus-dom-ui", "flag");
  tip.style.cssText =
    "position:fixed;bottom:20px;right:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:12px;color:#64748b;z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
  tip.textContent = `Argus logged: ${rule.title}`;
  document.body.appendChild(tip);
  setTimeout(() => tip.remove(), 4000);
  queueDomLog(rule, "flag", prompt, matchedKw);
}

async function handleMatch(
  result: { matched: true; rule: Rule; matchedKeywords?: string[] },
  prompt: string,
  ev: Event,
): Promise<void> {
  const rule = result.rule;
  const mk = result.matchedKeywords?.[0] ?? "";

  if (rule.action === "flag") {
    showDomFlag(rule, mk, prompt);
    return;
  }

  ev.preventDefault();
  ev.stopPropagation();
  ev.stopImmediatePropagation();

  if (rule.action === "block") {
    showDomBlock(rule, mk, prompt);
    return;
  }
  if (rule.action === "warn") {
    const ok = await showDomWarn(rule, mk, prompt);
    if (ok) {
      bypassOnce = true;
      const target = (ev as KeyboardEvent).target;
      if (ev.type === "keydown" && target instanceof HTMLElement) {
        target.focus();
        target.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
          }),
        );
      } else if (ev.type === "click") {
        const send = document.querySelector('button[data-testid="send-button"]') as
          | HTMLButtonElement
          | undefined;
        send?.click();
      }
    }
  }
}

function onKeyDownCapture(ev: KeyboardEvent): void {
  if (!guardEnabled || guardRules.length === 0) return;
  if (bypassOnce) {
    bypassOnce = false;
    return;
  }
  if (ev.key !== "Enter" || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const comp = composerFromTarget(ev.target);
  if (!comp) return;
  const text = comp.getText().trim();
  if (!text) return;
  const result = evaluateInputRules(text, guardRules);
  if (!result.matched || !result.rule) return;
  void handleMatch(
    { matched: true, rule: result.rule, matchedKeywords: result.matchedKeywords },
    text,
    ev,
  );
}

function onClickCapture(ev: MouseEvent): void {
  if (!guardEnabled || guardRules.length === 0) return;
  if (bypassOnce) {
    bypassOnce = false;
    return;
  }
  if (!(ev.target instanceof Element) || !isSendButton(ev.target)) return;
  const comp = findGlobalComposer();
  if (!comp) return;
  const text = comp.getText().trim();
  if (!text) return;
  const result = evaluateInputRules(text, guardRules);
  if (!result.matched || !result.rule) return;
  void handleMatch(
    { matched: true, rule: result.rule, matchedKeywords: result.matchedKeywords },
    text,
    ev,
  );
}

function onSubmitCapture(ev: SubmitEvent): void {
  if (!guardEnabled || guardRules.length === 0) return;
  if (bypassOnce) {
    bypassOnce = false;
    return;
  }
  const form = ev.target;
  if (!(form instanceof HTMLFormElement)) return;
  const ta = form.querySelector("textarea");
  const ce = form.querySelector('[contenteditable="true"]');
  let text = "";
  if (ta instanceof HTMLTextAreaElement) text = ta.value.trim();
  else if (ce instanceof HTMLElement && ce.isContentEditable)
    text = (ce.innerText || ce.textContent || "").trim();
  if (!text) return;
  const result = evaluateInputRules(text, guardRules);
  if (!result.matched || !result.rule) return;
  void handleMatch(
    { matched: true, rule: result.rule, matchedKeywords: result.matchedKeywords },
    text,
    ev,
  );
}

let domListenersStarted = false;

export function startDomSendInterception(): void {
  if (domListenersStarted) return;
  domListenersStarted = true;
  document.addEventListener("keydown", onKeyDownCapture, true);
  document.addEventListener("click", onClickCapture, true);
  document.addEventListener("submit", onSubmitCapture, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[KEYS.rules]) {
      guardRules = (changes[KEYS.rules].newValue as Rule[] | undefined) ?? [];
    }
    if (changes[KEYS.enabled]) {
      guardEnabled = changes[KEYS.enabled].newValue !== false;
    }
  });

  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      bypassOnce = false;
      clearDomOverlays();
    }
  }, 400);
}
