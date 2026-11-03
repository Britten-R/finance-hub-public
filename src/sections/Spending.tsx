import { Suspense } from "react";
import DataNotice from "@/components/DataNotice";
import SpendingPaceChart from "@/components/SpendingPaceChart";
import { Card, PageHeader } from "@/components/ui";
import { getFinanceData } from "@/lib/data";
import { money, monthInfo, spendingPace, spentThisMonth, thisMonth } from "@/lib/finance";
import type { Transaction } from "@/lib/mock-data";

const dayLabel = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

async function Spending({ notice }: { notice: boolean }) {
  const data = await getFinanceData();
  const { monthName } = monthInfo(data);
  const byDate = new Map<string, Transaction[]>();
  for (const t of thisMonth(data)) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);

  return (
    <>
      <p className="-mt-4 mb-6 text-sm text-ink-2">
        Every purchase in {monthName}: {money(spentThisMonth(data))} so far
      </p>
      {notice && <DataNotice data={data} />}

      <Card title="Running total vs. ideal pace" className="mb-6">
        <SpendingPaceChart data={spendingPace(data)} month={monthName} />
      </Card>

      <Card title="Transactions">
        {byDate.size === 0 && <p className="text-sm text-ink-2">No purchases yet this month.</p>}
        {[...byDate.entries()].map(([date, items]) => (
          <div key={date} className="mb-4 last:mb-0">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>{dayLabel(date)}</span>
              <span className="tabular">{money(items.reduce((s, t) => s + t.amount, 0))}</span>
            </div>
            <ul className="divide-y divide-line">
              {items.map((t) => (
                <li key={t.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span>
                    {t.merchant}
                    <span className="ml-2 text-xs text-ink-2">
                      {t.category}
                      {t.pending && " · pending"}
                    </span>
                  </span>
                  <span className="tabular">{money(t.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </>
  );
}

export default function SpendingSection({ notice = true }: { notice?: boolean }) {
  return (
    <>
      <PageHeader title="Spending" />
      <Suspense fallback={<p className="text-sm text-ink-2">Loading transactions…</p>}>
        <Spending notice={notice} />
      </Suspense>
    </>
  );
}
