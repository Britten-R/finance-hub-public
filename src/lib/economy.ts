import { cacheLife } from "next/cache";

// Live economic data from FRED (Federal Reserve Bank of St. Louis). Free, no key needed.

export type Metric = {
  id: string;
  label: string;
  unit: "%" | "pts";
  latest: number;
  latestDate: string;
  monthAgo: number | null;
  history: number[]; // ~last 90 days, oldest first
  tickers: string[];
  whyItMatters: string;
};

type Def = Omit<Metric, "latest" | "latestDate" | "monthAgo" | "history"> & {
  series: string;
  yoy?: boolean; // turn an index (CPI) into a year-over-year % change
};

const defs: Def[] = [
  {
    id: "fed",
    series: "DFF",
    label: "Fed funds rate",
    unit: "%",
    tickers: [],
    whyItMatters: "Sets what banks pay on deposits and charge on loans. Drives your savings account rate and your credit card's interest rate.",
  },
  {
    id: "t10",
    series: "DGS10",
    label: "10-year Treasury",
    unit: "%",
    tickers: ["VOO", "VTI", "RKLB"],
    whyItMatters: "When this rises, stocks often fall (fast-growing ones like Rocket Lab most), and loans get pricier.",
  },
  {
    id: "t2",
    series: "DGS2",
    label: "2-year Treasury",
    unit: "%",
    tickers: [],
    whyItMatters: "Tracks where traders expect the Fed to go next. A big drop usually means rate cuts are coming.",
  },
  {
    id: "cpi",
    series: "CPIAUCSL",
    label: "Inflation (yearly)",
    unit: "%",
    yoy: true,
    tickers: ["VOO", "VTI"],
    whyItMatters: "How fast prices are rising. Higher inflation makes rate cuts less likely and shrinks what your cash can buy.",
  },
  {
    id: "unemp",
    series: "UNRATE",
    label: "Unemployment",
    unit: "%",
    tickers: ["VOO", "VTI"],
    whyItMatters: "A rising rate signals a slowing economy, which tends to weigh on the broad market your index funds track.",
  },
  {
    id: "mort",
    series: "MORTGAGE30US",
    label: "30-year mortgage",
    unit: "%",
    tickers: [],
    whyItMatters: "Average home-loan rate. A quick read on how expensive borrowing is across the economy.",
  },
  {
    id: "spx",
    series: "SP500",
    label: "S&P 500",
    unit: "pts",
    tickers: ["VOO", "VTI"],
    whyItMatters: "The broad US stock market. Most of your portfolio moves with it.",
  },
  {
    id: "vix",
    series: "VIXCLS",
    label: "VIX (market fear)",
    unit: "pts",
    tickers: ["VOO", "VTI", "RKLB"],
    whyItMatters: "Expected stock-market swings. Above about 25 means investors are nervous; expect bumpy days.",
  },
];

async function fetchSeries(series: string, start: string): Promise<{ date: string; value: number }[]> {
  "use cache";
  cacheLife("hours");
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=${start}`);
  if (!res.ok) throw new Error(`FRED ${series}: ${res.status}`);
  const text = await res.text();
  return text
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [date, raw = ""] = line.split(",");
      // FRED leaves missing days (holidays) blank or "."; Number("") would wrongly be 0.
      return { date, value: raw.trim() === "" || raw.trim() === "." ? NaN : Number(raw) };
    })
    .filter((p) => p.date && Number.isFinite(p.value));
}

function daysBefore(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Last value on or before a date.
function valueAt(points: { date: string; value: number }[], date: string) {
  for (let i = points.length - 1; i >= 0; i--) if (points[i].date <= date) return points[i].value;
  return null;
}

export async function getMetrics(today: string): Promise<(Metric | { id: string; label: string; error: true })[]> {
  const start = daysBefore(today, 500);
  return Promise.all(
    defs.map(async ({ series, yoy, ...def }) => {
      try {
        let points = await fetchSeries(series, start);
        if (yoy) {
          points = points
            .map((p) => {
              const prior = valueAt(points, daysBefore(p.date, 360));
              return prior ? { date: p.date, value: Math.round((p.value / prior - 1) * 1000) / 10 } : null;
            })
            .filter((p): p is { date: string; value: number } => p !== null && p.date >= daysBefore(today, 140));
        }
        const last = points[points.length - 1];
        const cutoff = daysBefore(last.date, 90);
        return {
          ...def,
          latest: last.value,
          latestDate: last.date,
          monthAgo: valueAt(points, daysBefore(last.date, yoy ? 31 : 30)),
          history: points.filter((p) => p.date >= (yoy ? daysBefore(last.date, 365) : cutoff)).map((p) => p.value),
        };
      } catch {
        return { id: def.id, label: def.label, error: true as const };
      }
    }),
  );
}
