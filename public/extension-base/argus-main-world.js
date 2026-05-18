"use strict";
(() => {
  // src/shared/aiAwareness.ts
  var AI_HOST_RULES = [
    {
      platform: "chatgpt",
      hosts: ["chatgpt.com", "chat.openai.com"],
      suffixes: ["chatgpt.com", "openai.com", "oaistatic.com"]
    },
    {
      platform: "claude",
      hosts: ["claude.ai", "console.anthropic.com"],
      suffixes: ["claude.ai", "anthropic.com"]
    },
    {
      platform: "gemini",
      hosts: ["gemini.google.com", "aistudio.google.com", "generativelanguage.googleapis.com"],
      suffixes: ["generativelanguage.googleapis.com"]
    },
    {
      platform: "copilot",
      hosts: ["copilot.microsoft.com", "sydney.bing.com", "edgeservices.bing.com"],
      suffixes: ["copilot.microsoft.com"]
    },
    { platform: "perplexity", suffixes: ["perplexity.ai"] },
    { platform: "cursor", suffixes: ["cursor.sh", "cursor.com"] },
    { platform: "poe", suffixes: ["poe.com"] },
    { platform: "grok", suffixes: ["grok.com", "x.ai"] },
    { platform: "deepseek", suffixes: ["deepseek.com"] },
    { platform: "mistral", suffixes: ["mistral.ai"] },
    { platform: "cohere", suffixes: ["cohere.ai"] },
    { platform: "openrouter", suffixes: ["openrouter.ai"] },
    { platform: "replicate", suffixes: ["replicate.com"] },
    { platform: "meta-ai", suffixes: ["meta.ai"] },
    { platform: "ollama", suffixes: ["ollama.com"] },
    { platform: "lmstudio", suffixes: ["lmstudio.ai"] },
    {
      platform: "ai",
      suffixes: [
        "character.ai",
        "groq.com",
        "together.ai",
        "fireworks.ai",
        "anyscale.com",
        "huggingface.co",
        "you.com",
        "phind.com",
        "notebooklm.google.com",
        "writesonic.com",
        "jasper.ai",
        "copy.ai",
        "midjourney.com",
        "leonardo.ai",
        "ideogram.ai",
        "runwayml.com",
        "suno.com",
        "udio.com"
      ]
    }
  ];
  var DENY_HOST_SUFFIX = [
    "googletagmanager.com",
    "google-analytics.com",
    "doubleclick.net",
    "facebook.com",
    "hotjar.com"
  ];
  function normalizedHost(host) {
    return host.toLowerCase().replace(/\.$/, "");
  }
  function hostMatches(host, candidate) {
    const h = normalizedHost(host);
    const c = normalizedHost(candidate);
    return h === c || h.endsWith("." + c);
  }
  function hostDenied(host) {
    return DENY_HOST_SUFFIX.some((d) => hostMatches(host, d));
  }
  function identifyAIPlatformForHost(host) {
    const h = normalizedHost(host);
    if (hostDenied(h)) return null;
    for (const rule of AI_HOST_RULES) {
      if (rule.hosts?.some((candidate) => normalizedHost(candidate) === h)) return rule.platform;
      if (rule.suffixes?.some((candidate) => hostMatches(h, candidate))) return rule.platform;
    }
    return null;
  }
  function identifyAIPlatformForUrl(urlStr) {
    try {
      const url = new URL(urlStr, location.href);
      if (!/^https?:$/i.test(url.protocol)) return null;
      return identifyAIPlatformForHost(url.hostname);
    } catch {
      return null;
    }
  }
  function isLikelyStaticAssetUrl(url) {
    const p = url.pathname.toLowerCase();
    return /\.(js|mjs|cjs|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|otf|mp4|webm|mp3|json)(\?|$)/i.test(
      p
    ) || /\/(cdn|assets|static|dist|build|pack|bundle)\//i.test(p);
  }
  function pathSuggestGenerativeApi(url) {
    const path = (url.pathname + url.search).toLowerCase();
    const href = url.href.toLowerCase();
    const strong = [
      /\/chat\/completions?\b/i,
      /\/v\d+\/chat\/completions?\b/i,
      /\/v\d+\/responses\b/i,
      /\/v\d+\/messages\b/i,
      /\/v\d+\/complete\b/i,
      /\/v\d+\/embeddings\b/i,
      /\/generatecontent\b/i,
      /\/models\/[^/?#]+:(generatecontent|streamgeneratecontent|generate|complete|chat|predict)/i,
      /\/backend-api\/conversation/i,
      /\/backend-api\/models/i,
      /\/backend-anon\//i,
      /\/conversations\/[^/]+\/(continue|completion|send|messages?)/i,
      /\/rpc\/gen_?ai/i,
      /\/generative(_|-)?ai\//i,
      /\/llm\/(chat|complete|infer|generate)/i,
      /\/ai\/(chat|complete|generate|messages?)/i,
      /\/gateway\/v\d+\//i,
      /\/inference\//i
    ];
    return strong.some((re) => re.test(path) || re.test(href));
  }
  function isProbablyGenerativeAIRequest(urlStr) {
    let url;
    try {
      url = new URL(urlStr, location.href);
    } catch {
      return false;
    }
    if (!/^https?:$/i.test(url.protocol)) return false;
    const host = normalizedHost(url.hostname);
    if (hostDenied(host)) return false;
    if (isLikelyStaticAssetUrl(url)) return false;
    if (identifyAIPlatformForHost(host)) return true;
    return pathSuggestGenerativeApi(url);
  }

  // src/main-world/argusMainWorld.ts
  var BOOTSTRAP_NODE_ID = "__argus_bootstrap_v1__";
  var ACTION_RANK = { block: 3, warn: 2, flag: 1 };
  function fingerprint(text) {
    return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 500);
  }
  function recentKey(ruleId, action, text) {
    return `${ruleId}::${action}::${text}`;
  }
  function pruneRecent(map, now = Date.now()) {
    for (const [key, until] of map) {
      if (until <= now) map.delete(key);
    }
  }
  function wasHandledByDom(rule, action, prompt) {
    const map = window.__ARGUS_RECENT_DOM_GUARDS__;
    if (!map) return false;
    const now = Date.now();
    pruneRecent(map, now);
    return (map.get(recentKey(String(rule?.id ?? ""), action, fingerprint(prompt))) ?? 0) > now;
  }
  function shouldPostLog(rule, action, text, stableKey) {
    const map = window.__ARGUS_RECENT_LOGS__ ?? (window.__ARGUS_RECENT_LOGS__ = /* @__PURE__ */ new Map());
    const now = Date.now();
    pruneRecent(map, now);
    const key = recentKey(String(rule?.id ?? ""), action, stableKey ?? fingerprint(text));
    if ((map.get(key) ?? 0) > now) return false;
    map.set(key, now + 3e4);
    return true;
  }
  function shouldPostInteraction(side, text, url) {
    const map = window.__ARGUS_RECENT_INTERACTIONS__ ?? (window.__ARGUS_RECENT_INTERACTIONS__ = /* @__PURE__ */ new Map());
    const now = Date.now();
    pruneRecent(map, now);
    const key = `${side}::${identifyAIPlatformForUrl(url) ?? "ai"}::${fingerprint(text)}`;
    if ((map.get(key) ?? 0) > now) return false;
    map.set(key, now + 3e4);
    return true;
  }
  function extractPrompt(body) {
    try {
      let pushText2 = function(value, out) {
        if (typeof value === "string" && value.trim()) out.push(value.trim());
        if (Array.isArray(value)) {
          for (const item of value) pushText2(item, out);
          return;
        }
        if (!value || typeof value !== "object") return;
        const obj = value;
        if (seen.has(obj)) return;
        seen.add(obj);
        if (typeof obj.text === "string") out.push(obj.text.trim());
        if (typeof obj.value === "string") out.push(obj.value.trim());
        if (typeof obj.content === "string") out.push(obj.content.trim());
        if (Array.isArray(obj.parts)) pushText2(obj.parts, out);
        if (Array.isArray(obj.content)) pushText2(obj.content, out);
      }, tryMessages2 = function(messages) {
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
        const out = [];
        pushText2(last.content ?? last.parts ?? last.text, out);
        return out.length ? out.join(" ") : null;
      }, deepFindUserText2 = function(value, depth = 0) {
        if (!value || typeof value !== "object" || depth > 8) return null;
        const obj = value;
        if (seen.has(obj)) return null;
        seen.add(obj);
        const role = String(obj.role ?? obj.author?.role ?? obj.sender ?? "").toLowerCase();
        if (role === "user" || role === "human") {
          const out = [];
          pushText2(obj.content ?? obj.message ?? obj.text ?? obj.parts, out);
          if (out.length) return out.join(" ");
        }
        const preferred = ["messages", "history", "items", "actions", "conversation", "contents"];
        for (const key of preferred) {
          const child = obj[key];
          if (Array.isArray(child)) {
            for (let i = child.length - 1; i >= 0; i--) {
              const found = deepFindUserText2(child[i], depth + 1);
              if (found) return found;
            }
          } else {
            const found = deepFindUserText2(child, depth + 1);
            if (found) return found;
          }
        }
        for (const child of Object.values(obj)) {
          const found = deepFindUserText2(child, depth + 1);
          if (found) return found;
        }
        return null;
      };
      var pushText = pushText2, tryMessages = tryMessages2, deepFindUserText = deepFindUserText2;
      const parsed = JSON.parse(body);
      const seen = /* @__PURE__ */ new WeakSet();
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
          for (let x = 0; x < parts.length; x++) if (typeof parts[x] === "string") s.push(parts[x]);
          if (s.length) return s.join("\n");
        }
      }
      p = deepFindUserText2(parsed);
      if (p) return p;
    } catch (_) {
    }
    return null;
  }
  function keywordMatches(kw, lowerText) {
    try {
      return new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(lowerText);
    } catch {
      return lowerText.includes(kw.toLowerCase());
    }
  }
  function checkText(text, RULES, scope) {
    const lower = text.toLowerCase();
    const SE = { high: 3, medium: 2, low: 1 };
    const AE = ACTION_RANK;
    const applicable = RULES.filter(
      (r) => r.active && (r.scope === scope || r.scope === "both") && r.keywords && r.keywords.length
    ).sort((a, b) => {
      const sd = (SE[b.severity] || 0) - (SE[a.severity] || 0);
      return sd !== 0 ? sd : (AE[b.action] || 0) - (AE[a.action] || 0);
    });
    for (let i = 0; i < applicable.length; i++) {
      const rule = applicable[i];
      const matched = rule.keywords.filter((k) => keywordMatches(k, lower));
      const triggered = rule.match_logic === "all" ? matched.length === rule.keywords.length : matched.length > 0;
      if (triggered) {
        const action = matched.reduce((highest, keyword) => {
          const override = rule.keyword_actions?.[String(keyword).toLowerCase()];
          return override && ACTION_RANK[override] > ACTION_RANK[highest] ? override : highest;
        }, rule.action);
        return { matched: true, rule: { ...rule, action }, action, matchedKeywords: matched };
      }
    }
    return { matched: false };
  }
  function extractAIOutput(body) {
    const chunks = [];
    function add(value) {
      if (typeof value === "string" && value.trim()) chunks.push(value.trim());
    }
    function walk(value, depth = 0) {
      if (!value || depth > 8) return;
      if (typeof value === "string") return;
      if (Array.isArray(value)) {
        for (const item of value) walk(item, depth + 1);
        return;
      }
      if (typeof value !== "object") return;
      const obj = value;
      add(obj.output_text);
      add(obj.text);
      add(obj.content);
      add(obj.completion);
      add(obj.answer);
      add(obj.response);
      add(obj.message?.content);
      add(obj.delta?.content);
      if (Array.isArray(obj.parts)) walk(obj.parts, depth + 1);
      if (Array.isArray(obj.content)) walk(obj.content, depth + 1);
      if (Array.isArray(obj.choices)) walk(obj.choices, depth + 1);
      if (Array.isArray(obj.candidates)) walk(obj.candidates, depth + 1);
      if (Array.isArray(obj.output)) walk(obj.output, depth + 1);
      if (Array.isArray(obj.data)) walk(obj.data, depth + 1);
    }
    function parseJsonLine(raw) {
      const line = raw.trim();
      if (!line || line === "[DONE]") return;
      try {
        walk(JSON.parse(line));
      } catch {
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
    if (text) return text.slice(0, 2e4);
    return null;
  }
  function platformLabel(url) {
    return identifyAIPlatformForUrl(url || location.href) ?? identifyAIPlatformForUrl(location.href) ?? "ai";
  }
  function postLog(action, result, prompt, url, stableKey) {
    const rule = result.rule;
    if (!shouldPostLog(rule, action, prompt, stableKey)) return;
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
          platform: platformLabel(url),
          prompt_text: prompt.slice(0, 2e4),
          created_at: Date.now()
        }
      },
      "*"
    );
  }
  function postInteraction(side, content, url) {
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
          content: text.slice(0, 2e4),
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
    postInteraction("input", prompt, url);
    const result = checkText(prompt, RULES, "input");
    if (!result.matched || !result.rule) return;
    if (wasHandledByDom(result.rule, result.rule.action, prompt)) return;
    postLog(result.rule.action, result, prompt, url);
    if (result.rule.action === "block") {
      throw new Error("[Argus] Blocked: " + result.rule.title);
    }
  }
  async function inspectOutputIfNeeded(url, bodyText) {
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
      window.__ARGUS_RECENT_DOM_GUARDS__ = window.__ARGUS_RECENT_DOM_GUARDS__ ?? /* @__PURE__ */ new Map();
      window.addEventListener("message", (ev) => {
        if (ev.source !== window || !ev.data || ev.data.source !== "argus-isolated") return;
        if (ev.data.type === "sync") syncFromMessagePayload(ev.data.payload || {});
        if (ev.data.type === "dom-guard-event") {
          const payload = ev.data.payload || {};
          if (payload.ruleId && payload.action && payload.promptKey) {
            const key = `${payload.ruleId}::${payload.action}::${payload.promptKey}`;
            window.__ARGUS_RECENT_DOM_GUARDS__?.set(key, Number(payload.until) || Date.now() + 12e3);
          }
        }
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
        const response = await orig(request);
        void response.clone().text().then((text) => inspectOutputIfNeeded(url, text)).catch(() => {
        });
        return response;
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
            else if (body instanceof ArrayBuffer) bodyText = new TextDecoder().decode(body);
            else if (body instanceof URLSearchParams) bodyText = body.toString();
            await interceptIfNeeded(absUrl, bodyText);
            xhr.addEventListener(
              "loadend",
              () => {
                try {
                  const text = typeof xhr.responseText === "string" ? xhr.responseText : typeof xhr.response === "string" ? xhr.response : "";
                  if (text) void inspectOutputIfNeeded(absUrl, text);
                } catch {
                }
              },
              { once: true }
            );
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
