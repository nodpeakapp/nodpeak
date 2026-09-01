export function LogoMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 42 42" fill="none" className={className} aria-hidden="true">
      <rect x="1" y="1" width="40" height="40" rx="11" stroke="currentColor" strokeOpacity="0.35" />
      <path
        d="M11 27 L21 14 L31 27"
        stroke="#25D6E8"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-mono font-bold tracking-tight ${className}`}>
      nod<span className="text-cyan-400">peak</span>
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <LogoMark className="h-4 w-4 text-zinc-600" />
      <Wordmark />
    </span>
  );
}
