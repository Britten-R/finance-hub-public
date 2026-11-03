import { Suspense } from "react";
import BudgetBars from "@/components/BudgetBars";
import DataNotice from "@/components/DataNotice";
import { Card, PageHeader, Stat } from "@/components/ui";
import { getFinanceData } from "@/lib/data";
import { cashRunway, categoryStatus, money, monthInfo, spentThisMonth, suggestions } from "@/lib/finance";
import { monthlyBudgetTotal } from "@/lib/mock-data";

async function Budget({ notice }: { notice: boolean }) {
  const data = await getFinanceData();
  const { dayOfMonth, daysInMonth, monthName } = monthInfo(data);
  const spent = spentThisMonth(data);
  const left = monthlyBudgetTotal - spent;
  const runway = cashRunway(data);
  const until = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <>
      <p className="-mt-4 mb-6 text-sm text-ink-2">
        Day {dayOfMonth} of {daysInMonth} in {monthName}
      </p>
      {notice && <DataNotice data={data} />}

      <Card title="Cash runway" className="mb-6">
        <p className="text-sm">
          You have <strong>{money(runway.cash, false)}</strong> in cash after paying off your card. If income stopped, at this budget it would last{" "}
          <strong>
            {runway.months.toFixed(1)} months (to about {until(runway.lastsUntil)})
          </strong>
          .
        </p>
        {runway.daysToChristmas > 0 && (
          <p className="mt-2 text-sm text-ink-2">
            Christmas check: the next {runway.daysToChristmas} days need about {money(runway.neededToChristmas, false)}, leaving{" "}
            {money(runway.cash - runway.neededToChristmas, false)} for after the holidays.
          </p>
        )}
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Monthly budget" value={money(monthlyBudgetTotal, false)} />
        <Stat label="Spent" value={money(spent, false)} />
        <Stat
          label={left >= 0 ? "Left to spend" : "Over budget"}
          value={money(Math.abs(left), false)}
          note={left >= 0 ? `${money(left / Math.max(daysInMonth - dayOfMonth, 1), false)}/day for the rest of the month` : undefined}
        />
      </div>

      <Card title="Suggestions" className="mb-6">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {suggestions(data).map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </Card>

      <Card title="By category">
        <p className="mb-4 text-xs text-ink-2">The thin upright line on each bar shows where an even pace would put you today.</p>
        <BudgetBars rows={categoryStatus(data)} />
      </Card>
    </>
  );
}

export default function BudgetSection({ notice = true }: { notice?: boolean }) {
  return (
    <>
      <PageHeader title="Budget" />
      <Suspense fallback={<p className="text-sm text-ink-2">Loading budget…</p>}>
        <Budget notice={notice} />
      </Suspense>
    </>
  );
}
