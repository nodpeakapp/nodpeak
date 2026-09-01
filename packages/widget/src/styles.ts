/**
 * All widget CSS lives inside a shadow root, so nothing here can leak onto
 * the host page and nothing on the host page can reach in. That isolation is
 * the whole reason for the shadow DOM: an embed that inherits a customer's
 * `* { box-sizing: content-box }` looks broken and it is always our fault.
 */
export function css(primary: string, accent: string): string {
  return `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.op-root {
  --op-primary: ${primary};
  --op-accent: ${accent};
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

/* ── launcher bubble ─────────────────────────────────────── */
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

/* ── panel ───────────────────────────────────────────────── */
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

/* ── stars ───────────────────────────────────────────────── */
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

/* ── form ────────────────────────────────────────────────── */
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

/* ── announcement bar ────────────────────────────────────── */
.op-abar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 2147483001;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 9px 40px 9px 16px; font-size: 13px; font-weight: 600; text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  /* background/color are set inline per-project — these are the site owner's own brand colours. */
}
.op-abar a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.op-abar-close {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; border: 0; border-radius: 6px; cursor: pointer;
  background: transparent; color: inherit; opacity: .7; font-size: 15px; line-height: 1;
}
.op-abar-close:hover { opacity: 1; background: rgba(0,0,0,.1); }

/* ── whatsapp button ─────────────────────────────────────── */
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

/* ── email capture popup ─────────────────────────────────── */
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

/* ── trust bar ────────────────────────────────────────────── */
.op-tbar {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 10px 22px; padding: 14px 0;
}
.op-tbar-item { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--op-text); }
.op-tbar-item svg { width: 16px; height: 16px; fill: var(--op-accent); flex-shrink: 0; }

/* ── testimonials wall ───────────────────────────────────── */
.op-wall { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
.op-wcard {
  padding: 16px; border: 1px solid var(--op-border); border-radius: 14px;
  background: var(--op-surface); color: var(--op-text);
}
.op-wcard .op-stars { margin: 0 0 8px; }
.op-wcard .op-stars svg { width: 14px; height: 14px; }
.op-wtext { font-size: 13.5px; line-height: 1.55; }
.op-wname { margin-top: 10px; font-size: 12px; font-weight: 600; color: var(--op-muted); }

/* ── star badge ───────────────────────────────────────────── */
.op-badge-inline {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: var(--op-text);
}
.op-badge-inline .op-stars svg { width: 15px; height: 15px; }
.op-badge-inline a { color: inherit; text-decoration: none; }
.op-badge-inline a:hover { text-decoration: underline; }
`;
}
