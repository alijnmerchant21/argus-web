import{s as a}from"./storage-590FxZRO.js";(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))s(e);new MutationObserver(e=>{for(const t of e)if(t.type==="childList")for(const r of t.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&s(r)}).observe(document,{childList:!0,subtree:!0});function n(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?t.credentials="include":e.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function s(e){if(e.ep)return;e.ep=!0;const t=n(e);fetch(e.href,t)}})();async function d(){var t,r,p,c;const[l,i,n]=await Promise.all([a.getRules(),a.getConfig(),a.isEnabled()]),s=document.getElementById("root"),e=l.filter(o=>o.active).length;s.innerHTML=`
    <div style="padding:16px;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <div style="font-size:22px;">🛡️</div>
        <div style="font-weight:700;font-size:16px;">Argus Guardrails</div>
        <div style="margin-left:auto;">
          <label id="toggle-label" style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <span style="font-size:12px;color:#64748b;" id="toggle-text">${n?"On":"Off"}</span>
            <div id="switch" style="
              width:36px;height:20px;border-radius:10px;
              background:${n?"#22c55e":"#e2e8f0"};
              position:relative;transition:background .2s;cursor:pointer;
            ">
              <div style="
                width:16px;height:16px;border-radius:50%;background:#fff;
                position:absolute;top:2px;left:${n?"18px":"2px"};
                transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2);
              "></div>
            </div>
          </label>
        </div>
      </div>

      <!-- Stats -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">
          <div style="font-size:22px;font-weight:700;">${l.length}</div>
          <div style="font-size:11px;color:#64748b;">Total rules</div>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">
          <div style="font-size:22px;font-weight:700;color:#22c55e;">${e}</div>
          <div style="font-size:11px;color:#64748b;">Active rules</div>
        </div>
      </div>

      <!-- Config section -->
      ${i?`
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:14px;">✅</span>
          <div>
            <div style="font-size:11px;font-weight:600;color:#15803d;">Connected</div>
            <div style="font-size:10px;color:#64748b;">Key: ${i.apiKey.slice(0,8)}…</div>
          </div>
          <button id="disconnect" style="margin-left:auto;border:1px solid #e2e8f0;background:#fff;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;color:#ef4444;">
            Disconnect
          </button>
        </div>
      `:`
        <div style="background:#fff;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:12px;">
          <div style="font-size:12px;color:#92400e;font-weight:600;margin-bottom:8px;">⚠️ Not configured</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:8px;">Enter your API key from the Argus dashboard.</div>
          <input id="api-key-input" type="password" placeholder="argus_…" style="
            width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;
            font-size:12px;margin-bottom:6px;
          " />
          <input id="base-url-input" type="url" placeholder="https://argus-web.vercel.app" style="
            width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;
            font-size:12px;margin-bottom:8px;
          " />
          <button id="save-config" style="
            width:100%;padding:7px;border:none;border-radius:7px;
            background:#0f172a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;
          ">Save &amp; Sync</button>
        </div>
      `}

      <!-- Actions -->
      <div style="display:flex;gap:8px;">
        <button id="sync-btn" style="
          flex:1;padding:8px;border:1px solid #e2e8f0;border-radius:8px;
          background:#fff;font-size:12px;font-weight:600;cursor:pointer;color:#374151;
        ">↻ Sync rules</button>
        <a href="${(i==null?void 0:i.baseUrl)??"https://argus-web.vercel.app"}/dashboard" target="_blank" style="
          flex:1;padding:8px;border:none;border-radius:8px;
          background:#0f172a;color:#fff;font-size:12px;font-weight:600;
          text-decoration:none;text-align:center;
        ">Open dashboard ↗</a>
      </div>
    </div>
  `,(t=document.getElementById("switch"))==null||t.addEventListener("click",async()=>{const o=!await a.isEnabled();await chrome.runtime.sendMessage({action:"setEnabled",value:o}),d()}),(r=document.getElementById("sync-btn"))==null||r.addEventListener("click",async()=>{const o=document.getElementById("sync-btn");o.textContent="Syncing…",o.disabled=!0,await chrome.runtime.sendMessage({action:"syncNow"}),d()}),(p=document.getElementById("disconnect"))==null||p.addEventListener("click",async()=>{await chrome.storage.local.clear(),d()}),(c=document.getElementById("save-config"))==null||c.addEventListener("click",async()=>{const o=document.getElementById("api-key-input").value.trim(),f=document.getElementById("base-url-input").value.trim()||"https://argus-web.vercel.app";o&&(await chrome.runtime.sendMessage({action:"saveConfig",config:{apiKey:o,apiBaseUrl:f}}),d())})}d().catch(console.error);
