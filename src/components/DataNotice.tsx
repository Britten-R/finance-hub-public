import type { FinanceData } from "@/lib/mock-data";

// Says where the numbers come from, plus any connection problems.
export default function DataNotice({ data }: { data: FinanceData }) {
  return (
    <div className="mb-6 space-y-1 rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink-2">
      {data.source === "sample" ? (
        <p>Sample data: every number here is made up. Connect accounts on the Overview page.</p>
      ) : (
        <p>Live from Plaid: {data.institutions.join(", ")}.</p>
      )}
      {data.notices.map((n) => (
        <p key={n} className="text-critical">
          {n}
        </p>
      ))}
    </div>
  );
}
