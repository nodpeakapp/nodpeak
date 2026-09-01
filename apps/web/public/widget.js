/*! Nodpeak widget — AGPL-3.0 — https://github.com/nodpeakapp/nodpeak */
"use strict";(()=>{function h(o,e){return`
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.op-root {
  --op-primary: ${o};
  --op-accent: ${e};
  --op-surface: #ffffff;
  --op-text: #18181b;
  --op-muted: #71717a;
  --op-border: #e4e4e7;
  --op-radius: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  color: var(--op-text);
  -webkit-font-smoothing: antialiased;
}

@media (prefers-color-scheme: dark) {
  .op-root {
    --op-surface: #18181b;
    --op-text: #fafafa;
    --op-muted: #a1a1aa;
    --op-border: #3f3f46;
  }
}

/* \u2500\u2500 launcher bubble \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.op-bubble {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 18px; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--op-primary); color: #fff;
  font: inherit; font-weight: 600; font-size: 14px;
  box-shadow: 0 6px 24px -6px rgba(0,0,0,.45);
  transition: transform .15s ease, box-shadow .15s ease;
}
.op-bubble:hover { transform: translateY(-1px); box-shadow: 0 10px 30px -8px rgba(0,0,0,.5); }
.op-bubble:focus-visible { outline: 3px solid var(--op-accent); outline-offset: 2px; }
.op-bubble svg { width: 16px; height: 16px; fill: var(--op-accent); }

/* \u2500\u2500 panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.op-panel {
  position: fixed; right: 20px; bottom: 84px; z-index: 2147483000;
  width: 340px; max-width: calc(100vw - 32px);
  background: var(--op-surface); color: var(--op-text);
  border: 1px solid var(--op-border); border-radius: var(--op-radius);
  box-shadow: 0 20px 60px -20px rgba(0,0,0,.5);
  padding: 20px;
  animation: op-in .18s ease-out both;
}
.op-panel[hidden] { display: none; }
.op-inline .op-panel {
  position: static; width: 100%; max-width: 460px; animation: none;
  box-shadow: none;
}
@keyframes op-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.op-close {
  position: absolute; top: 10px; right: 10px;
  width: 28px; height: 28px; border: 0; border-radius: 8px;
  background: transparent; color: var(--op-muted);
  font-size: 18px; line-height: 1; cursor: pointer;
}
.op-close:hover { background: var(--op-border); }

.op-title { font-size: 17px; font-weight: 700; letter-spacing: -.01em; padding-right: 28px; }
.op-sub { margin-top: 4px; font-size: 13px; color: var(--op-muted); }

/* \u2500\u2500 stars \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.op-stars { display: flex; gap: 4px; margin: 18px 0 4px; }
.op-star {
  border: 0; background: transparent; padding: 2px; cursor: pointer; line-height: 0;
  border-radius: 6px;
}
.op-star svg { width: 30px; height: 30px; fill: var(--op-border); transition: fill .12s ease, transform .12s ease; }
.op-star:hover svg, .op-star.op-on svg { fill: var(--op-accent); }
.op-star:hover svg { transform: scale(1.12); }
.op-star:focus-visible { outline: 2px solid var(--op-accent); outline-offset: 1px; }

.op-agg { font-size: 12px; color: var(--op-muted); }

/* \u2500\u2500 form \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.op-field { margin-top: 12px; }
.op-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.op-input, .op-textarea {
  width: 100%; padding: 10px 12px; font: inherit; font-size: 14px;
  color: var(--op-text); background: transparent;
  border: 1px solid var(--op-border); border-radius: 10px;
}
.op-textarea { min-height: 84px; resize: vertical; }
.op-input:focus, .op-textarea:focus { outline: 2px solid var(--op-accent); outline-offset: -1px; border-color: transparent; }

.op-btn {
  width: 100%; margin-top: 14px; padding: 11px 16px;
  border: 0; border-radius: 10px; cursor: pointer;
  background: var(--op-primary); color: #fff; font: inherit; font-weight: 600; font-size: 14px;
}
.op-btn:disabled { opacity: .55; cursor: not-allowed; }
.op-btn:focus-visible { outline: 3px solid var(--op-accent); outline-offset: 2px; }

.op-cta {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; margin-top: 10px; padding: 11px 16px;
  border: 1px solid var(--op-border); border-radius: 10px;
  background: var(--op-surface); color: var(--op-text);
  font: inherit; font-weight: 600; font-size: 14px; text-decoration: none; cursor: pointer;
}
.op-cta:hover { border-color: var(--op-accent); }
.op-cta svg { width: 16px; height: 16px; }

.op-back { margin-top: 10px; border: 0; background: transparent; color: var(--op-muted); font: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; }
.op-err { margin-top: 10px; font-size: 13px; color: #dc2626; }
.op-ok { margin: 14px 0 4px; font-size: 15px; font-weight: 600; }

.op-badge { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--op-border); font-size: 11px; color: var(--op-muted); text-align: center; }
.op-badge a { color: var(--op-muted); text-decoration: none; font-weight: 600; }
.op-badge a:hover { color: var(--op-accent); }

.op-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 420px) {
  .op-panel { right: 12px; left: 12px; width: auto; bottom: 76px; }
  .op-bubble { right: 12px; bottom: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .op-panel, .op-bubble, .op-star svg { animation: none !important; transition: none !important; }
}

/* \u2500\u2500 announcement bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.op-abar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 2147483001;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 9px 40px 9px 16px; font-size: 13px; font-weight: 600; text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  /* background/color are set inline per-project \u2014 these are the site owner's own brand colours. */
}
.op-abar a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.op-abar-close {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; border: 0; border-radius: 6px; cursor: pointer;
  background: transparent; color: inherit; opacity: .7; font-size: 15px; line-height: 1;
}
.op-abar-close:hover { opacity: 1; background: rgba(0,0,0,.1); }

/* \u2500\u2500 whatsapp button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.op-wa {
  position: fixed; left: 20px; bottom: 20px; z-index: 2147483000;
  display: inline-flex; align-items: center; justify-content: center;
  width: 52px; height: 52px; border: 0; border-radius: 999px; cursor: pointer;
  background: #25D366; color: #fff;
  box-shadow: 0 6px 24px -6px rgba(0,0,0,.45);
  transition: transform .15s ease;
}
.op-wa:hover { transform: translateY(-1px) scale(1.04); }
.op-wa svg { width: 26px; height: 26px; fill: #fff; }
@media (max-width: 420px) { .op-wa { left: 12px; bottom: 12px; width: 48px; height: 48px; } }

/* \u2500\u2500 email capture popup \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.op-ecap {
  position: fixed; inset: 0; z-index: 2147483002;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.55); padding: 20px;
  animation: op-in .18s ease-out both;
}
.op-ecap[hidden] { display: none; }
.op-ecap-card {
  position: relative; width: 100%; max-width: 380px;
  background: var(--op-surface); color: var(--op-text);
  border: 1px solid var(--op-border); border-radius: var(--op-radius);
  padding: 28px 24px 24px; text-align: center;
}
.op-ecap-close {
  position: absolute; top: 10px; right: 10px;
  width: 28px; height: 28px; border: 0; border-radius: 8px;
  background: transparent; color: var(--op-muted); font-size: 18px; cursor: pointer;
}
.op-ecap-close:hover { background: var(--op-border); }
.op-ecap-title { font-size: 19px; font-weight: 700; letter-spacing: -.01em; }
.op-ecap-sub { margin-top: 6px; font-size: 13px; color: var(--op-muted); }
.op-ecap-form { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }

/* \u2500\u2500 trust bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.op-tbar {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 10px 22px; padding: 14px 0;
}
.op-tbar-item { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--op-text); }
.op-tbar-item svg { width: 16px; height: 16px; fill: var(--op-accent); flex-shrink: 0; }

/* \u2500\u2500 testimonials wall \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.op-wall { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
.op-wcard {
  padding: 16px; border: 1px solid var(--op-border); border-radius: 14px;
  background: var(--op-surface); color: var(--op-text);
}
.op-wcard .op-stars { margin: 0 0 8px; }
.op-wcard .op-stars svg { width: 14px; height: 14px; }
.op-wtext { font-size: 13.5px; line-height: 1.55; }
.op-wname { margin-top: 10px; font-size: 12px; font-weight: 600; color: var(--op-muted); }

/* \u2500\u2500 star badge \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.op-badge-inline {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: var(--op-text);
}
.op-badge-inline .op-stars svg { width: 15px; height: 15px; }
.op-badge-inline a { color: inherit; text-decoration: none; }
.op-badge-inline a:hover { text-decoration: underline; }
`}var M,g=(M=document.currentScript)!=null?M:(function(){let o=document.querySelectorAll("script[data-project-id]");return o.length?o[o.length-1]:null})(),L="__nodpeak_loaded__";function E(o){var e;return(e=g==null?void 0:g.getAttribute(o))!=null?e:null}function j(){let o=E("data-api");if(o)return o.replace(/\/+$/,"");try{return new URL(g.src,location.href).origin}catch(e){return location.origin}}var T=E("data-project-id"),b=j();function t(o,e={},n=[]){let i=document.createElement(o);for(let[a,r]of Object.entries(e))r==null||r===!1||(a==="class"?i.className=String(r):a==="html"?i.innerHTML=String(r):a.startsWith("on")&&typeof r=="function"?i.addEventListener(a.slice(2).toLowerCase(),r):i.setAttribute(a,r===!0?"":String(r)));for(let a of n)i.append(a);return i}var I="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.3 6.2 20.4l1.1-6.4L2.6 9.4l6.5-.9z";function f(){let o=document.createElementNS("http://www.w3.org/2000/svg","svg");o.setAttribute("viewBox","0 0 24 24"),o.setAttribute("aria-hidden","true");let e=document.createElementNS("http://www.w3.org/2000/svg","path");return e.setAttribute("d",I),o.append(e),o}function R(o){if(!o.jsonLd)return;let e="nodpeak-jsonld-"+o.projectId;if(document.getElementById(e))return;let n=document.createElement("script");n.type="application/ld+json",n.id=e,n.textContent=o.jsonLd,(document.head||document.documentElement).appendChild(n)}async function N(o){let e=await fetch(b+"/api/v1/widget-config/"+encodeURIComponent(o),{credentials:"omit",mode:"cors"});if(!e.ok)throw new Error("config "+e.status);return await e.json()}async function W(o){let e=await fetch(b+"/api/v1/feedback",{method:"POST",credentials:"omit",mode:"cors",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}),n=await e.json().catch(()=>({}));if(!e.ok)throw new Error(n.error||"Could not send that. Please try again.");return n}async function P(o){let e=await fetch(b+"/api/v1/leads",{method:"POST",credentials:"omit",mode:"cors",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}),n=await e.json().catch(()=>({}));if(!e.ok)throw new Error(n.error||"Could not send that. Please try again.");return n}async function _(o){let e=await fetch(b+"/api/v1/subscribe",{method:"POST",credentials:"omit",mode:"cors",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}),n=await e.json().catch(()=>({}));if(!e.ok)throw new Error(n.error||"Could not subscribe. Please try again.");return n}function C(o,e=""){let n=document.createElement("div");document.body.appendChild(n);let i=n.attachShadow({mode:"open"});i.append(t("style",{html:h(o.primaryColor,o.accentColor)}));let a=t("div",{class:"op-root"+(e?" "+e:"")});return i.append(a),{host:n,shadow:i,root:a}}function w(o){try{return localStorage.getItem(o)}catch(e){return null}}function y(o,e){try{localStorage.setItem(o,e)}catch(n){}}var k=class{constructor(e,n){this.rating=0;this.open=!1;this.config=e,this.host=n!=null?n:document.createElement("div"),n||(this.host.setAttribute("data-nodpeak-widget",""),document.body.appendChild(this.host)),this.shadow=this.host.attachShadow({mode:"open"}),this.shadow.append(t("style",{html:h(e.primaryColor,e.accentColor)})),this.render()}render(){let e=this.config.placement==="inline";this.root=t("div",{class:"op-root"+(e?" op-inline":"")}),this.panel=t("div",{class:"op-panel",role:"dialog","aria-label":this.config.title,hidden:!e}),this.body=t("div"),this.panel.append(this.body),e||(this.panel.append(t("button",{class:"op-close",type:"button","aria-label":"Close",html:"&times;",onclick:()=>this.toggle(!1)})),this.root.append(this.launcher())),this.root.append(this.panel),this.shadow.append(this.root),this.stepRating(),e||document.addEventListener("keydown",n=>{n.key==="Escape"&&this.open&&this.toggle(!1)})}launcher(){let e=t("button",{class:"op-bubble",type:"button","aria-haspopup":"dialog",onclick:()=>this.toggle(!this.open)});return e.append(f(),document.createTextNode("Leave a review")),e}toggle(e){if(this.open=e,this.panel.hidden=!e,e){let n=this.panel.querySelector("button, input, textarea");n==null||n.focus()}}swap(...e){this.body.replaceChildren(...e),this.config.showSeoBadge&&this.body.append(this.badge())}badge(){return t("div",{class:"op-badge"},[t("span",{},["Reviews by "]),t("a",{href:"https://github.com/nodpeakapp/nodpeak",target:"_blank",rel:"noopener noreferrer"},["Nodpeak"])])}stepRating(){let e=t("div",{class:"op-stars",role:"radiogroup","aria-label":"Rating"});for(let r=1;r<=5;r++){let p=t("button",{class:"op-star",type:"button",role:"radio","aria-checked":"false","aria-label":r+(r===1?" star":" stars"),onclick:()=>{this.rating=r,this.stepComment()}});p.append(f()),p.addEventListener("mouseenter",()=>n(r)),e.addEventListener("mouseleave",()=>n(0)),e.append(p)}let n=r=>{e.querySelectorAll(".op-star").forEach((p,s)=>{p.classList.toggle("op-on",s<r)})},i=[t("div",{class:"op-title"},[this.config.title]),t("div",{class:"op-sub"},[this.config.subtitle]),e],a=this.config.aggregate;a&&a.count>0&&i.push(t("div",{class:"op-agg"},[`${a.average.toFixed(1)} average from ${a.count} review${a.count===1?"":"s"}`])),this.swap(...i)}stepComment(){let e=this.rating>=this.config.minStarForExternal,n=e?"What did you love most?":"How can we improve?",i=t("textarea",{class:"op-textarea",id:"op-comment",placeholder:e?"The bit worth telling other people about\u2026":"Tell us what went wrong \u2014 this goes straight to the owner."}),a=t("input",{class:"op-input",id:"op-name",type:"text",placeholder:"Your name (optional)",autocomplete:"name"}),r=t("input",{class:"op-input",id:"op-email",type:"email",placeholder:e?"Email (optional)":"Email so we can put it right",autocomplete:"email"}),p=t("div",{class:"op-err",hidden:!0}),s=t("button",{class:"op-btn",type:"button"},[e?"Continue":"Send privately"]);s.addEventListener("click",async()=>{s.disabled=!0,s.textContent="Sending\u2026",p.hidden=!0;try{let l=await W({projectId:this.config.projectId,rating:this.rating,comment:i.value.trim()||null,customerName:a.value.trim()||null,customerEmail:r.value.trim()||null,sourceUrl:location.href});this.stepDone(l)}catch(l){s.disabled=!1,s.textContent=e?"Continue":"Send privately",p.textContent=l.message,p.hidden=!1}}),this.swap(t("div",{class:"op-title"},[n]),t("div",{class:"op-sub"},[this.config.promptQuestion]),t("div",{class:"op-field"},[t("label",{class:"op-sr",for:"op-comment"},[n]),i]),t("div",{class:"op-field"},[a]),t("div",{class:"op-field"},[r]),s,p,t("button",{class:"op-back",type:"button",onclick:()=>this.stepRating()},["Change my rating"]))}stepDone(e){var r,p;let n=e.redirect,i=(r=n==null?void 0:n.google)!=null?r:null,a=(p=n==null?void 0:n.trustpilot)!=null?p:null;if(i||a){let s=[t("div",{class:"op-ok"},["Thank you \u2014 that means a lot."]),t("div",{class:"op-sub"},["Would you post the same thing where other people will see it? It takes about twenty seconds."])];i&&s.push(t("a",{class:"op-cta",href:i,target:"_blank",rel:"noopener noreferrer"},["Post on Google"])),a&&s.push(t("a",{class:"op-cta",href:a,target:"_blank",rel:"noopener noreferrer"},["Post on Trustpilot"])),s.push(t("button",{class:"op-back",type:"button",onclick:()=>this.toggle(!1)},["No thanks"])),this.swap(...s);return}this.swap(t("div",{class:"op-ok"},["Thank you \u2014 this went straight to the owner."]),t("div",{class:"op-sub"},["Nobody else sees it. If you left an email, expect a reply rather than a form letter."]),t("button",{class:"op-btn",type:"button",onclick:()=>this.toggle(!1)},["Close"]))}};function B(o){let e=o.site;if(!e.announcementEnabled||!e.announcementText)return;let n="nodpeak_abar_dismissed_"+o.projectId;if(w(n))return;let{root:i}=C(o),a=t("div",{class:"op-abar",style:`background:${e.announcementBg};color:${e.announcementFg}`}),r=[document.createTextNode(e.announcementText)];e.announcementLinkUrl&&r.push(t("a",{href:e.announcementLinkUrl,target:"_blank",rel:"noopener noreferrer"},[e.announcementLinkText||"Learn more"])),a.append(...r),a.append(t("button",{class:"op-abar-close",type:"button","aria-label":"Dismiss",html:"&times;",onclick:()=>{y(n,"1"),a.remove()}})),i.append(a)}var F="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.051 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413";function $(){let o=document.createElementNS("http://www.w3.org/2000/svg","svg");o.setAttribute("viewBox","0 0 24 24"),o.setAttribute("aria-hidden","true");let e=document.createElementNS("http://www.w3.org/2000/svg","path");return e.setAttribute("d",F),o.append(e),o}function U(o){let e=o.site;if(!e.whatsappEnabled||!e.whatsappNumber)return;let{root:n}=C(o),i="https://wa.me/"+e.whatsappNumber.replace(/[^\d]/g,"")+"?text="+encodeURIComponent(e.whatsappMessage||"Hi!");n.append(t("a",{class:"op-wa",href:i,target:"_blank",rel:"noopener noreferrer","aria-label":"Message us on WhatsApp"},[$()]))}function D(o){let e=o.site;if(!e.emailCaptureEnabled)return;let n="nodpeak_ecap_seen_"+o.projectId;if(w(n))return;let{root:i}=C(o),a=t("div",{class:"op-ecap",hidden:!0}),r=()=>{y(n,"1"),a.hidden=!0},p=t("input",{class:"op-input",type:"email",placeholder:"you@example.com",required:!0,autocomplete:"email"}),s=t("div",{class:"op-err",hidden:!0}),l=t("button",{class:"op-btn",type:"submit"},["Subscribe"]),m=t("form",{class:"op-ecap-form",onsubmit:async d=>{if(d.preventDefault(),!!p.value.trim()){l.disabled=!0,l.textContent="Joining\u2026",s.hidden=!0;try{await _({projectId:o.projectId,email:p.value.trim(),sourceUrl:location.href}),y(n,"1"),u.replaceChildren(t("div",{class:"op-ok"},["You're in \u2014 thanks!"]),t("button",{class:"op-btn",type:"button",onclick:r},["Close"]))}catch(c){l.disabled=!1,l.textContent="Subscribe",s.textContent=c.message,s.hidden=!1}}}},[p,l,s]),u=t("div",{class:"op-ecap-card"},[t("button",{class:"op-ecap-close",type:"button","aria-label":"Close",html:"&times;",onclick:r}),t("div",{class:"op-ecap-title"},[e.emailCaptureTitle]),t("div",{class:"op-ecap-sub"},[e.emailCaptureSubtitle]),m]);a.append(u),a.addEventListener("click",d=>{d.target===a&&r()}),document.addEventListener("keydown",d=>{d.key==="Escape"&&!a.hidden&&r()}),i.append(a),window.setTimeout(()=>{w(n)||(a.hidden=!1)},Math.max(0,e.emailCaptureDelayMs))}function x(o){return Array.from(document.querySelectorAll(`[data-nodpeak="${o}"]`))}function v(o,e){let n=o.attachShadow({mode:"open"});n.append(t("style",{html:h(e.primaryColor,e.accentColor)}));let i=t("div",{class:"op-root op-inline"});return n.append(i),i}function O(o){let e=o.site;if(!(!e.trustBarEnabled||e.trustBarItems.length===0))for(let n of x("trustbar")){let i=v(n,o),a=t("div",{class:"op-tbar"});for(let r of e.trustBarItems){let p=document.createElementNS("http://www.w3.org/2000/svg","svg");p.setAttribute("viewBox","0 0 20 20"),p.setAttribute("aria-hidden","true");let s=document.createElementNS("http://www.w3.org/2000/svg","path");s.setAttribute("d","M16.7 5.3a1 1 0 010 1.4l-7.3 7.3a1 1 0 01-1.4 0L3.3 9.3a1 1 0 111.4-1.4l3.6 3.6 6.6-6.6a1 1 0 011.4 0z"),p.append(s),a.append(t("div",{class:"op-tbar-item"},[p,r.label]))}i.append(a)}}function q(o){var e;if(o.wall.length!==0)for(let n of x("wall")){let i=v(n,o),a=t("div",{class:"op-wall"});for(let r of o.wall){let p=t("div",{class:"op-stars"});for(let s=1;s<=5;s++){let l=f();s<=r.rating&&l.classList.add("op-on"),p.append(l)}a.append(t("div",{class:"op-wcard"},[p,t("div",{class:"op-wtext"},[(e=r.comment)!=null?e:""]),t("div",{class:"op-wname"},[r.customerName||"Verified customer"])]))}i.append(a)}}function G(o){let e=o.aggregate;if(!(!e||e.count===0))for(let n of x("badge")){let i=v(n,o),a=t("div",{class:"op-stars"}),r=Math.round(e.average);for(let p=1;p<=5;p++){let s=f();p<=r&&s.classList.add("op-on"),a.append(s)}i.append(t("div",{class:"op-badge-inline"},[a,t("span",{},[`${e.average.toFixed(1)} `,t("a",{href:o.googleReviewUrl||"#",target:"_blank",rel:"noopener noreferrer"},[`(${e.count} review${e.count===1?"":"s"})`])])]))}}function J(o){let e=o.site;if(e.contactFormEnabled)for(let n of x("contact")){let i=v(n,o),a=t("div",{class:"op-panel"}),r=t("div");a.append(r),(()=>{let s=t("input",{class:"op-input",type:"text",placeholder:"Name",autocomplete:"name"}),l=t("input",{class:"op-input",type:"email",placeholder:"Email",autocomplete:"email"}),m=t("input",{class:"op-input",type:"tel",placeholder:"Phone (optional)",autocomplete:"tel"}),u=t("textarea",{class:"op-textarea",placeholder:"What do you need?",required:!0}),d=t("div",{class:"op-err",hidden:!0}),c=t("button",{class:"op-btn",type:"submit"},["Send"]),H=t("form",{onsubmit:async A=>{if(A.preventDefault(),!!u.value.trim()){c.disabled=!0,c.textContent="Sending\u2026",d.hidden=!0;try{await P({projectId:o.projectId,name:s.value.trim()||null,email:l.value.trim()||null,phone:m.value.trim()||null,message:u.value.trim(),sourceUrl:location.href}),r.replaceChildren(t("div",{class:"op-ok"},["Thanks \u2014 we got it."]),t("div",{class:"op-sub"},["Someone will get back to you shortly."]))}catch(z){c.disabled=!1,c.textContent="Send",d.textContent=z.message,d.hidden=!1}}}},[t("div",{class:"op-title"},[e.contactFormTitle]),t("div",{class:"op-field"},[s]),t("div",{class:"op-field"},[l]),t("div",{class:"op-field"},[m]),t("div",{class:"op-field"},[u]),c,d]);r.replaceChildren(H)})(),i.append(a)}}async function S(){let o=window;if(o[L])return;if(o[L]=!0,!T){console.warn("[nodpeak] script tag is missing data-project-id");return}let e;try{e=await N(T)}catch(a){console.warn("[nodpeak] could not load widget config:",a.message);return}R(e);let n=E("data-mount"),i=n?document.getElementById(n):null;n&&!i&&console.warn(`[nodpeak] data-mount="${n}" not found, falling back to bubble`),i&&(e.placement="inline"),new k(e,i),B(e),U(e),D(e),O(e),q(e),G(e),J(e)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>void S()):S();})();
