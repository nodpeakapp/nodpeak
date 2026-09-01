"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

type State = { error: string | null; ok?: boolean };

type Config = {
  primaryColor: string;
  accentColor: string;
  title: string;
  subtitle: string;
  promptQuestion: string;
  minStarForExternal: number;
  showSeoBadge: boolean;
  placement: string;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary mt-5" disabled={pending}>
      {pending ? "Saving…" : "Save widget"}
    </button>
  );
}

export function WidgetForm({
  projectId,
  config,
  action,
  hasGoogle,
  hasTrustpilot,
  canHideBadge,
}: {
  projectId: string;
  config: Config;
  action: (prev: State, fd: FormData) => Promise<State>;
  hasGoogle: boolean;
  hasTrustpilot: boolean;
  /** Only a paying HOSTED subscriber can remove the "Reviews by Nodpeak" credit. */
  canHideBadge: boolean;
}) {
  const [state, formAction] = useActionState(action, { error: null } as State);
  const [minStar, setMinStar] = useState<number>(config.minStarForExternal);

  return (
    <form action={formAction} className="panel p-6">
      <input type="hidden" name="projectId" value={projectId} />
      <h2 className="text-base font-semibold">Appearance and copy</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="title">Headline</label>
          <input id="title" name="title" defaultValue={config.title} className="input" required maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="subtitle">Sub-line</label>
          <input id="subtitle" name="subtitle" defaultValue={config.subtitle} className="input" maxLength={200} />
        </div>
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="promptQuestion">Prompt under the question</label>
        <input
          id="promptQuestion"
          name="promptQuestion"
          defaultValue={config.promptQuestion}
          className="input"
          maxLength={200}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ColorField name="primaryColor" label="Primary" value={config.primaryColor} />
        <ColorField name="accentColor" label="Accent (stars)" value={config.accentColor} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="placement">Placement</label>
          <select id="placement" name="placement" defaultValue={config.placement} className="input">
            <option value="bubble">Floating bubble</option>
            <option value="inline">Inline card</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="minStarForExternal">Offer Google / Trustpilot at</label>
          <select
            id="minStarForExternal"
            name="minStarForExternal"
            defaultValue={String(config.minStarForExternal)}
            onChange={(e) => setMinStar(Number(e.target.value))}
            className="input"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} star{n === 1 ? "" : "s"} and above{n === 1 ? " — everyone (recommended)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {minStar === 1 ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Every customer is offered the same link onward, whatever they rated you. This is the
          compliant setting and the default. You still see every review first, because you asked
          on your own site.
        </p>
      ) : (
        <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs leading-relaxed text-red-200/90">
          <strong className="font-semibold">This filters who is offered a public review link.</strong>{" "}
          Google&rsquo;s Business Profile policy prohibits selectively soliciting positive reviews,
          and Trustpilot&rsquo;s guidelines require inviting everyone the same way. Enforcement lands
          on <em>your</em> profile — up to a public banner saying fake reviews were removed. It also
          carries US FTC Act exposure. Set this back to 1 star unless you have taken advice.{" "}
          <a
            href="https://github.com/nodpeakapp/nodpeak/blob/main/docs/compliance.md"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            Read why
          </a>
          .
        </p>
      )}

      {!hasGoogle && !hasTrustpilot && (
        <p className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-200/90">
          No Google Place ID or Trustpilot slug set yet, so happy customers currently get a
          thank-you and no link. Add one in Settings.
        </p>
      )}

      <label
        className={`mt-4 flex w-fit items-center gap-2 text-sm ${
          canHideBadge ? "cursor-pointer text-zinc-300" : "cursor-not-allowed text-zinc-500"
        }`}
      >
        <input
          type="checkbox"
          name="showSeoBadge"
          defaultChecked={canHideBadge ? config.showSeoBadge : true}
          disabled={!canHideBadge}
          className="h-4 w-4 accent-cyan-500"
        />
        Show the &ldquo;Reviews by Nodpeak&rdquo; badge
      </label>
      {!canHideBadge && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Part of the free plan — it&rsquo;s what keeps self-hosting free for everyone. Upgrade
          to the hosted plan to remove it.
        </p>
      )}

      {state.error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p className="mt-4 rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          Saved. Live within a minute — the config response is cached for 60 seconds.
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
