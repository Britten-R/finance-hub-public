import { getMetrics, type Metric } from "@/lib/economy";

const fmt = (m: Metric, n: number) =>
  m.unit === "%" ? `${n.toFixed(2)}%` : n.toLocaleString("en-US", { maximumFractionDigits: n > 1000 ? 0 : 2 });

// Tiny single-series line, no axes. Shows the shape of the last few months.
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(2)},${(28 - ((v - min) / span) * 24).toFixed(2)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-2 h-8 w-full" aria-hidden>
      <polyline points={pts} fill="none" style={{ stroke: "var(--series-1)" }} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Change({ m }: { m: Metric }) {
  if (m.monthAgo === null) return null;
  const diff = m.latest - m.monthAgo;
  const shown = m.unit === "%" ? `${Math.abs(diff).toFixed(2)} pts` : `${Math.abs((diff / m.monthAgo) * 100).toFixed(1)}%`;
  // Neutral ink: a rate going up isn't automatically good or bad.
  return (
    <span className="text-xs text-ink-2">
      {diff === 0 ? "No change" : `${diff > 0 ? "▲" : "▼"} ${shown}`} vs. a month ago
    </span>
  );
}

export default async function EconomyPanel({ today, owned }: { today: string; owned: string[] }) {
  const metrics = await getMetrics(today);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) =>
        "error" in m ? (
          <div key={m.id} className="hud reveal p-4 text-sm text-ink-2">
            {m.label}: couldn&apos;t load right now.
          </div>
        ) : (
          <div key={m.id} className="hud reveal p-4">
            <div className="label">{m.label}</div>
            <div className="tabular mt-1 font-mono text-xl font-semibold">{fmt(m, m.latest)}</div>
            <Change m={m} />
            <Sparkline values={m.history} />
            <p className="mt-2 text-xs text-ink-2">{m.whyItMatters}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {m.tickers.filter((t) => owned.includes(t)).map((t) => (
                <span key={t} className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-2">
                  {t}
                </span>
              ))}
              <span className="ml-auto text-[11px] text-muted">as of {m.latestDate}</span>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
