import type { NewsItem } from "@/lib/mock-data";

const dayLabel = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function NewsList({ news }: { news: NewsItem[] }) {
  if (news.length === 0) return <p className="text-sm text-ink-2">No stories in the last 3 days.</p>;
  return (
    <ul className="divide-y divide-line">
      {news.map((n) => (
        <li key={n.id} className="py-3 first:pt-0 last:pb-0">
          <div className="text-xs text-muted">
            {n.source} · {dayLabel(n.date)}
          </div>
          <a href={n.url} target="_blank" rel="noreferrer" className="mt-1 block font-medium hover:text-series-1">
            {n.headline}
          </a>
          {n.whyItMatters && (
            <p className="mt-1 text-sm text-ink-2">
              <span className="font-medium text-ink">Why it matters: </span>
              {n.whyItMatters}
            </p>
          )}
          {n.tickers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {n.tickers.map((t) => (
                <span key={t} className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-2">
                  {t}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
