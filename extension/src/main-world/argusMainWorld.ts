/**
 * Runs in the page main world (via chrome.scripting + extension file).
 * Uses a shared window.__ARGUS_STATE__ so re-injects only refresh rules — no duplicate listeners/fetch wraps.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { identifyAIPlatformForUrl, isProbablyGenerativeAIRequest } from "../shared/aiAwareness";

const BOOTSTRAP_NODE_ID = "__argus_bootstrap_v1__";
const ACTION_RANK: Record<string, number> = { block: 3, warn: 2, flag: 1 };

declare global {
  interface Window {
    __ARGUS_ORIG_FETCH__?: typeof fetch;
    __ARGUS_STATE__?: { rules: any[]; enabled: boolean };
    __ARGUS_LISTENER_ON__?: boolean;
    __ARGUS_FETCH_ON__?: boolean;
    __ARGUS_XHR_ON__?: boolean;
    __ARGUS_RECENT_DOM_GUARDS__?: Map<string, number>;
    __ARGUS_RECENT_LOGS__?: Map<string, number>;
    __ARGUS_RECENT_INTERACTIONS__?: Map<string, number>;
  }
}

function fingerprint(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 500);
}

function recentKey(ruleId: string, action: string, text: string): string {
  return `${ruleId}::${action}::${text}`;
}

function pruneRecent(map: Map<string, number>, now = Date.now()): void {
  for (const [key, until] of map) {
    if (until <= now) map.delete(key);
  }
}

function wasHandledByDom(rule: any, action: string, prompt: string): boolean {
  const map = window.__ARGUS_RECENT_DOM_GUARDS__;
  if (!map) return false;
  const now = Date.now();
  pruneRecent(map, now);
  return (map.get(recentKey(String(rule?.id ?? ""), action, fingerprint(prompt))) ?? 0) > now;
}

function shouldPostLog(rule: any, action: string, text: string, stableKey?: string): boolean {
  const map = (window.__ARGUS_RECENT_LOGS__ ??= new Map<string, number>());
  const now = Date.now();
  pruneRecent(map, now);
  const key = recentKey(String(rule?.id ?? ""), action, stableKey ?? fingerprint(text));
  if ((map.get(key) ?? 0) > now) return false;
  map.set(key, now + 30000);
  return true;
}

function shouldPostInteraction(side: "input" | "output", text: string, url: string): boolean {
  const map = (window.__ARGUS_RECENT_INTERACTIONS__ ??= new Map<string, number>());
  const now = Date.now();
  pruneRecent(map, now);
  const key = `${side}::${identifyAIPlatformForUrl(url) ?? "ai"}::${fingerprint(text)}`;
  if ((map.get(key) ?? 0) > now) return false;
  map.set(key, now + 30000);
  return true;
}

function extractPrompt(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    const seen = new WeakSet<object>();

    function pushText(value: unknown, out: string[]): void {
      if (typeof value === "string" && value.trim()) out.push(value.trim());
      if (Array.isArray(value)) {
        for (const item of value) pushText(item, out);
        return;
      }
      if (!value || typeof value !== "object") return;
      const obj = value as Record<string, unknown>;
      if (seen.has(obj)) return;
      seen.add(obj);
      if (typeof obj.text === "string") out.push(obj.text.trim());
      if (typeof obj.value === "string") out.push(obj.value.trim());
      if (typeof obj.content === "string") out.push(obj.content.trim());
      if (Array.isArray(obj.parts)) pushText(obj.parts, out);
      if (Array.isArray(obj.content)) pushText(obj.content, out);
    }

    function tryMessages(messages: any[]): string | null {
      if (!messages || !messages.length) return null;
      let last: any = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m && (m.role === "user" || m.role === "human")) {
          last = m;
          break;
        }
      }
      if (!last) return null;
      const out: string[] = [];
      pushText(last.content ?? last.parts ?? last.text, out);
      return out.length ? out.join(" ") : null;
    }

    function deepFindUserText(value: unknown, depth = 0): string | null {
      if (!value || typeof value !== "object" || depth > 8) return null;
      const obj = value as Record<string, unknown>;
      if (seen.has(obj)) return null;
      seen.add(obj);

      const role = String(obj.role ?? (obj.author as any)?.role ?? obj.sender ?? "").toLowerCase();
      if (role === "user" || role === "human") {
        const out: string[] = [];
        pushText(obj.content ?? obj.message ?? obj.text ?? obj.parts, out);
        if (out.length) return out.join(" ");
      }

      const preferred = ["messages", "history", "items", "actions", "conversation", "contents"];
      for (const key of preferred) {
        const child = obj[key];
        if (Array.isArray(child)) {
          for (let i = child.length - 1; i >= 0; i--) {
            const found = deepFindUserText(child[i], depth + 1);
            if (found) return found;
          }
        } else {
          const found = deepFindUserText(child, depth + 1);
          if (found) return found;
        }
      }

      for (const child of Object.values(obj)) {
        const found = deepFindUserText(child, depth + 1);
        if (found) return found;
      }
      return null;
    }

    let p = tryMessages(parsed.messages);
    if (p) return p;
    p = tryMessages(parsed.history?.messages);
    if (p) return p;
    if (typeof parsed.prompt === "string") return parsed.prompt;
    if (typeof parsed.input === "string") return parsed.input;
    if (typeof parsed.text === "string") return parsed.text;
    const actions = parsed.items || parsed.actions || [];
    for (let k = actions.length - 1; k >= 0; k--) {
      const it = actions[k];
      const msg = it && it.message ? it.message : it;
      const role = msg && ((msg.author && msg.author.role) || msg.role);
      if (role === "user" && msg.content?.parts) {
        const parts = msg.content.parts;
        const s: string[] = [];
        for (let x = 0; x < parts.length; x++) if (typeof parts[x] === "string") s.push(parts[x]);
        if (s.length) return s.join("\n");
      }
    }
    p = deepFindUserText(parsed);
    if (p) return p;
  } catch (_) {
    /* ignore */
  }
  return null;
}

function keywordMatches(kw: string, lowerText: string): boolean {
  try {
    return new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(lowerText);
  } catch {
    return lowerText.includes(kw.toLowerCase());
  }
}

function checkText(
  text: string,
  RULES: any[],
  scope: "input" | "output",
): { matched: boolean; rule?: any; action?: string; matchedKeywords?: string[] } {
  const lower = text.toLowerCase();
  const SE: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const AE = ACTION_RANK;
  const applicable = RULES.filter(
    (r: any) =>
      r.active && (r.scope === scope || r.scope === "both") && r.keywords && r.keywords.length,
  ).sort((a: any, b: any) => {
    const sd = (SE[b.severity] || 0) - (SE[a.severity] || 0);
    return sd !== 0 ? sd : (AE[b.action] || 0) - (AE[a.action] || 0);
  });
  for (let i = 0; i < applicable.length; i++) {
    const rule = applicable[i];
    const matched = rule.keywords.filter((k: string) => keywordMatches(k, lower));
    const triggered =
      rule.match_logic === "all" ? matched.length === rule.keywords.length : matched.length > 0;
    if (triggered) {
      const action = matched.reduce<string>((highest, keyword) => {
        const override = rule.keyword_actions?.[String(keyword).toLowerCase()];
        return override && ACTION_RANK[override] > ACTION_RANK[highest] ? override : highest;
      }, rule.action);
      return { matched: true, rule: { ...rule, action }, action, matchedKeywords: matched };
    }
  }
  return { matched: false };
}

function extractAIOutput(body: string): string | null {
  const chunks: string[] = [];

  function add(value: unknown): void {
    if (typeof value === "string" && value.trim()) chunks.push(value.trim());
  }

  function walk(value: unknown, depth = 0): void {
    if (!value || depth > 8) return;
    if (typeof value === "string") return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (typeof value !== "object") return;
    const obj = value as Record<string, unknown>;

    add(obj.output_text);
    add(obj.text);
    add(obj.content);
    add(obj.completion);
    add(obj.answer);
    add(obj.response);
    add((obj.message as any)?.content);
    add((obj.delta as any)?.content);

    if (Array.isArray(obj.parts)) walk(obj.parts, depth + 1);
    if (Array.isArray(obj.content)) walk(obj.content, depth + 1);
    if (Array.isArray(obj.choices)) walk(obj.choices, depth + 1);
    if (Array.isArray(obj.candidates)) walk(obj.candidates, depth + 1);
    if (Array.isArray(obj.output)) walk(obj.output, depth + 1);
    if (Array.isArray(obj.data)) walk(obj.data, depth + 1);
  }

  function parseJsonLine(raw: string): void {
    const line = raw.trim();
    if (!line || line === "[DONE]") return;
    try {
      walk(JSON.parse(line));
    } catch {
      /* ignore non-JSON event lines */
    }
  }

  try {
    walk(JSON.parse(body));
  } catch {
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("data:")) parseJsonLine(line.slice(5));
    }
  }

  const text = chunks.join("\n").trim();
  if (text) return text.slice(0, 20000);
  return null;
}

function platformLabel(url?: string): string {
  return (
    identifyAIPlatformForUrl(url || location.href) ??
    identifyAIPlatformForUrl(location.href) ??
    "ai"
  );
}

function postLog(
  action: string,
  result: any,
  prompt: string,
  url?: string,
  stableKey?: string,
): void {
  const rule = result.rule;
  if (!shouldPostLog(rule, action, prompt, stableKey)) return;
  const mk = (result.matchedKeywords && result.matchedKeywords[0]) || "";
  window.postMessage(
    {
      source: "argus-main",
      type: "argus-log",
      entry: {
        rule_id: rule.id,
        rule_title: rule.title,
        action,
        matched_kw: mk,
        platform: platformLabel(url),
        prompt_text: prompt.slice(0, 20000),
        created_at: Date.now(),
      },
    },
    "*",
  );
}

function postInteraction(side: "input" | "output", content: string, url: string): void {
  const text = content.trim();
  if (!text || !shouldPostInteraction(side, text, url)) return;
  window.postMessage(
    {
      source: "argus-main",
      type: "argus-interaction",
      entry: {
        side,
        platform: platformLabel(url),
        url,
        content: text.slice(0, 20000),
        created_at: Date.now(),
      },
    },
    "*",
  );
}

function resolveToAbsoluteUrl(url: string): string {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

async function interceptIfNeeded(url: string, bodyText: string): Promise<void> {
  const state = window.__ARGUS_STATE__;
  const ENABLED = state?.enabled !== false;
  const RULES = state?.rules ?? [];
  if (!ENABLED) return;
  if (!isProbablyGenerativeAIRequest(url)) return;
  if (!bodyText) return;

  const prompt = extractPrompt(bodyText);
  if (!prompt) return;
  postInteraction("input", prompt, url);
  const result = checkText(prompt, RULES, "input");
  if (!result.matched || !result.rule) return;

  if (wasHandledByDom(result.rule, result.rule.action, prompt)) return;

  postLog(result.rule.action, result, prompt, url);

  if (result.rule.action === "block") {
    throw new Error("[Argus] Blocked: " + result.rule.title);
  }
}

async function inspectOutputIfNeeded(url: string, bodyText: string): Promise<void> {
  const state = window.__ARGUS_STATE__;
  const ENABLED = state?.enabled !== false;
  const RULES = state?.rules ?? [];
  if (!ENABLED) return;
  if (!isProbablyGenerativeAIRequest(url)) return;
  if (!bodyText) return;

  const output = extractAIOutput(bodyText);
  if (!output) return;
  postInteraction("output", output, url);
  const result = checkText(output, RULES, "output");
  if (!result.matched || !result.rule) return;

  if (result.rule.action === "block") {
    postLog("block", result, output, url, `output::${result.matchedKeywords?.[0] ?? ""}`);
    return;
  }
  if (result.rule.action === "warn") {
    postLog("warn", result, output, url, `output::${result.matchedKeywords?.[0] ?? ""}`);
    return;
  }
  if (result.rule.action === "flag") {
    postLog("flag", result, output, url, `output::${result.matchedKeywords?.[0] ?? ""}`);
  }
}

/** Rules JSON lives in a hidden div so we never use executeScript({ func }), which trips MV3 extension CSP. */
function applyBootstrapFromSharedDom(): void {
  window.__ARGUS_STATE__ = window.__ARGUS_STATE__ || {
    rules: [],
    enabled: true,
  };
  const el = document.getElementById(BOOTSTRAP_NODE_ID);
  const raw = el?.textContent?.trim();
  if (!raw) return;
  try {
    const boot = JSON.parse(raw) as { rules?: any[]; enabled?: boolean };
    if (Array.isArray(boot.rules)) window.__ARGUS_STATE__.rules = boot.rules;
    if (typeof boot.enabled === "boolean") window.__ARGUS_STATE__.enabled = boot.enabled;
  } catch {
    /* ignore */
  }
}

function syncFromMessagePayload(payload: any): void {
  const s = window.__ARGUS_STATE__;
  if (!s) return;
  if (payload && Array.isArray(payload.rules)) s.rules = payload.rules;
  if (payload && typeof payload.enabled === "boolean") s.enabled = payload.enabled;
}

try {
  applyBootstrapFromSharedDom();
  const st = window.__ARGUS_STATE__;
  console.info(
    `[Argus] hook ready — ${st?.rules?.length ?? 0} rule(s) — ${self === top ? "top" : "iframe"} — ${location.href.slice(0, 96)}`,
  );

  if (!window.__ARGUS_LISTENER_ON__) {
    window.__ARGUS_LISTENER_ON__ = true;
    window.__ARGUS_RECENT_DOM_GUARDS__ = window.__ARGUS_RECENT_DOM_GUARDS__ ?? new Map();
    window.addEventListener("message", (ev: MessageEvent) => {
      if (ev.source !== window || !ev.data || ev.data.source !== "argus-isolated") return;
      if (ev.data.type === "sync") syncFromMessagePayload(ev.data.payload || {});
      if (ev.data.type === "dom-guard-event") {
        const payload = ev.data.payload || {};
        if (payload.ruleId && payload.action && payload.promptKey) {
          const key = `${payload.ruleId}::${payload.action}::${payload.promptKey}`;
          window.__ARGUS_RECENT_DOM_GUARDS__?.set(key, Number(payload.until) || Date.now() + 12000);
        }
      }
    });
  }

  if (!window.__ARGUS_FETCH_ON__) {
    window.__ARGUS_FETCH_ON__ = true;
    if (!window.__ARGUS_ORIG_FETCH__) {
      window.__ARGUS_ORIG_FETCH__ = window.fetch.bind(window);
    }
    const orig = window.__ARGUS_ORIG_FETCH__!;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let request: Request;
      try {
        request = new Request(input, init);
      } catch {
        return orig(input, init);
      }
      const url = request.url;
      if (!isProbablyGenerativeAIRequest(url)) return orig(request);

      let bodyText = "";
      try {
        bodyText = await request.clone().text();
      } catch {
        return orig(request);
      }

      await interceptIfNeeded(url, bodyText);
      const response = await orig(request);
      void response
        .clone()
        .text()
        .then((text) => inspectOutputIfNeeded(url, text))
        .catch(() => {});
      return response;
    };
  }

  if (!window.__ARGUS_XHR_ON__) {
    window.__ARGUS_XHR_ON__ = true;
    const proto = XMLHttpRequest.prototype as unknown as {
      open: typeof XMLHttpRequest.prototype.open;
      send: typeof XMLHttpRequest.prototype.send;
    };
    const origOpen = proto.open;
    const origSend = proto.send;
    proto.open = function (
      this: XMLHttpRequest,
      ...args: Parameters<typeof XMLHttpRequest.prototype.open>
    ) {
      (this as unknown as { __argus_method?: string; __argus_url?: string }).__argus_method =
        args[0];
      const u = args[1];
      (this as unknown as { __argus_method?: string; __argus_url?: string }).__argus_url =
        typeof u === "string" ? u : (u as URL).href;
      return origOpen.apply(this, args);
    };
    proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      // XHR send completes asynchronously after body inspection, so keep this instance.
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const xhr = this;
      const meta = xhr as unknown as { __argus_method?: string; __argus_url?: string };
      const method = String(meta.__argus_method || "GET").toUpperCase();
      const urlRaw = String(meta.__argus_url || "");
      const absUrl = resolveToAbsoluteUrl(urlRaw);

      void (async () => {
        try {
          if (!["POST", "PUT", "PATCH"].includes(method)) {
            origSend.call(xhr, body);
            return;
          }
          let bodyText = "";
          if (typeof body === "string") bodyText = body;
          else if (body instanceof Blob) bodyText = await body.text();
          else if (body instanceof ArrayBuffer) bodyText = new TextDecoder().decode(body);
          else if (body instanceof URLSearchParams) bodyText = body.toString();

          await interceptIfNeeded(absUrl, bodyText);
          xhr.addEventListener(
            "loadend",
            () => {
              try {
                const text =
                  typeof xhr.responseText === "string"
                    ? xhr.responseText
                    : typeof xhr.response === "string"
                      ? xhr.response
                      : "";
                if (text) void inspectOutputIfNeeded(absUrl, text);
              } catch {
                /* ignore unreadable response types */
              }
            },
            { once: true },
          );
          origSend.call(xhr, body);
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("[Argus]")) {
            try {
              xhr.abort();
            } catch {
              /* ignore */
            }
            return;
          }
          console.warn("[Argus] XHR hook", e);
          origSend.call(xhr, body);
        }
      })();
    };
  }
} catch (e) {
  console.warn("[Argus] main-world hook failed", e);
}
