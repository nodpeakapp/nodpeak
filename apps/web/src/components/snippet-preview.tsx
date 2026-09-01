import { Star, AlertTriangle } from "lucide-react";
import type { AggregateStats } from "@/lib/schema-generator";

/**
 * A faithful mock of the Google result. The point of showing it is not
 * decoration — it is so the owner can see, before they sell this to anyone,
 * that gold stars only appear when there is data behind them.
 */
export function SnippetPreview({
  domain,
  title,
  description,
  stats,
  eligible,
}: {
  domain: string;
  title: string;
  description: string;
  stats: AggregateStats;
  eligible: boolean;
}) {
  const full = Math.floor(stats.average);
  const half = stats.average - full >= 0.5;

  return (
    <div className="panel p-5">
      <div className="label">Google result preview</div>

      <div className="mt-3 rounded-xl bg-white p-4 font-sans">
        <div className="text-[13px] leading-tight text-[#202124]">{domain}</div>
        <div className="mt-0.5 text-[19px] leading-snug text-[#1a0dab]">{title}</div>

        {stats.count > 0 ? (
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[#70757a]">
            <span className="flex items-center gap-px">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5"
                  style={{
                    fill: i <= full || (i === full + 1 && half) ? "#e7711b" : "transparent",
                    color: "#e7711b",
                  }}
                />
              ))}
            </span>
            <span>
              Rating: {stats.average.toFixed(1)} · {stats.count} review
              {stats.count === 1 ? "" : "s"}
            </span>
          </div>
        ) : (
          <div className="mt-1 text-[13px] italic text-[#70757a]">
            No stars yet — approve a review to populate the rating.
          </div>
        )}

        <div className="mt-1 text-[14px] leading-snug text-[#4d5156]">{description}</div>
      </div>

      {!eligible && stats.count > 0 && (
        <p className="mt-3 flex gap-2 rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This preview shows what the markup <em>claims</em>. Google does not render review
            stars for self-serving reviews on LocalBusiness or Organization types — which is
            why the widget sends happy customers to your Google Business Profile instead.
          </span>
        </p>
      )}
    </div>
  );
}
