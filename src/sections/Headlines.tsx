import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { generalNews, TOPICS, topicWeights } from "@/lib/general-news";

const topicLabel = new Map<string, string>(TOPICS.map((t) => [t.id, t.label]));

// The date in New York, so "this morning's list" turns over at local midnight.
const todayNY = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

async function Stories() {
  await connection(); // a new list each morning
  const date = todayNY();
  const [{ stories, ranked, error }, weights] = await Promise.all([generalNews(date), topicWeights()]);
  const leaning = TOPICS.filter((t) => weights[t.id] > 1.15).map((t) => t.label);

  return (
    <>
      {(!ranked || error) && (
        <div className="mb-6 rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink-2">
          {error ?? "Claude isn't connected, so stories are ordered by coverage only."}
        </div>
      )}
      <ol className="space-y-5">
        {stories.map((s, i) => (
          <li key={s.id} className="flex gap-4">
            <span className="tabular w-6 shrink-0 pt-0.5 font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="text-xs text-muted">
                {s.source}
                {s.outlets > 1 && ` · ${s.outlets >= 5 ? "5+" : s.outlets} outlets`}
                {s.topic !== "other" && ` · ${topicLabel.get(s.topic)}`}
              </div>
              <a href={`/api/news/open?d=${date}&id=${encodeURIComponent(s.id)}`} target="_blank" rel="noreferrer" className="mt-1 block font-medium hover:text-accent">
                {s.headline}
              </a>
              {s.whyItMatters && <p className="mt-1 text-sm text-ink-2">{s.whyItMatters}</p>}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-xs text-muted">
        Ranked by how widely outlets cover a story and how much it could move markets, policy or an industry. Your topics raise a story&apos;s rank
        but never hide important news. {leaning.length > 0 ? `Leaning toward: ${leaning.join(", ")} (from what you open).` : "Opening stories teaches it what you like."}
      </p>
    </>
  );
}

export default function HeadlinesSection() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Headlines" subtitle="This morning's 10 most important stories" />
      <Suspense fallback={<p className="text-sm text-ink-2">Ranking this morning&apos;s news…</p>}>
        <Stories />
      </Suspense>
    </div>
  );
}
