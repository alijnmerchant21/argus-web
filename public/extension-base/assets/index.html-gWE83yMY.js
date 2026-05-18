import{s as d}from"./storage-DOiXk9hX.js";(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))r(e);new MutationObserver(e=>{for(const n of e)if(n.type==="childList")for(const a of n.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&r(a)}).observe(document,{childList:!0,subtree:!0});function c(e){const n={};return e.integrity&&(n.integrity=e.integrity),e.referrerPolicy&&(n.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?n.credentials="include":e.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function r(e){if(e.ep)return;e.ep=!0;const n=c(e);fetch(e.href,n)}})();const y={block:"Block",warn:"Warn",flag:"Flag"},h={block:"#e11d48",warn:"#b45309",flag:"#2563eb"};function m(o){return o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function f(o){return`${o.slice(0,10)}...${o.slice(-4)}`}async function i(){var u,p,g,b;const[o,t,c]=await Promise.all([d.getRules(),d.getConfig(),d.isEnabled()]),r=document.getElementById("root"),e=o.filter(s=>s.active),n=chrome.runtime.getURL("argus-logo.png"),a=(t==null?void 0:t.baseUrl)??"http://localhost:3000";r.innerHTML=`
    <main class="shell">
      <header class="hero">
        <img class="logo" src="${n}" alt="Argus" />
        <div class="title">
          <h1>Argus Guardrails</h1>
          <p>AI monitoring for active tabs</p>
        </div>
        <button id="enabled-toggle" class="switch ${c?"on":""}" type="button" aria-label="Toggle Argus">
          <span></span>
        </button>
      </header>

      <section class="status ${t?"connected":"attention"}">
        <div>
          <p class="eyebrow">${t?"Connected":"Setup needed"}</p>
          <strong>${t?f(t.apiKey):"Paste your dashboard key"}</strong>
        </div>
        <span class="status-dot"></span>
      </section>

      ${t?"":`<section class="panel config">
              <label>API key</label>
              <input id="api-key-input" type="password" placeholder="argus_..." />
              <label>Dashboard URL</label>
              <input id="base-url-input" type="url" placeholder="http://localhost:3000" />
              <button id="save-config" class="primary" type="button">Save and sync</button>
            </section>`}

      <section class="metrics">
        <div><strong>${o.length}</strong><span>Total rules</span></div>
        <div><strong>${e.length}</strong><span>Active</span></div>
        <div><strong>${c?"On":"Off"}</strong><span>Protection</span></div>
      </section>

      <section class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Active policy</p>
            <h2>What Argus will do</h2>
          </div>
        </div>
        ${e.length?`<div class="rule-list">
                ${e.slice(0,5).map(s=>{const l=s.action;return`<div class="rule-row">
                      <span class="action" style="--tone:${h[l]}">${y[l]}</span>
                      <div>
                        <strong>${m(s.title)}</strong>
                        <p>${m(s.keywords.slice(0,3).join(", ")||"No keywords")}</p>
                      </div>
                    </div>`}).join("")}
              </div>`:'<p class="empty">No active rules. Add rules on the dashboard, then sync.</p>'}
      </section>

      <section class="panel guide">
        <div><b>Block</b><span>Stops matching sends.</span></div>
        <div><b>Warn</b><span>Asks before sending.</span></div>
        <div><b>Flag</b><span>Logs and marks the tab without interrupting.</span></div>
      </section>

      <footer class="actions">
        <button id="sync-btn" class="secondary" type="button">Sync rules</button>
        <a class="primary" href="${a}/dashboard" target="_blank">Open dashboard</a>
      </footer>

      ${t?'<button id="disconnect" class="disconnect" type="button">Disconnect this extension</button>':""}
    </main>
  `,(u=document.getElementById("enabled-toggle"))==null||u.addEventListener("click",async()=>{const s=!await d.isEnabled();await chrome.runtime.sendMessage({action:"setEnabled",value:s}),i()}),(p=document.getElementById("sync-btn"))==null||p.addEventListener("click",async()=>{const s=document.getElementById("sync-btn");s.textContent="Syncing...",s.disabled=!0,await chrome.runtime.sendMessage({action:"syncNow"}),i()}),(g=document.getElementById("disconnect"))==null||g.addEventListener("click",async()=>{await chrome.storage.local.clear(),i()}),(b=document.getElementById("save-config"))==null||b.addEventListener("click",async()=>{const s=document.getElementById("api-key-input").value.trim(),l=document.getElementById("base-url-input").value.trim()||"http://localhost:3000";s&&(await chrome.runtime.sendMessage({action:"saveConfig",config:{apiKey:s,apiBaseUrl:l}}),i())})}i().catch(console.error);
