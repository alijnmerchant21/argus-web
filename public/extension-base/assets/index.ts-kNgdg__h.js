(function(){function o(e,t){const r=JSON.stringify(e).replace(/</g,"\\u003c"),a=JSON.stringify(t);return`(function(){
try {
  if (!window.__ARGUS_ORIG_FETCH__) { window.__ARGUS_ORIG_FETCH__ = window.fetch.bind(window); }
  var orig = window.__ARGUS_ORIG_FETCH__;
  var RULES = ${r};
  var ENABLED = ${a};

  function sync(state) {
    if (state && Array.isArray(state.rules)) RULES = state.rules;
    if (typeof state.enabled === "boolean") ENABLED = state.enabled;
  }
  window.addEventListener("message", function(ev) {
    if (ev.source !== window || !ev.data || ev.data.source !== "argus-isolated") return;
    if (ev.data.type === "sync") sync(ev.data.payload || {});
  });

  function isAIEndpoint(url) {
    var u = url.toLowerCase();
    if (u.indexOf("chatgpt.com") >= 0 || u.indexOf("chat.openai.com") >= 0 || u.indexOf("oaistatic.com") >= 0) {
      return new RegExp("conversation|backend-api|backend-anon|chat/completions|resumable","i").test(u);
    }
    if (u.indexOf("claude.ai") >= 0) {
      return new RegExp("/api/|anthropic|conversation|messages|chat_conversation","i").test(u);
    }
    if (u.indexOf("gemini.google.com") >= 0 || u.indexOf("generativelanguage.googleapis.com") >= 0) {
      return /batch|generate|chat|conversation|stream/i.test(u);
    }
    return false;
  }

  function extractPrompt(body) {
    try {
      var parsed = JSON.parse(body);
      function tryMessages(messages) {
        if (!messages || !messages.length) return null;
        var last = null;
        for (var i = messages.length - 1; i >= 0; i--) {
          var m = messages[i];
          if (m && (m.role === "user" || m.role === "human")) { last = m; break; }
        }
        if (!last) return null;
        var c = last.content;
        if (typeof c === "string") return c;
        if (Array.isArray(c)) {
          var out = [];
          for (var j = 0; j < c.length; j++) {
            var p = c[j];
            if (p && p.type === "text" && p.text) out.push(p.text);
          }
          return out.length ? out.join(" ") : null;
        }
        return null;
      }
      var p = tryMessages(parsed.messages);
      if (p) return p;
      p = tryMessages(parsed.history && parsed.history.messages);
      if (p) return p;
      if (typeof parsed.prompt === "string") return parsed.prompt;
      if (typeof parsed.input === "string") return parsed.input;
      if (typeof parsed.text === "string") return parsed.text;
      var actions = parsed.items || parsed.actions || [];
      for (var k = actions.length - 1; k >= 0; k--) {
        var it = actions[k];
        var msg = it && it.message ? it.message : it;
        var role = msg && (msg.author && msg.author.role || msg.role);
        if (role === "user" && msg.content && msg.content.parts) {
          var parts = msg.content.parts;
          var s = [];
          for (var x = 0; x < parts.length; x++) if (typeof parts[x] === "string") s.push(parts[x]);
          if (s.length) return s.join("\\n");
        }
      }
    } catch (e) {}
    return null;
  }

  function keywordMatches(kw, lowerText) {
    try {
      return new RegExp("\\\\b" + kw.replace(/[.*+?^\\u0024\\u007B\\u007D()|[\\]\\\\]/g, "\\\\$&") + "\\\\b").test(lowerText);
    } catch (e) {
      return lowerText.indexOf(kw.toLowerCase()) >= 0;
    }
  }

  function checkText(text) {
    var lower = text.toLowerCase();
    var SE = { high: 3, medium: 2, low: 1 };
    var AE = { block: 3, warn: 2, flag: 1 };
    var applicable = RULES.filter(function(r) {
      return r.active && (r.scope === "input" || r.scope === "both") && r.keywords && r.keywords.length;
    }).sort(function(a, b) {
      var sd = (SE[b.severity] || 0) - (SE[a.severity] || 0);
      return sd !== 0 ? sd : (AE[b.action] || 0) - (AE[a.action] || 0);
    });
    for (var i = 0; i < applicable.length; i++) {
      var rule = applicable[i];
      var matched = rule.keywords.filter(function(kw) { return keywordMatches(kw, lower); });
      var triggered = rule.match_logic === "all"
        ? matched.length === rule.keywords.length
        : matched.length > 0;
      if (triggered) return { matched: true, rule: rule, matchedKeywords: matched };
    }
    return { matched: false };
  }

  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function clearOverlays() {
    document.querySelectorAll("[data-argus]").forEach(function(el) { el.remove(); });
  }
  function injectStyles() {
    if (document.getElementById("argus-styles")) return;
    var st = document.createElement("style");
    st.id = "argus-styles";
    st.textContent = "@keyframes argus-up{from{opacity:0;transform:translateX(-50%) translateY(14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes argus-in{from{opacity:0}to{opacity:1}}";
    document.head.appendChild(st);
  }
  function baseOverlay() {
    injectStyles();
    var el = document.createElement("div");
    el.style.cssText = "position:fixed;bottom:88px;left:50%;transform:translateX(-50%);width:min(480px,calc(100vw - 32px));background:#fff;border-radius:16px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;animation:argus-up .2s ease-out";
    return el;
  }
  function showBlock(result) {
    clearOverlays();
    var el = baseOverlay();
    el.setAttribute("data-argus", "block");
    el.style.border = "2px solid #ef4444";
    var rule = result.rule;
    var mk = result.matchedKeywords && result.matchedKeywords[0];
    el.innerHTML = '<div style="display:flex;align-items:flex-start;gap:12px"><div style="font-size:20px;flex-shrink:0">🛡️</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;color:#dc2626;margin-bottom:4px">Blocked by Argus</div><div style="font-size:13px;color:#374151;margin-bottom:6px">' + esc(rule && rule.body || "This message violates a guardrail.") + '</div><div style="font-size:11px;color:#9ca3af">Rule: <strong>' + esc(rule && rule.title || "") + "</strong>" + (mk ? ' · matched: "<em>' + esc(mk) + '</em>"' : "") + '</div></div><button data-argus-dismiss style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:20px;color:#9ca3af;padding:0;line-height:1" aria-label="Dismiss">×</button></div>';
    el.querySelector("[data-argus-dismiss]").addEventListener("click", clearOverlays);
    document.body.appendChild(el);
  }
  function showWarn(result) {
    return new Promise(function(resolve) {
      clearOverlays();
      var el = baseOverlay();
      el.setAttribute("data-argus", "warn");
      el.style.border = "2px solid #f59e0b";
      el.style.background = "#fffbeb";
      var rule = result.rule;
      el.innerHTML = '<div style="display:flex;align-items:flex-start;gap:12px"><div style="font-size:20px;flex-shrink:0">⚠️</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;color:#92400e;margin-bottom:4px">Heads up — Argus flagged this</div><div style="font-size:13px;color:#374151;margin-bottom:8px">' + esc(rule && rule.body || "This message matches a guardrail. Are you sure?") + '</div><div style="font-size:11px;color:#9ca3af;margin-bottom:12px">Rule: <strong>' + esc(rule && rule.title || "") + '</strong></div><div style="display:flex;gap:8px"><button data-argus-cancel style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;background:#fff;font-size:13px;font-weight:600;cursor:pointer;color:#374151">Edit message</button><button data-argus-proceed style="flex:1;padding:8px 12px;border-radius:8px;border:none;background:#f59e0b;font-size:13px;font-weight:600;cursor:pointer;color:#fff">Send anyway →</button></div></div></div>';
      el.querySelector("[data-argus-cancel]").addEventListener("click", function() { clearOverlays(); resolve(false); });
      el.querySelector("[data-argus-proceed]").addEventListener("click", function() { clearOverlays(); resolve(true); });
      document.body.appendChild(el);
    });
  }
  function showFlag(result) {
    injectStyles();
    var el = document.createElement("div");
    el.setAttribute("data-argus", "flag");
    el.style.cssText = "position:fixed;bottom:20px;right:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#64748b;box-shadow:0 2px 8px rgba(0,0,0,0.08);z-index:2147483647;display:flex;align-items:center;gap:6px;animation:argus-in .2s ease-out";
    el.innerHTML = '<span>🛡️</span><span>Argus logged: <strong>' + esc(result.rule && result.rule.title || "rule") + "</strong></span>";
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 4000);
  }

  function platformLabel() {
    var h = location.hostname;
    if (h.indexOf("claude") >= 0) return "claude";
    if (h.indexOf("gemini") >= 0) return "gemini";
    return "chatgpt";
  }

  function postLog(action, result, prompt) {
    var rule = result.rule;
    var mk = result.matchedKeywords && result.matchedKeywords[0] || "";
    window.postMessage({
      source: "argus-main",
      type: "argus-log",
      entry: {
        rule_id: rule.id,
        rule_title: rule.title,
        action: action,
        matched_kw: mk,
        platform: platformLabel(),
        prompt_text: prompt.slice(0, 20000),
        created_at: Date.now()
      }
    }, "*");
  }

  window.fetch = async function(input, init) {
    if (!ENABLED) return orig(input, init);
    var request;
    try { request = new Request(input, init); } catch (e) { return orig(input, init); }
    var url = request.url;
    if (!isAIEndpoint(url)) return orig(request);
    var bodyText = "";
    try { bodyText = await request.clone().text(); } catch (e) { return orig(request); }
    if (!bodyText) return orig(request);
    var prompt = extractPrompt(bodyText);
    if (!prompt) return orig(request);
    var result = checkText(prompt);
    if (!result.matched || !result.rule) return orig(request);

    if (result.rule.action === "block") {
      showBlock(result);
      postLog("block", result, prompt);
      throw new Error("[Argus] Blocked: " + result.rule.title);
    }
    if (result.rule.action === "warn") {
      var proceed = await showWarn(result);
      postLog("warn", result, prompt);
      if (!proceed) throw new Error("[Argus] Cancelled after warning");
      return orig(request);
    }
    if (result.rule.action === "flag") {
      showFlag(result);
      postLog("flag", result, prompt);
    }
    return orig(request);
  };
} catch (e) { console.warn("[Argus] main-world hook failed", e); }
})();`}const s={rules:"argus_rules",enabled:"argus_enabled"};function i(e,t){const r=document.getElementById("argus-main-hook");r&&r.remove();const a=document.createElement("script");a.id="argus-main-hook",a.textContent=o(e,t),(document.head??document.documentElement).appendChild(a),a.remove()}async function n(){const e=await chrome.storage.local.get([s.rules,s.enabled]),t=e[s.rules]??[],r=e[s.enabled]!==!1;i(t,r),window.postMessage({source:"argus-isolated",type:"sync",payload:{rules:t,enabled:r}},"*")}window.addEventListener("message",e=>{if(e.source!==window)return;const t=e.data;!t||t.source!=="argus-main"||t.type!=="argus-log"||chrome.runtime.sendMessage({action:"queueLog",entry:t.entry})});chrome.runtime.onMessage.addListener(e=>{(e.action==="rulesUpdated"||e.action==="enabledChanged")&&n()});chrome.storage.onChanged.addListener((e,t)=>{t==="local"&&(e[s.rules]||e[s.enabled])&&n()});n();
})()
