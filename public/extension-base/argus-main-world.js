"use strict";
(() => {
  // src/main-world/aiDetection.ts
  var HOST_EXACT = new Set(
    [
      "gemini.google.com",
      "aistudio.google.com",
      "generativelanguage.googleapis.com",
      "copilot.microsoft.com",
      "sydney.bing.com",
      "edgeservices.bing.com",
      "chatgpt.com",
      "chat.openai.com"
    ].map((h) => h.toLowerCase())
  );
  var HOST_SUFFIX_REGISTRY = [
    "openai.com",
    "chatgpt.com",
    "oaistatic.com",
    "anthropic.com",
    "claude.ai",
    "cursor.sh",
    "cursor.com",
    "perplexity.ai",
    "cohere.ai",
    "mistral.ai",
    "grok.com",
    "x.ai",
    "deepseek.com",
    "openrouter.ai",
    "replicate.com",
    "poe.com",
    "character.ai",
    "groq.com",
    "together.ai",
    "fireworks.ai",
    "anyscale.com",
    "meta.ai",
    "lmstudio.ai",
    "ollama.com"
  ];
  var DENY_HOST_SUFFIX = [
    "googletagmanager.com",
    "google-analytics.com",
    "doubleclick.net",
    "facebook.com",
    "hotjar.com"
  ];
  function isLikelyStaticAssetUrl(url) {
    const p = url.pathname.toLowerCase();
    return /\.(js|mjs|cjs|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|otf|mp4|webm|mp3|json)(\?|$)/i.test(
      p
    ) || /\/(cdn|assets|static|dist|build|pack|bundle)\//i.test(p);
  }
  function hostDenied(host) {
    const h = host.toLowerCase();
    return DENY_HOST_SUFFIX.some((d) => h === d || h.endsWith("." + d));
  }
  function hostMatchesRegistry(host) {
    const h = host.toLowerCase();
    if (HOST_EXACT.has(h)) return true;
    for (const suf of HOST_SUFFIX_REGISTRY) {
      if (h === suf || h.endsWith("." + suf)) return true;
    }
    return false;
  }
  function pathSuggestGenerativeApi(url) {
    const path = (url.pathname + url.search).toLowerCase();
    const href = url.href.toLowerCase();
    const strong = [
      /\/chat\/completions?\b/i,
      /\/v\d+\/chat\/completions?\b/i,
      /\/v\d+\/messages\b/i,
      /anthropic\.com\/v\d+\/messages/i,
      /\/generatecontent\b/i,
      /\/models\/[^/?#]+:generate(content|message|answer)/i,
      /\/backend-api\/conversation/i,
      /\/backend-anon\//i,
      /\/conversations\/[^/]+\/(continue|completion|send)/i,
      /\/rpc\/gen_?ai/i,
      /\/generative(_|-)?ai\//i,
      /\/llm\/(chat|complete|infer)/i,
      /openai\.com\/v\d/i,
      /\/gateway\/v\d+\//i
    ];
    return strong.some((re) => re.test(path) || re.test(href));
  }
  function isProbablyGenerativeAIRequest(urlStr) {
    let url;
    try {
      url = new URL(urlStr);
    } catch {
      return false;
    }
    if (!/^https?:$/i.test(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (hostDenied(host)) return false;
    if (isLikelyStaticAssetUrl(url)) return false;
    if (hostMatchesRegistry(host)) return true;
    if (pathSuggestGenerativeApi(url)) return true;
    return false;
  }

  // src/main-world/argusMainWorld.ts
  var BOOTSTRAP_NODE_ID = "__argus_bootstrap_v1__";
  function extractPrompt(body) {
    try {
      let tryMessages2 = function(messages) {
        if (!messages || !messages.length) return null;
        let last = null;
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i];
          if (m && (m.role === "user" || m.role === "human")) {
            last = m;
            break;
          }
        }
        if (!last) return null;
        const c = last.content;
        if (typeof c === "string") return c;
        if (Array.isArray(c)) {
          const out = [];
          for (let j = 0; j < c.length; j++) {
            const p2 = c[j];
            if (p2 && p2.type === "text" && p2.text) out.push(p2.text);
          }
          return out.length ? out.join(" ") : null;
        }
        return null;
      };
      var tryMessages = tryMessages2;
      const parsed = JSON.parse(body);
      let p = tryMessages2(parsed.messages);
      if (p) return p;
      p = tryMessages2(parsed.history?.messages);
      if (p) return p;
      if (typeof parsed.prompt === "string") return parsed.prompt;
      if (typeof parsed.input === "string") return parsed.input;
      if (typeof parsed.text === "string") return parsed.text;
      const actions = parsed.items || parsed.actions || [];
      for (let k = actions.length - 1; k >= 0; k--) {
        const it = actions[k];
        const msg = it && it.message ? it.message : it;
        const role = msg && (msg.author && msg.author.role || msg.role);
        if (role === "user" && msg.content?.parts) {
          const parts = msg.content.parts;
          const s = [];
          for (let x = 0; x < parts.length; x++)
            if (typeof parts[x] === "string") s.push(parts[x]);
          if (s.length) return s.join("\n");
        }
      }
    } catch (_) {
    }
    return null;
  }
  function keywordMatches(kw, lowerText) {
    try {
      return new RegExp(
        "\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b"
      ).test(lowerText);
    } catch {
      return lowerText.includes(kw.toLowerCase());
    }
  }
  function checkText(text, RULES) {
    const lower = text.toLowerCase();
    const SE = { high: 3, medium: 2, low: 1 };
    const AE = { block: 3, warn: 2, flag: 1 };
    const applicable = RULES.filter(
      (r) => r.active && (r.scope === "input" || r.scope === "both") && r.keywords && r.keywords.length
    ).sort((a, b) => {
      const sd = (SE[b.severity] || 0) - (SE[a.severity] || 0);
      return sd !== 0 ? sd : (AE[b.action] || 0) - (AE[a.action] || 0);
    });
    for (let i = 0; i < applicable.length; i++) {
      const rule = applicable[i];
      const matched = rule.keywords.filter((k) => keywordMatches(k, lower));
      const triggered = rule.match_logic === "all" ? matched.length === rule.keywords.length : matched.length > 0;
      if (triggered) return { matched: true, rule, matchedKeywords: matched };
    }
    return { matched: false };
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function clearOverlays() {
    document.querySelectorAll("[data-argus]").forEach((el) => el.remove());
  }
  function injectStyles() {
    if (document.getElementById("argus-styles")) return;
    const st = document.createElement("style");
    st.id = "argus-styles";
    st.textContent = "@keyframes argus-up{from{opacity:0;transform:translateX(-50%) translateY(14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes argus-in{from{opacity:0}to{opacity:1}}";
    document.head.appendChild(st);
  }
  function baseOverlay() {
    injectStyles();
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;bottom:88px;left:50%;transform:translateX(-50%);width:min(480px,calc(100vw - 32px));background:#fff;border-radius:16px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;animation:argus-up .2s ease-out";
    return el;
  }
  function showBlock(result) {
    clearOverlays();
    const el = baseOverlay();
    el.setAttribute("data-argus", "block");
    el.style.border = "2px solid #ef4444";
    const rule = result.rule;
    const mk = result.matchedKeywords && result.matchedKeywords[0];
    el.innerHTML = '<div style="display:flex;align-items:flex-start;gap:12px"><div style="font-size:20px;flex-shrink:0">\u{1F6E1}\uFE0F</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;color:#dc2626;margin-bottom:4px">Blocked by Argus</div><div style="font-size:13px;color:#374151;margin-bottom:6px">' + esc(rule?.body || "This message violates a guardrail.") + '</div><div style="font-size:11px;color:#9ca3af">Rule: <strong>' + esc(rule?.title || "") + "</strong>" + (mk ? ' \xB7 matched: "<em>' + esc(mk) + '</em>"' : "") + '</div></div><button data-argus-dismiss style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:20px;color:#9ca3af;padding:0;line-height:1" aria-label="Dismiss">\xD7</button></div>';
    el.querySelector("[data-argus-dismiss]")?.addEventListener("click", clearOverlays);
    document.body.appendChild(el);
  }
  function showWarn(result) {
    return new Promise((resolve) => {
      clearOverlays();
      const el = baseOverlay();
      el.setAttribute("data-argus", "warn");
      el.style.border = "2px solid #f59e0b";
      el.style.background = "#fffbeb";
      const rule = result.rule;
      el.innerHTML = '<div style="display:flex;align-items:flex-start;gap:12px"><div style="font-size:20px;flex-shrink:0">\u26A0\uFE0F</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;color:#92400e;margin-bottom:4px">Heads up \u2014 Argus flagged this</div><div style="font-size:13px;color:#374151;margin-bottom:8px">' + esc(rule?.body || "This message matches a guardrail. Are you sure?") + '</div><div style="font-size:11px;color:#9ca3af;margin-bottom:12px">Rule: <strong>' + esc(rule?.title || "") + '</strong></div><div style="display:flex;gap:8px"><button data-argus-cancel style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;background:#fff;font-size:13px;font-weight:600;cursor:pointer;color:#374151">Edit message</button><button data-argus-proceed style="flex:1;padding:8px 12px;border-radius:8px;border:none;background:#f59e0b;font-size:13px;font-weight:600;cursor:pointer;color:#fff">Send anyway \u2192</button></div></div></div>';
      el.querySelector("[data-argus-cancel]")?.addEventListener("click", () => {
        clearOverlays();
        resolve(false);
      });
      el.querySelector("[data-argus-proceed]")?.addEventListener("click", () => {
        clearOverlays();
        resolve(true);
      });
      document.body.appendChild(el);
    });
  }
  function showFlag(result) {
    injectStyles();
    const el = document.createElement("div");
    el.setAttribute("data-argus", "flag");
    el.style.cssText = "position:fixed;bottom:20px;right:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#64748b;box-shadow:0 2px 8px rgba(0,0,0,0.08);z-index:2147483647;display:flex;align-items:center;gap:6px;animation:argus-in .2s ease-out";
    el.innerHTML = "<span>\u{1F6E1}\uFE0F</span><span>Argus logged: <strong>" + esc(result.rule?.title || "rule") + "</strong></span>";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4e3);
  }
  function platformLabel() {
    const h = location.hostname;
    if (h.includes("claude")) return "claude";
    if (h.includes("gemini")) return "gemini";
    return "chatgpt";
  }
  function postLog(action, result, prompt) {
    const rule = result.rule;
    const mk = result.matchedKeywords && result.matchedKeywords[0] || "";
    window.postMessage(
      {
        source: "argus-main",
        type: "argus-log",
        entry: {
          rule_id: rule.id,
          rule_title: rule.title,
          action,
          matched_kw: mk,
          platform: platformLabel(),
          prompt_text: prompt.slice(0, 2e4),
          created_at: Date.now()
        }
      },
      "*"
    );
  }
  function resolveToAbsoluteUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch {
      return url;
    }
  }
  async function interceptIfNeeded(url, bodyText) {
    const state = window.__ARGUS_STATE__;
    const ENABLED = state?.enabled !== false;
    const RULES = state?.rules ?? [];
    if (!ENABLED) return;
    if (!isProbablyGenerativeAIRequest(url)) return;
    if (!bodyText) return;
    const prompt = extractPrompt(bodyText);
    if (!prompt) return;
    const result = checkText(prompt, RULES);
    if (!result.matched || !result.rule) return;
    if (result.rule.action === "block") {
      showBlock(result);
      postLog("block", result, prompt);
      throw new Error("[Argus] Blocked: " + result.rule.title);
    }
    if (result.rule.action === "warn") {
      const proceed = await showWarn(result);
      postLog("warn", result, prompt);
      if (!proceed) throw new Error("[Argus] Cancelled after warning");
      return;
    }
    if (result.rule.action === "flag") {
      showFlag(result);
      postLog("flag", result, prompt);
    }
  }
  function applyBootstrapFromSharedDom() {
    window.__ARGUS_STATE__ = window.__ARGUS_STATE__ || {
      rules: [],
      enabled: true
    };
    const el = document.getElementById(BOOTSTRAP_NODE_ID);
    const raw = el?.textContent?.trim();
    if (!raw) return;
    try {
      const boot = JSON.parse(raw);
      if (Array.isArray(boot.rules)) window.__ARGUS_STATE__.rules = boot.rules;
      if (typeof boot.enabled === "boolean") window.__ARGUS_STATE__.enabled = boot.enabled;
    } catch {
    }
  }
  function syncFromMessagePayload(payload) {
    const s = window.__ARGUS_STATE__;
    if (!s) return;
    if (payload && Array.isArray(payload.rules)) s.rules = payload.rules;
    if (payload && typeof payload.enabled === "boolean") s.enabled = payload.enabled;
  }
  try {
    applyBootstrapFromSharedDom();
    const st = window.__ARGUS_STATE__;
    console.info(
      `[Argus] hook ready \u2014 ${st?.rules?.length ?? 0} rule(s) \u2014 ${self === top ? "top" : "iframe"} \u2014 ${location.href.slice(0, 96)}`
    );
    if (!window.__ARGUS_LISTENER_ON__) {
      window.__ARGUS_LISTENER_ON__ = true;
      window.addEventListener("message", (ev) => {
        if (ev.source !== window || !ev.data || ev.data.source !== "argus-isolated") return;
        if (ev.data.type === "sync") syncFromMessagePayload(ev.data.payload || {});
      });
    }
    if (!window.__ARGUS_FETCH_ON__) {
      window.__ARGUS_FETCH_ON__ = true;
      if (!window.__ARGUS_ORIG_FETCH__) {
        window.__ARGUS_ORIG_FETCH__ = window.fetch.bind(window);
      }
      const orig = window.__ARGUS_ORIG_FETCH__;
      window.fetch = async (input, init) => {
        let request;
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
        return orig(request);
      };
    }
    if (!window.__ARGUS_XHR_ON__) {
      window.__ARGUS_XHR_ON__ = true;
      const proto = XMLHttpRequest.prototype;
      const origOpen = proto.open;
      const origSend = proto.send;
      proto.open = function(...args) {
        this.__argus_method = args[0];
        const u = args[1];
        this.__argus_url = typeof u === "string" ? u : u.href;
        return origOpen.apply(this, args);
      };
      proto.send = function(body) {
        const xhr = this;
        const meta = xhr;
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
            else if (body instanceof ArrayBuffer)
              bodyText = new TextDecoder().decode(body);
            else if (body instanceof URLSearchParams) bodyText = body.toString();
            await interceptIfNeeded(absUrl, bodyText);
            origSend.call(xhr, body);
          } catch (e) {
            if (e instanceof Error && e.message.startsWith("[Argus]")) {
              try {
                xhr.abort();
              } catch {
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
})();
