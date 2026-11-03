import { Suspense } from "react";
import EconomyPanel from "@/components/EconomyPanel";
import NewsList from "@/components/NewsList";
import { Card, PageHeader } from "@/components/ui";
import { getFinanceData } from "@/lib/data";
import { portfolioNews } from "@/lib/news";

async function Economy() {
  const { today, holdings } = await getFinanceData();
  return <EconomyPanel today={today} owned={holdings.map((h) => h.ticker)} />;
}

async function Headlines() {
  const { holdings } = await getFinanceData();
  const { news, explained, error } = await portfolioNews(holdings);
  return (
    <>
      {(!explained || error) && (
        <div className="mb-6 rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink-2">
          {error ?? "Claude isn't connected, so headlines are unfiltered and have no explanations."}
        </div>
      )}
      <Card title="About your holdings" className="mb-6">
        <NewsList news={news.filter((n) => n.kind === "holding")} />
      </Card>
      <Card title="Economy and markets" className="mb-6">
        <NewsList news={news.filter((n) => n.kind === "economy")} />
      </Card>
    </>
  );
}

export default function NewsSection() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Portfolio news" subtitle="Stories that affect what you own, and why" />
      <section className="mb-8">
        <h2 className="mb-1 text-sm font-medium">Live economy</h2>
        <p className="mb-3 text-xs text-ink-2">Real data from the Federal Reserve (FRED), refreshed hourly.</p>
        <Suspense fallback={<p className="text-sm text-ink-2">Loading live data…</p>}>
          <Economy />
        </Suspense>
      </section>

      <h2 className="mb-1 text-sm font-medium">Headlines</h2>
      <p className="mb-3 text-xs text-ink-2">From Google News, picked for your holdings. Refreshed hourly.</p>
      <Suspense fallback={<p className="text-sm text-ink-2">Finding stories about your holdings…</p>}>
        <Headlines />
      </Suspense>
    </div>
  );
}
