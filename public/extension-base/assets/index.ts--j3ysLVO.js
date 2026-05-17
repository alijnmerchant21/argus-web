import{s as u}from"./storage-590FxZRO.js";const g={high:3,medium:2,low:1},m={block:3,warn:2,flag:1};function b(r){return r.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function w(r,e){try{return new RegExp(`\\b${b(r.toLowerCase())}\\b`).test(e)}catch{return e.includes(r.toLowerCase())}}function v(r,e,t){const s=r.toLowerCase(),a=e.filter(o=>o.active&&(o.scope===t||o.scope==="both")&&o.keywords.length>0).sort((o,n)=>{const i=g[n.severity]-g[o.severity];return i!==0?i:m[n.action]-m[o.action]});for(const o of a){const n=o.keywords.filter(x=>w(x,s));if(o.match_logic==="all"?n.length===o.keywords.length:n.length>0)return{matched:!0,rule:o,matchedKeywords:n}}return{matched:!1}}function l(){document.querySelectorAll("[data-argus]").forEach(r=>r.remove())}function c(r){return r.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function h(){if(document.getElementById("argus-styles"))return;const r=document.createElement("style");r.id="argus-styles",r.textContent=`
    @keyframes argus-up {
      from { opacity:0; transform:translateX(-50%) translateY(14px); }
      to   { opacity:1; transform:translateX(-50%) translateY(0); }
    }
    @keyframes argus-in { from { opacity:0; } to { opacity:1; } }
  `,document.head.appendChild(r)}function y(){h();const r=document.createElement("div");return r.style.cssText=`
    position:fixed; bottom:88px; left:50%;
    transform:translateX(-50%);
    width:min(480px,calc(100vw - 32px));
    background:#fff; border-radius:16px;
    padding:16px 20px;
    box-shadow:0 8px 32px rgba(0,0,0,0.15);
    z-index:2147483647;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    animation:argus-up .2s ease-out;
  `,r}function k(r){var t,s,a,o;l();const e=y();e.setAttribute("data-argus","block"),e.style.border="2px solid #ef4444",e.innerHTML=`
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="font-size:20px;flex-shrink:0;">🛡️</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:14px;color:#dc2626;margin-bottom:4px;">
          Blocked by Argus
        </div>
        <div style="font-size:13px;color:#374151;margin-bottom:6px;">
          ${c(((t=r.rule)==null?void 0:t.body)||"This message violates a guardrail.")}
        </div>
        <div style="font-size:11px;color:#9ca3af;">
          Rule: <strong>${c(((s=r.rule)==null?void 0:s.title)??"")}</strong>
          ${(a=r.matchedKeywords)!=null&&a.length?` · matched: "<em>${c(r.matchedKeywords[0])}</em>"`:""}
        </div>
      </div>
      <button data-argus-dismiss style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:20px;color:#9ca3af;padding:0;line-height:1;" aria-label="Dismiss">×</button>
    </div>
  `,(o=e.querySelector("[data-argus-dismiss]"))==null||o.addEventListener("click",l),document.body.appendChild(e)}function A(r){return l(),new Promise(e=>{var s,a,o,n;const t=y();t.setAttribute("data-argus","warn"),t.style.border="2px solid #f59e0b",t.style.background="#fffbeb",t.innerHTML=`
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="font-size:20px;flex-shrink:0;">⚠️</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:14px;color:#92400e;margin-bottom:4px;">
            Heads up — Argus flagged this
          </div>
          <div style="font-size:13px;color:#374151;margin-bottom:8px;">
            ${c(((s=r.rule)==null?void 0:s.body)||"This message matches a guardrail. Are you sure?")}
          </div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:12px;">
            Rule: <strong>${c(((a=r.rule)==null?void 0:a.title)??"")}</strong>
          </div>
          <div style="display:flex;gap:8px;">
            <button data-argus-cancel style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;background:#fff;font-size:13px;font-weight:600;cursor:pointer;color:#374151;">
              Edit message
            </button>
            <button data-argus-proceed style="flex:1;padding:8px 12px;border-radius:8px;border:none;background:#f59e0b;font-size:13px;font-weight:600;cursor:pointer;color:#fff;">
              Send anyway →
            </button>
          </div>
        </div>
      </div>
    `,(o=t.querySelector("[data-argus-cancel]"))==null||o.addEventListener("click",()=>{l(),e(!1)}),(n=t.querySelector("[data-argus-proceed]"))==null||n.addEventListener("click",()=>{l(),e(!0)}),document.body.appendChild(t)})}function E(r){var t;h();const e=document.createElement("div");e.setAttribute("data-argus","flag"),e.style.cssText=`
    position:fixed;bottom:20px;right:20px;
    background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
    padding:8px 12px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:12px;color:#64748b;
    box-shadow:0 2px 8px rgba(0,0,0,0.08);
    z-index:2147483647;
    display:flex;align-items:center;gap:6px;
    animation:argus-in .2s ease-out;
  `,e.innerHTML=`<span>🛡️</span><span>Argus logged: <strong>${c(((t=r.rule)==null?void 0:t.title)??"rule")}</strong></span>`,document.body.appendChild(e),setTimeout(()=>e.remove(),4e3)}class f{constructor(){this.rules=[],this.enabled=!0,this.platform="unknown"}async init(){[this.rules,this.enabled]=await Promise.all([u.getRules(),u.isEnabled()]),this.interceptFetch(),this.watchNavigation(),this.attachDomFallback(),chrome.runtime.onMessage.addListener(e=>{e.action==="rulesUpdated"&&u.getRules().then(t=>{this.rules=t}),e.action==="enabledChanged"&&(this.enabled=e.value,this.enabled||l())})}interceptFetch(){const e=this,t=window.fetch.bind(window);window.fetch=async function(s,a){if(e.enabled){const o=typeof s=="string"?s:s instanceof URL?s.href:s.url;if(e.isAIEndpoint(o)&&(a!=null&&a.body)){const n=e.extractPrompt(String(a.body));if(n){const i=v(n,e.rules,"input");if(i.matched&&i.rule&&(await e.handleMatch(i,n),i.rule.action==="block"))throw new Error(`[Argus] Blocked by rule: ${i.rule.title}`)}}}return t(s,a)}}async handleMatch(e,t){if(e.rule){if(e.rule.action==="block"){k(e),await this.log(e,t);return}if(e.rule.action==="warn"){const s=await A(e);if(await this.log(e,t),!s)throw new Error("[Argus] Cancelled by user after warning.");return}e.rule.action==="flag"&&(E(e),await this.log(e,t))}}async log(e,t){var s;e.rule&&await u.queueLog({rule_id:e.rule.id,rule_title:e.rule.title,action:e.rule.action,matched_kw:((s=e.matchedKeywords)==null?void 0:s[0])??"",platform:this.platform,prompt_text:t.slice(0,2e4),created_at:Date.now()})}watchNavigation(){let e=location.href;new MutationObserver(()=>{location.href!==e&&(e=location.href,setTimeout(()=>this.attachDomFallback(),600))}).observe(document,{subtree:!0,childList:!0})}attachDomFallback(){}}class S extends f{constructor(){super(...arguments),this.platform="chatgpt"}isAIEndpoint(e){return e.includes("/backend-api/conversation")||e.includes("/backend-anon/conversation")||e.includes("openai.com/v1/chat/completions")}extractPrompt(e){try{const t=JSON.parse(e),a=[...(t==null?void 0:t.messages)??[]].reverse().find(n=>n.role==="user");if(!a)return null;const o=a.content;return typeof o=="string"?o:Array.isArray(o)?o.filter(n=>n.type==="text").map(n=>n.text).join(" "):null}catch{return null}}}class z extends f{constructor(){super(...arguments),this.platform="claude"}isAIEndpoint(e){return e.includes("claude.ai/api")||e.includes("/chat_conversations")||e.includes("anthropic.com/v1/messages")}extractPrompt(e){try{const t=JSON.parse(e);if(typeof(t==null?void 0:t.prompt)=="string")return t.prompt;const a=[...(t==null?void 0:t.messages)??[]].reverse().find(n=>n.role==="human"||n.role==="user");if(!a)return null;const o=a.content;return typeof o=="string"?o:Array.isArray(o)?o.filter(n=>n.type==="text").map(n=>n.text).join(" "):null}catch{return null}}}class C extends f{constructor(){super(...arguments),this.platform="gemini"}isAIEndpoint(e){return e.includes("gemini.google.com")||e.includes("generativelanguage.googleapis.com")}extractPrompt(e){try{const t=JSON.parse(e),a=[...(t==null?void 0:t.contents)??(t==null?void 0:t.inputs)??[]].reverse().find(n=>!n.role||n.role==="user");return a&&(a.parts??a.content??[]).filter(n=>n.text).map(n=>n.text).join(" ")||null}catch{return null}}}const p=location.hostname;let d=null;p.includes("chatgpt.com")||p.includes("chat.openai.com")?d=new S:p.includes("claude.ai")?d=new z:p.includes("gemini.google.com")&&(d=new C);d==null||d.init().catch(console.error);
