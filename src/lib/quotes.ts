import "server-only";
import { cacheLife } from "next/cache";

// Live prices from Yahoo Finance's public chart endpoint (free, no key).
// Plaid's prices can be a day old and it has no daily change, so this fills in.

export type Quote = { price: number; previousClose: number };

async function quote(ticker: string): Promise<Quote | null> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return null;
  const meta = (await res.json())?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;
  return typeof price === "number" && typeof previousClose === "number" && previousClose > 0 ? { price, previousClose } : null;
}

// Cached for a few minutes per set of tickers. A ticker that fails is just left out.
export async function getQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  "use cache";
  cacheLife("minutes");
  const results = await Promise.allSettled(tickers.map(quote));
  const out: Record<string, Quote> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) out[tickers[i]] = r.value;
  });
  return out;
}
