import { Suspense } from "react";
import DataNotice from "@/components/DataNotice";
import PortfolioChart from "@/components/PortfolioChart";
import { Card, PageHeader, Stat } from "@/components/ui";
import { getFinanceData } from "@/lib/data";
import { money } from "@/lib/finance";
import { getQuotes } from "@/lib/quotes";

const up = (n: number) => ({ color: n >= 0 ? "var(--good-text)" : "var(--critical)" });
const arrow = (n: number) => (n >= 0 ? "▲" : "▼");
const fmtShares = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

async function Investments({ notice }: { notice: boolean }) {
  const data = await getFinanceData();
  const accounts = data.accounts.filter((a) => a.type === "brokerage" || a.type === "roth");
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const accountName = new Map(data.accounts.map((a) => [a.id, a.name]));
  const quotes = await getQuotes([...new Set(data.holdings.map((h) => h.ticker))].sort());
  // Live price when available; otherwise Plaid's price and no daily change.
  const holdings = data.holdings
    .map((h) => {
      const q = quotes[h.ticker];
      const price = q?.price ?? h.price;
      const value = q ? h.shares * q.price : h.value;
      const dayChange = q ? h.shares * (q.price - q.previousClose) : null;
      const dayPct = q ? (q.price / q.previousClose - 1) * 100 : null;
      return { ...h, price, value, dayChange, dayPct };
    })
    .sort((a, b) => b.value - a.value);
  const priced = holdings.filter((h) => h.dayChange !== null);
  const dayTotal = priced.reduce((s, h) => s + (h.dayChange ?? 0), 0);
  const dayBase = priced.reduce((s, h) => s + h.value - (h.dayChange ?? 0), 0);
  const history = data.history;
  const change = history ? total - history[0].value : null;

  return (
    <>
      {notice && <DataNotice data={data} />}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat
          label="Total invested"
          value={money(total, false)}
          note={
            priced.length > 0 ? (
              <span style={up(dayTotal)}>
                {arrow(dayTotal)} {money(Math.abs(dayTotal), false)} ({Math.abs((dayTotal / dayBase) * 100).toFixed(2)}%) today
              </span>
            ) : change !== null ? (
              <span style={up(change)}>
                {arrow(change)} {money(Math.abs(change), false)} in 90 days
              </span>
            ) : undefined
          }
        />
        {accounts.map((a) => (
          <Stat key={a.id} label={a.name} value={money(a.balance, false)} note={a.institution} />
        ))}
      </div>

      {history && (
        <Card title="Total value, last 90 days" className="mb-6">
          <PortfolioChart data={history} />
        </Card>
      )}

      <Card title="Holdings">
        {holdings.length === 0 ? (
          <p className="text-sm text-ink-2">No holdings yet. Connect a brokerage or Roth IRA on the Overview page.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 font-normal">Holding</th>
                  <th className="pb-2 font-normal">Account</th>
                  <th className="pb-2 text-right font-normal">Price</th>
                  <th className="pb-2 text-right font-normal">Shares</th>
                  <th className="pb-2 text-right font-normal">Value</th>
                  <th className="pb-2 text-right font-normal">Today</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {holdings.map((h, i) => (
                  <tr key={`${h.accountId}-${h.ticker}-${i}`}>
                    <td className="py-2 font-medium">{h.ticker}</td>
                    <td className="py-2 text-ink-2">{accountName.get(h.accountId) ?? "—"}</td>
                    <td className="py-2 text-right">{money(h.price)}</td>
                    <td className="py-2 text-right">{fmtShares(h.shares)}</td>
                    <td className="py-2 text-right">{money(h.value, false)}</td>
                    {h.dayChange === null || h.dayPct === null ? (
                      <td className="py-2 text-right text-muted">—</td>
                    ) : (
                      <td className="py-2 text-right" style={up(h.dayChange)}>
                        {arrow(h.dayChange)} {money(Math.abs(h.dayChange))}
                        <span className="block text-xs">{Math.abs(h.dayPct).toFixed(2)}%</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export default function InvestmentsSection({ notice = true }: { notice?: boolean }) {
  return (
    <>
      <PageHeader title="Investments" subtitle="Brokerage and Roth IRA" />
      <Suspense fallback={<p className="text-sm text-ink-2">Loading investments…</p>}>
        <Investments notice={notice} />
      </Suspense>
    </>
  );
}
