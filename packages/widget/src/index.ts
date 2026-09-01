/**
 * Nodpeak embed widget.
 *
 *   <script src="https://your-install.com/widget.js"
 *           data-project-id="PROJECT_ID" async></script>
 *
 * Zero dependencies, one network call on load, rendered into a shadow root.
 * Everything it needs — copy, colours, routing thresholds, review data and
 * the pre-built JSON-LD — arrives in that single config response.
 */

import type { FeedbackResponse, LeadResponse, SubscribeResponse, WidgetConfig } from "./types";
import { css } from "./styles";

/* ── boot ──────────────────────────────────────────────────── */

const SCRIPT = (document.currentScript as HTMLScriptElement | null) ??
  (function () {
    const all = document.querySelectorAll<HTMLScriptElement>("script[data-project-id]");
    return all.length ? all[all.length - 1]! : null;
  })();

const GUARD = "__nodpeak_loaded__";

function attr(name: string): string | null {
  return SCRIPT?.getAttribute(name) ?? null;
}

function originFromScript(): string {
  const explicit = attr("data-api");
  if (explicit) return explicit.replace(/\/+$/, "");
  try {
    return new URL(SCRIPT!.src, location.href).origin;
  } catch {
    return location.origin;
  }
}

const PROJECT_ID = attr("data-project-id");
const API = originFromScript();

/* ── tiny DOM helpers (cheaper than a framework, and this must stay small) */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, unknown>> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = String(v);
    else if (k === "html") node.innerHTML = String(v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

const STAR_PATH =
  "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.3 6.2 20.4l1.1-6.4L2.6 9.4l6.5-.9z";

function starSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", STAR_PATH);
  svg.append(path);
  return svg;
}

/* ── SEO: inject AggregateRating JSON-LD into the host <head> ── */

/**
 * The server decides whether there is anything honest to publish and hands
 * back a ready-made string, or null. The widget never invents markup — a
 * reviewCount of 0 in the wild is worse than no markup at all.
 */
function injectJsonLd(config: WidgetConfig): void {
  if (!config.jsonLd) return;
  const id = "nodpeak-jsonld-" + config.projectId;
  if (document.getElementById(id)) return;

  const tag = document.createElement("script");
  tag.type = "application/ld+json";
  tag.id = id;
  tag.textContent = config.jsonLd;
  (document.head || document.documentElement).appendChild(tag);
}

/* ── network ───────────────────────────────────────────────── */

async function loadConfig(projectId: string): Promise<WidgetConfig> {
  const res = await fetch(
    API + "/api/v1/widget-config/" + encodeURIComponent(projectId),
    { credentials: "omit", mode: "cors" },
  );
  if (!res.ok) throw new Error("config " + res.status);
  return (await res.json()) as WidgetConfig;
}

async function submitFeedback(payload: Record<string, unknown>): Promise<FeedbackResponse> {
  const res = await fetch(API + "/api/v1/feedback", {
    method: "POST",
    credentials: "omit",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as FeedbackResponse;
  if (!res.ok) throw new Error(data.error || "Could not send that. Please try again.");
  return data;
}

async function submitLead(payload: Record<string, unknown>): Promise<LeadResponse> {
  const res = await fetch(API + "/api/v1/leads", {
    method: "POST",
    credentials: "omit",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as LeadResponse;
  if (!res.ok) throw new Error(data.error || "Could not send that. Please try again.");
  return data;
}

async function submitSubscribe(payload: Record<string, unknown>): Promise<SubscribeResponse> {
  const res = await fetch(API + "/api/v1/subscribe", {
    method: "POST",
    credentials: "omit",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as SubscribeResponse;
  if (!res.ok) throw new Error(data.error || "Could not subscribe. Please try again.");
  return data;
}

/** A small isolated shadow root, styled from the same shared token sheet as the review widget. */
function shadowHost(config: WidgetConfig, extraClass = ""): { host: HTMLElement; shadow: ShadowRoot; root: HTMLElement } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.append(el("style", { html: css(config.primaryColor, config.accentColor) }));
  const root = el("div", { class: "op-root" + (extraClass ? " " + extraClass : "") });
  shadow.append(root);
  return { host, shadow, root };
}

/** localStorage guarded so a private-browsing / storage-blocked visitor never breaks the embed. */
function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/* ── widget ────────────────────────────────────────────────── */

class Widget {
  private config: WidgetConfig;
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private root!: HTMLElement;
  private panel!: HTMLElement;
  private body!: HTMLElement;
  private rating = 0;
  private open = false;

  constructor(config: WidgetConfig, mount: HTMLElement | null) {
    this.config = config;

    this.host = mount ?? document.createElement("div");
    if (!mount) {
      this.host.setAttribute("data-nodpeak-widget", "");
      document.body.appendChild(this.host);
    }

    this.shadow = this.host.attachShadow({ mode: "open" });
    this.shadow.append(
      el("style", { html: css(config.primaryColor, config.accentColor) }),
    );
    this.render();
  }

  private render(): void {
    const inline = this.config.placement === "inline";
    this.root = el("div", { class: "op-root" + (inline ? " op-inline" : "") });

    this.panel = el("div", {
      class: "op-panel",
      role: "dialog",
      "aria-label": this.config.title,
      hidden: !inline,
    });
    this.body = el("div");
    this.panel.append(this.body);

    if (!inline) {
      this.panel.append(
        el("button", {
          class: "op-close",
          type: "button",
          "aria-label": "Close",
          html: "&times;",
          onclick: () => this.toggle(false),
        }),
      );
      this.root.append(this.launcher());
    }

    this.root.append(this.panel);
    this.shadow.append(this.root);
    this.stepRating();

    if (!inline) {
      document.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Escape" && this.open) this.toggle(false);
      });
    }
  }

  private launcher(): HTMLElement {
    const btn = el("button", {
      class: "op-bubble",
      type: "button",
      "aria-haspopup": "dialog",
      onclick: () => this.toggle(!this.open),
    });
    btn.append(starSvg(), document.createTextNode("Leave a review"));
    return btn;
  }

  private toggle(next: boolean): void {
    this.open = next;
    this.panel.hidden = !next;
    if (next) {
      const first = this.panel.querySelector<HTMLElement>("button, input, textarea");
      first?.focus();
    }
  }

  private swap(...nodes: Array<Node | string>): void {
    this.body.replaceChildren(...nodes);
    if (this.config.showSeoBadge) this.body.append(this.badge());
  }

  private badge(): HTMLElement {
    return el("div", { class: "op-badge" }, [
      el("span", {}, ["Reviews by "]),
      el("a", {
        href: "https://github.com/nodpeakapp/nodpeak",
        target: "_blank",
        rel: "noopener noreferrer",
      }, ["Nodpeak"]),
    ]);
  }

  /* ── step 1: stars ─────────────────────────────────────── */
  private stepRating(): void {
    const stars = el("div", { class: "op-stars", role: "radiogroup", "aria-label": "Rating" });

    for (let i = 1; i <= 5; i++) {
      const b = el("button", {
        class: "op-star",
        type: "button",
        role: "radio",
        "aria-checked": "false",
        "aria-label": i + (i === 1 ? " star" : " stars"),
        onclick: () => {
          this.rating = i;
          this.stepComment();
        },
      });
      b.append(starSvg());
      b.addEventListener("mouseenter", () => paint(i));
      stars.addEventListener("mouseleave", () => paint(0));
      stars.append(b);
    }

    const paint = (n: number) => {
      stars.querySelectorAll(".op-star").forEach((s, idx) => {
        s.classList.toggle("op-on", idx < n);
      });
    };

    const nodes: Array<Node | string> = [
      el("div", { class: "op-title" }, [this.config.title]),
      el("div", { class: "op-sub" }, [this.config.subtitle]),
      stars,
    ];

    const agg = this.config.aggregate;
    if (agg && agg.count > 0) {
      nodes.push(
        el("div", { class: "op-agg" }, [
          `${agg.average.toFixed(1)} average from ${agg.count} review${agg.count === 1 ? "" : "s"}`,
        ]),
      );
    }

    this.swap(...nodes);
  }

  /* ── step 2: the branching question ────────────────────── */
  private stepComment(): void {
    const positive = this.rating >= this.config.minStarForExternal;

    // The question itself is the product. A happy customer gets asked what
    // they loved — which is the sentence that ends up on Google. An unhappy
    // one gets asked how to fix it, in private, before it becomes a review.
    const question = positive
      ? "What did you love most?"
      : "How can we improve?";

    const comment = el("textarea", {
      class: "op-textarea",
      id: "op-comment",
      placeholder: positive
        ? "The bit worth telling other people about…"
        : "Tell us what went wrong — this goes straight to the owner.",
    }) as HTMLTextAreaElement;

    const name = el("input", {
      class: "op-input",
      id: "op-name",
      type: "text",
      placeholder: "Your name (optional)",
      autocomplete: "name",
    }) as HTMLInputElement;

    const email = el("input", {
      class: "op-input",
      id: "op-email",
      type: "email",
      placeholder: positive ? "Email (optional)" : "Email so we can put it right",
      autocomplete: "email",
    }) as HTMLInputElement;

    const error = el("div", { class: "op-err", hidden: true });

    const submit = el("button", { class: "op-btn", type: "button" }, [
      positive ? "Continue" : "Send privately",
    ]) as HTMLButtonElement;

    submit.addEventListener("click", async () => {
      submit.disabled = true;
      submit.textContent = "Sending…";
      error.hidden = true;
      try {
        const result = await submitFeedback({
          projectId: this.config.projectId,
          rating: this.rating,
          comment: comment.value.trim() || null,
          customerName: name.value.trim() || null,
          customerEmail: email.value.trim() || null,
          sourceUrl: location.href,
        });
        this.stepDone(result);
      } catch (err) {
        submit.disabled = false;
        submit.textContent = positive ? "Continue" : "Send privately";
        error.textContent = (err as Error).message;
        error.hidden = false;
      }
    });

    this.swap(
      el("div", { class: "op-title" }, [question]),
      el("div", { class: "op-sub" }, [this.config.promptQuestion]),
      el("div", { class: "op-field" }, [
        el("label", { class: "op-sr", for: "op-comment" }, [question]),
        comment,
      ]),
      el("div", { class: "op-field" }, [name]),
      el("div", { class: "op-field" }, [email]),
      submit,
      error,
      el("button", {
        class: "op-back",
        type: "button",
        onclick: () => this.stepRating(),
      }, ["Change my rating"]),
    );
  }

  /* ── step 3: hand off, or close the loop privately ─────── */
  private stepDone(result: FeedbackResponse): void {
    const redirect = result.redirect;
    const google = redirect?.google ?? null;
    const trustpilot = redirect?.trustpilot ?? null;

    if (google || trustpilot) {
      const nodes: Array<Node | string> = [
        el("div", { class: "op-ok" }, ["Thank you — that means a lot."]),
        el("div", { class: "op-sub" }, [
          "Would you post the same thing where other people will see it? It takes about twenty seconds.",
        ]),
      ];

      if (google) {
        nodes.push(
          el("a", {
            class: "op-cta",
            href: google,
            target: "_blank",
            rel: "noopener noreferrer",
          }, ["Post on Google"]),
        );
      }
      if (trustpilot) {
        nodes.push(
          el("a", {
            class: "op-cta",
            href: trustpilot,
            target: "_blank",
            rel: "noopener noreferrer",
          }, ["Post on Trustpilot"]),
        );
      }

      nodes.push(
        el("button", {
          class: "op-back",
          type: "button",
          onclick: () => this.toggle(false),
        }, ["No thanks"]),
      );

      this.swap(...nodes);
      return;
    }

    this.swap(
      el("div", { class: "op-ok" }, ["Thank you — this went straight to the owner."]),
      el("div", { class: "op-sub" }, [
        "Nobody else sees it. If you left an email, expect a reply rather than a form letter.",
      ]),
      el("button", {
        class: "op-btn",
        type: "button",
        onclick: () => this.toggle(false),
      }, ["Close"]),
    );
  }
}

/* ── announcement bar ──────────────────────────────────────── */

function renderAnnouncementBar(config: WidgetConfig): void {
  const site = config.site;
  if (!site.announcementEnabled || !site.announcementText) return;

  const key = "nodpeak_abar_dismissed_" + config.projectId;
  if (storageGet(key)) return;

  const { root } = shadowHost(config);
  const bar = el("div", {
    class: "op-abar",
    style: `background:${site.announcementBg};color:${site.announcementFg}`,
  });

  const nodes: Array<Node | string> = [document.createTextNode(site.announcementText)];
  if (site.announcementLinkUrl) {
    nodes.push(
      el("a", { href: site.announcementLinkUrl, target: "_blank", rel: "noopener noreferrer" }, [
        site.announcementLinkText || "Learn more",
      ]),
    );
  }
  bar.append(...nodes);

  bar.append(
    el("button", {
      class: "op-abar-close",
      type: "button",
      "aria-label": "Dismiss",
      html: "&times;",
      onclick: () => {
        storageSet(key, "1");
        bar.remove();
      },
    }),
  );

  root.append(bar);
}

/* ── whatsapp button ───────────────────────────────────────── */

// The actual WhatsApp glyph (phone handset inside the notched speech
// bubble) — the earlier path was a generic chat-bubble silhouette that
// read as "message us", not specifically WhatsApp. This is the widely
// recognized brand mark so the button reads unambiguously at a glance.
const WHATSAPP_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.051 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413";

function waIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", WHATSAPP_PATH);
  svg.append(path);
  return svg;
}

function renderWhatsAppButton(config: WidgetConfig): void {
  const site = config.site;
  if (!site.whatsappEnabled || !site.whatsappNumber) return;

  const { root } = shadowHost(config);
  const href =
    "https://wa.me/" +
    site.whatsappNumber.replace(/[^\d]/g, "") +
    "?text=" +
    encodeURIComponent(site.whatsappMessage || "Hi!");

  root.append(
    el("a", {
      class: "op-wa",
      href,
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": "Message us on WhatsApp",
    }, [waIcon()]),
  );
}

/* ── email capture popup ───────────────────────────────────── */

function renderEmailCapture(config: WidgetConfig): void {
  const site = config.site;
  if (!site.emailCaptureEnabled) return;

  const key = "nodpeak_ecap_seen_" + config.projectId;
  if (storageGet(key)) return;

  const { root } = shadowHost(config);
  const overlay = el("div", { class: "op-ecap", hidden: true });

  const dismiss = () => {
    storageSet(key, "1");
    overlay.hidden = true;
  };

  const email = el("input", {
    class: "op-input",
    type: "email",
    placeholder: "you@example.com",
    required: true,
    autocomplete: "email",
  }) as HTMLInputElement;

  const error = el("div", { class: "op-err", hidden: true });

  const submit = el("button", { class: "op-btn", type: "submit" }, ["Subscribe"]) as HTMLButtonElement;

  const form = el("form", {
    class: "op-ecap-form",
    onsubmit: async (e: Event) => {
      e.preventDefault();
      if (!email.value.trim()) return;
      submit.disabled = true;
      submit.textContent = "Joining…";
      error.hidden = true;
      try {
        await submitSubscribe({ projectId: config.projectId, email: email.value.trim(), sourceUrl: location.href });
        storageSet(key, "1");
        card.replaceChildren(
          el("div", { class: "op-ok" }, ["You're in — thanks!"]),
          el("button", { class: "op-btn", type: "button", onclick: dismiss }, ["Close"]),
        );
      } catch (err) {
        submit.disabled = false;
        submit.textContent = "Subscribe";
        error.textContent = (err as Error).message;
        error.hidden = false;
      }
    },
  }, [email, submit, error]);

  const card = el("div", { class: "op-ecap-card" }, [
    el("button", { class: "op-ecap-close", type: "button", "aria-label": "Close", html: "&times;", onclick: dismiss }),
    el("div", { class: "op-ecap-title" }, [site.emailCaptureTitle]),
    el("div", { class: "op-ecap-sub" }, [site.emailCaptureSubtitle]),
    form,
  ]);

  overlay.append(card);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismiss();
  });
  document.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape" && !overlay.hidden) dismiss();
  });

  root.append(overlay);

  window.setTimeout(() => {
    if (!storageGet(key)) overlay.hidden = false;
  }, Math.max(0, site.emailCaptureDelayMs));
}

/* ── trust bar / testimonials wall / star badge / contact form: ─
   opt-in inline mounts. A page places <div data-nodpeak="trustbar"></div>
   (or "wall" / "badge" / "contact") anywhere it likes, and the same one
   script tag fills it in — no second embed to install. ─────────────── */

function mountPoints(kind: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-nodpeak="${kind}"]`));
}

function inlineHost(mount: HTMLElement, config: WidgetConfig): HTMLElement {
  const shadow = mount.attachShadow({ mode: "open" });
  shadow.append(el("style", { html: css(config.primaryColor, config.accentColor) }));
  const root = el("div", { class: "op-root op-inline" });
  shadow.append(root);
  return root;
}

function renderTrustBar(config: WidgetConfig): void {
  const site = config.site;
  if (!site.trustBarEnabled || site.trustBarItems.length === 0) return;

  for (const mount of mountPoints("trustbar")) {
    const root = inlineHost(mount, config);
    const bar = el("div", { class: "op-tbar" });
    for (const item of site.trustBarItems) {
      const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      check.setAttribute("viewBox", "0 0 20 20");
      check.setAttribute("aria-hidden", "true");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", "M16.7 5.3a1 1 0 010 1.4l-7.3 7.3a1 1 0 01-1.4 0L3.3 9.3a1 1 0 111.4-1.4l3.6 3.6 6.6-6.6a1 1 0 011.4 0z");
      check.append(p);
      bar.append(el("div", { class: "op-tbar-item" }, [check, item.label]));
    }
    root.append(bar);
  }
}

function renderTestimonialsWall(config: WidgetConfig): void {
  if (config.wall.length === 0) return;

  for (const mount of mountPoints("wall")) {
    const root = inlineHost(mount, config);
    const grid = el("div", { class: "op-wall" });
    for (const r of config.wall) {
      const stars = el("div", { class: "op-stars" });
      for (let i = 1; i <= 5; i++) {
        const s = starSvg();
        if (i <= r.rating) s.classList.add("op-on");
        stars.append(s);
      }
      grid.append(
        el("div", { class: "op-wcard" }, [
          stars,
          el("div", { class: "op-wtext" }, [r.comment ?? ""]),
          el("div", { class: "op-wname" }, [r.customerName || "Verified customer"]),
        ]),
      );
    }
    root.append(grid);
  }
}

function renderStarBadge(config: WidgetConfig): void {
  const agg = config.aggregate;
  if (!agg || agg.count === 0) return;

  for (const mount of mountPoints("badge")) {
    const root = inlineHost(mount, config);
    const stars = el("div", { class: "op-stars" });
    const rounded = Math.round(agg.average);
    for (let i = 1; i <= 5; i++) {
      const s = starSvg();
      if (i <= rounded) s.classList.add("op-on");
      stars.append(s);
    }
    root.append(
      el("div", { class: "op-badge-inline" }, [
        stars,
        el("span", {}, [
          `${agg.average.toFixed(1)} `,
          el("a", { href: config.googleReviewUrl || "#", target: "_blank", rel: "noopener noreferrer" }, [
            `(${agg.count} review${agg.count === 1 ? "" : "s"})`,
          ]),
        ]),
      ]),
    );
  }
}

function renderContactForm(config: WidgetConfig): void {
  const site = config.site;
  if (!site.contactFormEnabled) return;

  for (const mount of mountPoints("contact")) {
    const root = inlineHost(mount, config);
    const panel = el("div", { class: "op-panel" });
    const body = el("div");
    panel.append(body);

    const draw = () => {
      const name = el("input", { class: "op-input", type: "text", placeholder: "Name", autocomplete: "name" }) as HTMLInputElement;
      const emailF = el("input", { class: "op-input", type: "email", placeholder: "Email", autocomplete: "email" }) as HTMLInputElement;
      const phone = el("input", { class: "op-input", type: "tel", placeholder: "Phone (optional)", autocomplete: "tel" }) as HTMLInputElement;
      const message = el("textarea", { class: "op-textarea", placeholder: "What do you need?", required: true }) as HTMLTextAreaElement;
      const error = el("div", { class: "op-err", hidden: true });
      const submit = el("button", { class: "op-btn", type: "submit" }, ["Send"]) as HTMLButtonElement;

      const form = el("form", {
        onsubmit: async (e: Event) => {
          e.preventDefault();
          if (!message.value.trim()) return;
          submit.disabled = true;
          submit.textContent = "Sending…";
          error.hidden = true;
          try {
            await submitLead({
              projectId: config.projectId,
              name: name.value.trim() || null,
              email: emailF.value.trim() || null,
              phone: phone.value.trim() || null,
              message: message.value.trim(),
              sourceUrl: location.href,
            });
            body.replaceChildren(
              el("div", { class: "op-ok" }, ["Thanks — we got it."]),
              el("div", { class: "op-sub" }, ["Someone will get back to you shortly."]),
            );
          } catch (err) {
            submit.disabled = false;
            submit.textContent = "Send";
            error.textContent = (err as Error).message;
            error.hidden = false;
          }
        },
      }, [
        el("div", { class: "op-title" }, [site.contactFormTitle]),
        el("div", { class: "op-field" }, [name]),
        el("div", { class: "op-field" }, [emailF]),
        el("div", { class: "op-field" }, [phone]),
        el("div", { class: "op-field" }, [message]),
        submit,
        error,
      ]);

      body.replaceChildren(form);
    };

    draw();
    root.append(panel);
  }
}

/* ── entry ─────────────────────────────────────────────────── */

async function boot(): Promise<void> {
  const w = window as unknown as Record<string, unknown>;
  if (w[GUARD]) return;
  w[GUARD] = true;

  if (!PROJECT_ID) {
    console.warn("[nodpeak] script tag is missing data-project-id");
    return;
  }

  let config: WidgetConfig;
  try {
    config = await loadConfig(PROJECT_ID);
  } catch (err) {
    // Never break the host page. A dead widget is invisible; a thrown
    // exception in a third-party script gets the whole embed ripped out.
    console.warn("[nodpeak] could not load widget config:", (err as Error).message);
    return;
  }

  injectJsonLd(config);

  const mountId = attr("data-mount");
  const mount = mountId ? document.getElementById(mountId) : null;
  if (mountId && !mount) {
    console.warn(`[nodpeak] data-mount="${mountId}" not found, falling back to bubble`);
  }
  if (mount) config.placement = "inline";

  new Widget(config, mount);

  // Everything below is opt-in per project and independently toggled —
  // a project with none of it enabled costs nothing beyond the one config
  // fetch that already happened above.
  renderAnnouncementBar(config);
  renderWhatsAppButton(config);
  renderEmailCapture(config);
  renderTrustBar(config);
  renderTestimonialsWall(config);
  renderStarBadge(config);
  renderContactForm(config);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void boot());
} else {
  void boot();
}
