"use client";

import { useState } from "react";
import { CopyBlock } from "./copy-block";

type Target = "html" | "wordpress" | "shopify" | "react";

const TABS: Array<{ id: Target; label: string }> = [
  { id: "html", label: "HTML" },
  { id: "wordpress", label: "WordPress" },
  { id: "shopify", label: "Shopify" },
  { id: "react", label: "React / Next.js" },
];

export function EmbedGenerator({ appUrl, projectId }: { appUrl: string; projectId: string }) {
  const [tab, setTab] = useState<Target>("html");
  const [inline, setInline] = useState(false);

  const src = `${appUrl}/widget.js`;
  const mountAttr = inline ? ` data-mount="nodpeak"` : "";
  const tag = `<script src="${src}" data-project-id="${projectId}"${mountAttr} async></script>`;
  const mountDiv = inline ? `<div id="nodpeak"></div>\n` : "";

  const snippets: Record<Target, { code: string; note: string }> = {
    html: {
      code: `${mountDiv}${tag}`,
      note: "Paste immediately before the closing </body> tag on every page you want the widget on.",
    },
    wordpress: {
      code: `<?php
/**
 * Drop this in your child theme's functions.php.
 * Loads the Nodpeak widget in the footer of every page.
 */
add_action( 'wp_footer', function () {
    ?>
    ${mountDiv ? `    ${mountDiv.trim()}\n` : ""}    ${tag}
    <?php
}, 20 );`,
      note: "Theme-file free alternative: Appearance → Widgets → add a Custom HTML block to the footer and paste the plain HTML snippet.",
    },
    shopify: {
      code: `{% comment %}
  Nodpeak — add just above </body> in layout/theme.liquid
{% endcomment %}
${mountDiv}${tag}`,
      note: "Online Store → Themes → Edit code → layout/theme.liquid. Paste above </body> and save.",
    },
    react: {
      code: `import Script from "next/script";

export default function Nodpeak() {
  return (
    <>
      ${inline ? `<div id="nodpeak" />\n      ` : ""}<Script
        src="${src}"
        data-project-id="${projectId}"${inline ? `\n        data-mount="nodpeak"` : ""}
        strategy="afterInteractive"
      />
    </>
  );
}`,
      note: "For plain React (Vite, CRA), append the same <script> to document.body inside a useEffect with a cleanup that removes it.",
    },
  };

  const active = snippets[tab];

  return (
    <div className="panel p-6">
      <h2 className="text-base font-semibold">Embed code</h2>
      <p className="mt-1 text-sm text-zinc-400">
        One tag. No build step, no npm package, nothing to keep updated.
      </p>

      <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={inline}
          onChange={(e) => setInline(e.target.checked)}
          className="h-4 w-4 accent-cyan-500"
        />
        Render inline in a container instead of a floating bubble
      </label>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-surface-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-cyan-500 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <CopyBlock code={active.code} />
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{active.note}</p>
      </div>
    </div>
  );
}
