import Link from "next/link";
import { Suspense } from "react";
import DataNotice from "@/components/DataNotice";
import PlaidConnect from "@/components/PlaidConnect";
import SpendingPaceChart from "@/components/SpendingPaceChart";
import { Card, PageHeader, Stat } from "@/components/ui";
import { getFinanceData } from "@/lib/data";
import { idealToDate, money, monthInfo, spendingPace, spentThisMonth } from "@/lib/finance";
import type { Holding } from "@/lib/mock-data";
import { portfolioNews } from "@/lib/news";

async function TopNews({ holdings }: { holdings: Holding[] }) {
  const { news } = await portfolioNews(holdings);
  const top = news.find((n) => n.kind === "holding") ?? news[0];
  if (!top) return <p className="text-sm text-ink-2">No stories in the last 3 days.</p>;
  return (
    <>
      <a href={top.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:text-series-1">
        {top.headline}
      </a>
      {top.whyItMatters && <p className="mt-1 text-sm text-ink-2">{top.whyItMatters}</p>}
    </>
  );
}

async function Overview() {
  const data = await getFinanceData();
  const { accounts } = data;
  const { monthName } = monthInfo(data);
  const sum = (types: string[]) => accounts.filter((a) => types.includes(a.type)).reduce((s, a) => s + a.balance, 0);
  const cash = sum(["checking", "savings"]);
  const invested = sum(["brokerage", "roth"]);
  const owed = sum(["credit"]);
  const spent = spentThisMonth(data);
  const diff = spent - idealToDate(data);

  return (
    <>
      <DataNotice data={data} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Net worth" value={money(cash + invested - owed, false)} />
        <Stat label="Cash" value={money(cash, false)} note="Checking + savings" />
        <Stat label="Invested" value={money(invested, false)} note="Brokerage + Roth IRA" />
        <Stat label="Card balance" value={money(owed, false)} note="Currently owed" />
      </div>

      <Card title="Spending vs. ideal pace" className="mb-6">
        <p className="mb-3 text-sm">
          You&apos;ve spent <strong>{money(spent, false)}</strong> in {monthName}, which is{" "}
          <strong>
            {money(Math.abs(diff), false)} {diff > 0 ? "ahead of" : "behind"}
          </strong>{" "}
          an even pace.
        </p>
        <SpendingPaceChart data={spendingPace(data)} month={monthName} />
      </Card>

      <Card title="Accounts" className="mb-6">
        <ul className="mb-4 divide-y divide-line">
          {accounts.map((a) => (
            <li key={a.id} className="flex justify-between gap-3 py-2 text-sm">
              <span>
                {a.name}
                {a.institution && <span className="ml-2 text-xs text-ink-2">{a.institution}</span>}
              </span>
              <span className="tabular shrink-0 whitespace-nowrap">{a.type === "credit" ? `−${money(a.balance)}` : money(a.balance)}</span>
            </li>
          ))}
        </ul>
        <PlaidConnect />
      </Card>

      <Card title="Top news for you">
        <Suspense fallback={<p className="text-sm text-ink-2">Finding stories…</p>}>
          <TopNews holdings={data.holdings} />
        </Suspense>
        <Link href="/#news" className="mt-3 inline-block text-sm text-series-1">
          All news →
        </Link>
      </Card>
    </>
  );
}

export default function OverviewSection() {
  return (
    <>
      <PageHeader title="Overview" subtitle="Your money at a glance" />
      <Suspense fallback={<p className="text-sm text-ink-2">Loading your accounts…</p>}>
        <Overview />
      </Suspense>
    </>
  );
}
