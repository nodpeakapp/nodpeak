"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type State = { error: string | null; ok?: boolean };

export type SiteConfig = {
  announcementEnabled: boolean;
  announcementText: string;
  announcementLinkUrl: string | null;
  announcementLinkText: string | null;
  announcementBg: string;
  announcementFg: string;
  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  whatsappMessage: string;
  emailCaptureEnabled: boolean;
  emailCaptureTitle: string;
  emailCaptureSubtitle: string;
  emailCaptureDelayMs: number;
  trustBarEnabled: boolean;
  trustBarItems: Array<{ icon: string; label: string }>;
  contactFormEnabled: boolean;
  contactFormTitle: string;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary mt-6" disabled={pending}>
      {pending ? "Saving…" : "Save growth settings"}
    </button>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-100">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-cyan-500" />
      {label}
    </label>
  );
}

export function SiteConfigForm({
  projectId,
  config,
  action,
}: {
  projectId: string;
  config: SiteConfig;
  action: (prev: State, fd: FormData) => Promise<State>;
}) {
  const [state, formAction] = useActionState(action, { error: null } as State);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="projectId" value={projectId} />

      <section className="panel p-6">
        <Toggle name="announcementEnabled" label="Announcement bar" defaultChecked={config.announcementEnabled} />
        <p className="mt-1 text-sm text-zinc-400">A thin bar across the top of every page — sales, hours, a launch.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="announcementText">Message</label>
            <input id="announcementText" name="announcementText" defaultValue={config.announcementText} className="input" maxLength={200} placeholder="20% off everything this week" />
          </div>
          <div>
            <label className="label" htmlFor="announcementLinkText">Link text (optional)</label>
            <input id="announcementLinkText" name="announcementLinkText" defaultValue={config.announcementLinkText ?? ""} className="input" maxLength={40} placeholder="Shop now" />
          </div>
          <div>
            <label className="label" htmlFor="announcementLinkUrl">Link URL (optional)</label>
            <input id="announcementLinkUrl" name="announcementLinkUrl" type="url" defaultValue={config.announcementLinkUrl ?? ""} className="input" placeholder="https://…" />
          </div>
          <ColorField name="announcementBg" label="Background" value={config.announcementBg} />
          <ColorField name="announcementFg" label="Text" value={config.announcementFg} />
        </div>
      </section>

      <section className="panel p-6">
        <Toggle name="whatsappEnabled" label="WhatsApp button" defaultChecked={config.whatsappEnabled} />
        <p className="mt-1 text-sm text-zinc-400">A floating button that opens a WhatsApp chat pre-filled with your message.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="whatsappNumber">WhatsApp number</label>
            <input id="whatsappNumber" name="whatsappNumber" defaultValue={config.whatsappNumber ?? ""} className="input font-mono" placeholder="+15551234567" />
            <p className="mt-1.5 text-xs text-zinc-500">Include the country code, digits only.</p>
          </div>
          <div>
            <label className="label" htmlFor="whatsappMessage">Pre-filled message</label>
            <input id="whatsappMessage" name="whatsappMessage" defaultValue={config.whatsappMessage} className="input" maxLength={300} />
          </div>
        </div>
      </section>

      <section className="panel p-6">
        <Toggle name="emailCaptureEnabled" label="Email capture popup" defaultChecked={config.emailCaptureEnabled} />
        <p className="mt-1 text-sm text-zinc-400">A one-time popup that grows a mailing list. Never shown twice to the same visitor.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="emailCaptureTitle">Headline</label>
            <input id="emailCaptureTitle" name="emailCaptureTitle" defaultValue={config.emailCaptureTitle} className="input" maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="emailCaptureSubtitle">Sub-line</label>
            <input id="emailCaptureSubtitle" name="emailCaptureSubtitle" defaultValue={config.emailCaptureSubtitle} className="input" maxLength={200} />
          </div>
          <div>
            <label className="label" htmlFor="emailCaptureDelayMs">Show after</label>
            <select id="emailCaptureDelayMs" name="emailCaptureDelayMs" defaultValue={String(config.emailCaptureDelayMs)} className="input">
              <option value="0">Immediately</option>
              <option value="2000">2 seconds</option>
              <option value="4000">4 seconds</option>
              <option value="8000">8 seconds</option>
              <option value="15000">15 seconds</option>
            </select>
          </div>
        </div>
      </section>

      <section className="panel p-6">
        <Toggle name="trustBarEnabled" label="Trust bar" defaultChecked={config.trustBarEnabled} />
        <p className="mt-1 text-sm text-zinc-400">A row of short trust claims. One per line, up to 6 — render it with the inline embed snippet.</p>
        <div className="mt-4">
          <label className="label" htmlFor="trustBarItems">Items</label>
          <textarea
            id="trustBarItems"
            name="trustBarItems"
            defaultValue={config.trustBarItems.map((i) => i.label).join("\n")}
            className="input font-mono min-h-[100px]"
            placeholder={"Free shipping over $50\n30-day returns\n500+ happy customers\nSecure checkout"}
          />
        </div>
      </section>

      <section className="panel p-6">
        <Toggle name="contactFormEnabled" label="Contact / quote form" defaultChecked={config.contactFormEnabled} />
        <p className="mt-1 text-sm text-zinc-400">Leads land in your Leads inbox. Mount it inline with the embed snippet, or trigger it from any button on your site.</p>
        <div className="mt-4">
          <label className="label" htmlFor="contactFormTitle">Form headline</label>
          <input id="contactFormTitle" name="contactFormTitle" defaultValue={config.contactFormTitle} className="input" maxLength={120} />
        </div>
      </section>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          Saved. Live within a minute.
        </p>
      )}

      <Submit />
    </form>
  );
}

function ColorField({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          defaultValue={value}
          className="h-[42px] w-12 shrink-0 cursor-pointer rounded-xl border border-surface-700 bg-surface-950 p-1"
          onChange={(e) => {
            const text = document.getElementById(name) as HTMLInputElement | null;
            if (text) text.value = e.target.value;
          }}
          aria-label={`${label} colour picker`}
        />
        <input id={name} name={name} defaultValue={value} className="input font-mono" maxLength={7} />
      </div>
    </div>
  );
}
