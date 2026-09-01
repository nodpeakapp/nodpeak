"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard API needs a secure context. On plain http the button would
      // silently do nothing, so fall back to a selection the user can Cmd-C.
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="relative">
      {label && <div className="label">{label}</div>}
      <pre className="overflow-x-auto rounded-xl border border-surface-700 bg-surface-950 p-4 pr-14 text-[13px] leading-relaxed text-zinc-300">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy to clipboard"
        className="absolute right-2 top-2 rounded-lg border border-surface-700 bg-surface-900 p-2 text-zinc-400 transition hover:text-cyan-500"
        style={{ top: label ? "1.9rem" : "0.5rem" }}
      >
        {copied ? <Check className="h-4 w-4 text-cyan-500" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
