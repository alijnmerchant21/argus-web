/**
 * DOM-level send interception (argus1-style).
 * Fixes: Shadow DOM (composedPath), visible composer (no offsetParent), rule shape coercion, eager storage hydrate.
 */
import { evaluateInputRules } from "../shared/ruleEvaluation";
import { normalizeRulesFromStorage } from "../shared/normalizeRules";
import type { Rule, RuleAction } from "../shared/types";
import { identifyAIPlatformForHost, isCurrentPageAISurface } from "../shared/aiAwareness";

const KEYS = { rules: "argus_rules", enabled: "argus_enabled" } as const;

let guardRules: Rule[] = [];
let guardEnabled = true;
let bypassOnce = false;
let transcriptObserverStarted = false;
const seenTranscript = new Map<string, number>();

function fingerprint(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 500);
}

function publishDomGuardEvent(rule: Rule, action: RuleAction, prompt: string): void {
  window.postMessage(
    {
      source: "argus-isolated",
      type: "dom-guard-event",
      payload: {
        ruleId: String(rule.id ?? "").trim(),
        action,
        promptKey: fingerprint(prompt),
        until: Date.now() + 12000,
      },
    },
    "*",
  );
}

export function setDomGuardState(rules: Rule[], enabled: boolean): void {
  guardRules = normalizeRulesFromStorage(rules);
  guardEnabled = enabled;
}

function platformFromHost(): string {
  return identifyAIPlatformForHost(location.hostname) ?? "ai";
}

function shouldRunDomGuard(): boolean {
  return guardEnabled && guardRules.length > 0 && isCurrentPageAISurface();
}

function queueDomLog(rule: Rule, action: RuleAction, prompt: string, matchedKw: string): void {
  const ruleId = String(rule.id ?? "").trim();
  if (!ruleId) {
    console.warn("[Argus] Skipping log: rule has empty id");
    return;
  }
  void chrome.runtime
    .sendMessage({
      action: "queueLog",
      entry: {
        rule_id: ruleId,
        rule_title: rule.title,
        action,
        matched_kw: matchedKw,
        platform: platformFromHost(),
        prompt_text: prompt.slice(0, 20000),
        created_at: Date.now(),
      },
    })
    .catch(() => {});
}

function queueAIInteraction(side: "input" | "output", content: string): void {
  const text = content.trim();
  if (!text || text.length < 2) return;
  void chrome.runtime
    .sendMessage({
      action: "queueInteraction",
      entry: {
        side,
        platform: platformFromHost(),
        url: location.href,
        content: text.slice(0, 20000),
        created_at: Date.now(),
      },
    })
    .catch(() => {});
}

function inferMessageSide(el: Element): "input" | "output" | null {
  const roleNode = el.closest("[data-message-author-role]");
  const role = roleNode?.getAttribute("data-message-author-role")?.toLowerCase();
  if (role === "user") return "input";
  if (role === "assistant" || role === "model") return "output";

  const label = [
    el.getAttribute("aria-label"),
    el.getAttribute("data-testid"),
    el.className,
    el.parentElement?.getAttribute("aria-label"),
    el.parentElement?.className,
  ]
    .join(" ")
    .toLowerCase();
  if (/\b(user|human|prompt)\b/.test(label)) return "input";
  if (/\b(assistant|ai|model|response|completion|answer)\b/.test(label)) return "output";
  return null;
}

function transcriptText(el: Element): string {
  const raw = (el as HTMLElement).innerText || el.textContent || "";
  return raw.replace(/\s+/g, " ").trim();
}

function scanVisibleTranscript(): void {
  if (!guardEnabled || !isCurrentPageAISurface()) return;
  const selectors = [
    "[data-message-author-role]",
    "[data-testid*='conversation-turn']",
    "[data-testid*='message']",
    "[data-testid*='response']",
    "[class*='message']",
    "[class*='Message']",
    "[class*='response']",
  ].join(",");

  let candidates: Element[] = [];
  try {
    candidates = Array.from(document.querySelectorAll(selectors));
  } catch {
    return;
  }

  const now = Date.now();
  for (const [key, until] of seenTranscript) {
    if (until <= now) seenTranscript.delete(key);
  }

  for (const el of candidates.slice(-80)) {
    if (!(el instanceof HTMLElement) || !elementLooksUsable(el)) continue;
    const side = inferMessageSide(el);
    if (!side) continue;
    const text = transcriptText(el);
    if (text.length < 8 || text.length > 20000) continue;
    const key = `${side}:${fingerprint(text)}`;
    if ((seenTranscript.get(key) ?? 0) > now) continue;
    seenTranscript.set(key, now + 10 * 60 * 1000);
    queueAIInteraction(side, text);
  }
}

function startTranscriptObserver(): void {
  if (transcriptObserverStarted) return;
  transcriptObserverStarted = true;

  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    window.setTimeout(() => {
      pending = false;
      scanVisibleTranscript();
    }, 1200);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window.setInterval(scanVisibleTranscript, 8000);
  schedule();
}

/** Many modern UIs use flex/grid where offsetParent is null even when visible. */
function elementLooksUsable(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (typeof el.checkVisibility === "function") {
    try {
      return el.checkVisibility({ checkOpacity: true, checkSize: true });
    } catch {
      /* fall through */
    }
  }
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const st = window.getComputedStyle(el);
  if (st.visibility === "hidden" || st.display === "none") return false;
  return true;
}

interface ComposerRef {
  el: HTMLElement;
  getText: () => string;
}

function composerFromNode(n: Node | null): ComposerRef | null {
  if (n instanceof HTMLTextAreaElement) {
    return {
      el: n,
      getText: () => n.value,
    };
  }
  if (n instanceof HTMLElement && n.isContentEditable) {
    const h = n;
    return {
      el: h,
      getText: () => (h.innerText || h.textContent || "").trim(),
    };
  }
  return null;
}

/** Walk event path (includes nodes inside open shadow roots). */
function composerFromComposedPath(ev: Event): ComposerRef | null {
  const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];
  for (const n of path) {
    const c = composerFromNode(n as Node);
    if (c) return c;
  }
  return null;
}

function composerFromTargetBubbles(target: EventTarget | null): ComposerRef | null {
  if (!(target instanceof Node)) return null;
  let el: Node | null = target instanceof Element ? target : null;
  if (target instanceof Text) el = target.parentElement;
  while (el) {
    const c = composerFromNode(el);
    if (c) return c;
    el = el.parentElement;
  }
  return null;
}

function queryShadowAll(root: Document | ShadowRoot, selector: string): Element[] {
  const out: Element[] = [];
  try {
    root.querySelectorAll(selector).forEach((e) => out.push(e));
    root.querySelectorAll("*").forEach((host) => {
      if (host instanceof Element && host.shadowRoot) {
        out.push(...queryShadowAll(host.shadowRoot, selector));
      }
    });
  } catch {
    /* ignore */
  }
  return out;
}

function pickBestComposer(candidates: Element[]): ComposerRef | null {
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (el instanceof HTMLTextAreaElement && elementLooksUsable(el)) {
      return { el, getText: () => el.value };
    }
    if (el.isContentEditable && elementLooksUsable(el)) {
      const h = el;
      return { el: h, getText: () => (h.innerText || h.textContent || "").trim() };
    }
  }
  for (const el of candidates) {
    if (el instanceof HTMLTextAreaElement) {
      return { el, getText: () => el.value };
    }
    if (el instanceof HTMLElement && el.isContentEditable) {
      const h = el;
      return { el: h, getText: () => (h.innerText || h.textContent || "").trim() };
    }
  }
  return null;
}

function findGlobalComposer(): ComposerRef | null {
  const selectors = [
    '#prompt-textarea[contenteditable="true"]',
    "#prompt-textarea",
    "textarea[data-id='root']",
    "textarea#prompt-textarea",
    "textarea[placeholder*='Message' i]",
    "textarea[placeholder*='Ask' i]",
    "[data-testid='composer-text-input']",
    "div.ProseMirror[contenteditable='true']",
    "div[contenteditable='true'][role='textbox']",
    "[contenteditable='true'][data-virtualkeyboard]",
  ];
  for (const sel of selectors) {
    const list = queryShadowAll(document, sel);
    const hit = pickBestComposer(list);
    if (hit) return hit;
    const direct = document.querySelector(sel);
    if (direct) {
      const hit2 = pickBestComposer([direct]);
      if (hit2) return hit2;
    }
  }
  const areas = queryShadowAll(document, "textarea");
  const hit3 = pickBestComposer(areas);
  return hit3;
}

function isLikelySendButton(btn: Element): boolean {
  if (!(btn instanceof HTMLButtonElement) && !(btn instanceof Element)) return false;
  const b = btn as HTMLButtonElement;
  if (b.getAttribute("data-testid") === "send-button") return true;
  if (b.getAttribute("aria-label")?.toLowerCase().includes("send")) return true;
  if (b.querySelector("svg[data-icon='paper-plane'], svg[aria-label*='Send' i]")) return true;
  if (b.id?.toLowerCase().includes("send")) return true;
  return false;
}

function sendButtonFromClick(ev: MouseEvent): Element | null {
  const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];
  for (const n of path) {
    if (!(n instanceof Element)) continue;
    const btn = n.closest("button,[role='button']");
    if (btn && isLikelySendButton(btn)) return btn;
  }
  if (ev.target instanceof Element) {
    const btn = ev.target.closest("button,[role='button']");
    if (btn && isLikelySendButton(btn)) return btn;
  }
  return null;
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
  publishDomGuardEvent(rule, "block", prompt);
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
  publishDomGuardEvent(rule, "warn", prompt);
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
  publishDomGuardEvent(rule, "flag", prompt);
  clearDomOverlays();
  const wrap = document.createElement("div");
  wrap.setAttribute("data-argus-dom-ui", "flag");
  wrap.style.cssText =
    "position:fixed;right:20px;bottom:20px;display:flex;align-items:center;gap:8px;max-width:min(320px,calc(100vw - 32px));background:#eff6ff;border:1px solid #93c5fd;border-radius:999px;padding:9px 12px;box-shadow:0 8px 24px rgba(15,23,42,.16);z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1d4ed8;font-size:12px;font-weight:650;";
  wrap.innerHTML = `<span aria-hidden="true" style="display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:#dbeafe;color:#1d4ed8">⚑</span><span>Argus flagged <strong>${esc(rule.title)}</strong>${matchedKw ? ` · ${esc(matchedKw)}` : ""}</span>`;
  document.body.appendChild(wrap);
  window.setTimeout(() => wrap.remove(), 5000);
  queueDomLog(rule, "flag", prompt, matchedKw);
}

function fireSyntheticEnter(composer: ComposerRef | null): void {
  bypassOnce = true;
  const el = composer?.el ?? document.activeElement;
  if (el instanceof HTMLElement && (el.isContentEditable || el instanceof HTMLTextAreaElement)) {
    el.focus();
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    return;
  }
  const fb = findGlobalComposer();
  if (fb) {
    fb.el.focus();
    fb.el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  }
}

function clickGlobalSend(): void {
  bypassOnce = true;
  const candidates = queryShadowAll(
    document,
    'button[data-testid="send-button"],button[aria-label*="Send" i],[role="button"][aria-label*="Send" i]',
  );
  for (const c of candidates) {
    if (c instanceof HTMLElement && elementLooksUsable(c)) {
      c.click();
      return;
    }
  }
  const btn = document.querySelector('button[data-testid="send-button"]');
  if (btn instanceof HTMLElement) btn.click();
}

async function handleMatch(
  result: { matched: true; rule: Rule; matchedKeywords?: string[] },
  prompt: string,
  ev: Event,
  composerHint: ComposerRef | null,
): Promise<void> {
  try {
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
        if (ev.type === "keydown") fireSyntheticEnter(composerHint);
        else clickGlobalSend();
      }
    }
  } catch (e) {
    console.error("[Argus] dom guard error", e);
  }
}

function onKeyDownCapture(ev: KeyboardEvent): void {
  if (!shouldRunDomGuard()) return;
  if (bypassOnce) {
    bypassOnce = false;
    return;
  }
  if (ev.key !== "Enter" || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;

  const comp = composerFromComposedPath(ev) ?? composerFromTargetBubbles(ev.target);
  if (!comp) return;
  const text = comp.getText().trim();
  if (!text) return;

  const result = evaluateInputRules(text, guardRules);
  if (!result.matched || !result.rule) return;
  void handleMatch(
    { matched: true, rule: result.rule, matchedKeywords: result.matchedKeywords },
    text,
    ev,
    comp,
  );
}

function onClickCapture(ev: MouseEvent): void {
  if (!shouldRunDomGuard()) return;
  if (bypassOnce) {
    bypassOnce = false;
    return;
  }
  if (!sendButtonFromClick(ev)) return;

  const comp = findGlobalComposer() ?? composerFromComposedPath(ev);
  if (!comp) return;
  const text = comp.getText().trim();
  if (!text) return;

  const result = evaluateInputRules(text, guardRules);
  if (!result.matched || !result.rule) return;
  void handleMatch(
    { matched: true, rule: result.rule, matchedKeywords: result.matchedKeywords },
    text,
    ev,
    comp,
  );
}

function onSubmitCapture(ev: SubmitEvent): void {
  if (!shouldRunDomGuard()) return;
  if (bypassOnce) {
    bypassOnce = false;
    return;
  }
  const form = ev.target;
  let text = "";
  let comp: ComposerRef | null = null;
  if (form instanceof HTMLFormElement) {
    const ta = form.querySelector("textarea");
    const ce = form.querySelector("[contenteditable='true']");
    if (ta instanceof HTMLTextAreaElement) {
      text = ta.value.trim();
      comp = { el: ta, getText: () => ta.value };
    } else if (ce instanceof HTMLElement && ce.isContentEditable) {
      comp = {
        el: ce,
        getText: () => (ce.innerText || ce.textContent || "").trim(),
      };
      text = comp.getText().trim();
    }
  }
  if (!text) {
    comp = findGlobalComposer();
    text = comp?.getText().trim() ?? "";
  }
  if (!text) return;
  const result = evaluateInputRules(text, guardRules);
  if (!result.matched || !result.rule) return;
  void handleMatch(
    { matched: true, rule: result.rule, matchedKeywords: result.matchedKeywords },
    text,
    ev,
    comp,
  );
}

let domListenersStarted = false;

export function startDomSendInterception(): void {
  if (domListenersStarted) return;
  domListenersStarted = true;

  void chrome.storage.local.get([KEYS.rules, KEYS.enabled]).then((data) => {
    setDomGuardState((data[KEYS.rules] as Rule[] | undefined) ?? [], data[KEYS.enabled] !== false);
    console.info(
      `[Argus] DOM guard hydrated — ${guardRules.length} rule(s) — ${location.hostname} — ${isCurrentPageAISurface() ? "ai-surface" : "passive"}`,
    );
  });

  document.addEventListener("keydown", onKeyDownCapture, true);
  document.addEventListener("click", onClickCapture, true);
  document.addEventListener("submit", onSubmitCapture, true);
  startTranscriptObserver();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[KEYS.rules]) {
      guardRules = normalizeRulesFromStorage(changes[KEYS.rules].newValue);
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
