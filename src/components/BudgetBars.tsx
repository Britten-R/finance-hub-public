import { money, type CategoryStatus } from "@/lib/finance";
import { StatusTag } from "./ui";

// One meter per category: filled = spent, tick = where you "should" be today.
export default function BudgetBars({ rows }: { rows: CategoryStatus[] }) {
  return (
    <ul className="space-y-5">
      {rows.map((r) => {
        const pct = Math.min((r.spent / r.monthly) * 100, 100);
        const idealPct = Math.min((r.idealToDate / r.monthly) * 100, 100);
        return (
          <li key={r.category}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{r.category}</span>
              <span className="tabular text-ink-2">
                {money(r.spent, false)} of {money(r.monthly, false)}
              </span>
            </div>
            <div
              className="relative h-2 rounded-full bg-grid"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={r.monthly}
              aria-valuenow={Math.round(r.spent)}
              aria-label={`${r.category}: ${money(r.spent)} of ${money(r.monthly)}`}
              title={`Ideal by today: ${money(r.idealToDate, false)}`}
            >
              <div
                className="h-2 rounded-full"
                style={{ width: `${pct}%`, background: r.status === "over" ? "var(--critical)" : "var(--series-1)" }}
              />
              <div className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${idealPct}%` }} aria-hidden />
            </div>
            <div className="mt-1">
              <StatusTag status={r.status} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
