import Anthropic from "@anthropic-ai/sdk";
import { cacheLife } from "next/cache";
import { coachConnected } from "./coach";
import type { Holding, NewsItem } from "./mock-data";

// Headlines come from Google News search feeds (free, no key): one search per
// holding plus a few economy topics. Claude then explains why each one matters
// to this portfolio and drops the off-topic ones.

// Broad index funds don't make news themselves; their market does.
const FUND_TOPICS: Record<string, string> = {
  VTI: "US stock market",
  VOO: "S&P 500",
  SPY: "S&P 500",
  IVV: "S&P 500",
  FXAIX: "S&P 500",
  FSKAX: "US stock market",
  QQQ: "Nasdaq tech stocks",
  VXUS: "international stocks",
  VEA: "international stocks",
  FTIHX: "international stocks",
  VWO: "emerging markets stocks",
  BND: "bond market",
  AGG: "bond market",
};

const ECONOMY_TOPICS = ["Federal Reserve interest rates", "inflation CPI", "jobs report unemployment"];

export const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

export const tag = (xml: string, name: string) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "").trim();

async function search(query: string, kind: NewsItem["kind"], tickers: string[], limit: number): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:3d")}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit).map((m) => {
    const source = tag(m[1], "source");
    const title = tag(m[1], "title");
    return {
      id: tag(m[1], "guid") || tag(m[1], "link"),
      headline: source && title.endsWith(` - ${source}`) ? title.slice(0, -(source.length + 3)) : title,
      source: source || "Google News",
      date: new Date(tag(m[1], "pubDate")).toISOString().slice(0, 10),
      url: tag(m[1], "link"),
      kind,
      tickers,
    };
  });
}

async function fetchHeadlines(holdings: { ticker: string; name: string }[]): Promise<NewsItem[]> {
  "use cache";
  cacheLife("hours");
  // Group tickers that share a topic (e.g. VOO and SPY both follow the S&P 500).
  const topics = new Map<string, string[]>();
  for (const h of holdings) {
    const q = FUND_TOPICS[h.ticker] ?? `"${h.ticker}" ${h.name.split(" ").slice(0, 3).join(" ")}`;
    topics.set(q, [...(topics.get(q) ?? []), h.ticker]);
  }
  const results = await Promise.allSettled([
    ...[...topics].map(([q, tickers]) => search(q, "holding", tickers, 4)),
    ...ECONOMY_TOPICS.map((q) => search(q, "economy", [], 3)),
  ]);
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  // The same story often shows up under two searches.
  return all.filter((h, i) => all.findIndex((o) => o.headline === h.headline) === i);
}

const explainSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "relevant", "whyItMatters"],
        properties: {
          index: { type: "integer" },
          relevant: { type: "boolean" },
          whyItMatters: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `You explain financial news to a college student who is a long-term investor.
You get their holdings (with each one's share of the portfolio) and a numbered list of headlines.
For each headline: set "relevant" to false if it is clickbait, a listicle, an ad, or unrelated to their holdings or the economy.
Otherwise write "whyItMatters": one or two plain sentences on how this could affect their holdings or money (savings rates, card interest), naming the ticker when it applies.
Be factual and calm. Explain effects; never tell them to buy, sell or time the market.`;

async function explain(context: string): Promise<{ index: number; relevant: boolean; whyItMatters: string }[]> {
  "use cache";
  cacheLife("hours");
  const response = await new Anthropic().beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 6000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: explainSchema } },
    system: SYSTEM,
    messages: [{ role: "user", content: context }],
  });
  if (response.stop_reason === "refusal") return [];
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return [];
  return (JSON.parse(text.text) as { items: { index: number; relevant: boolean; whyItMatters: string }[] }).items;
}

export async function portfolioNews(holdings: Holding[]): Promise<{ news: NewsItem[]; explained: boolean; error?: string }> {
  // Merge the same ticker across accounts and sort biggest first.
  const byTicker = new Map<string, { ticker: string; name: string; value: number }>();
  for (const h of holdings) {
    const cur = byTicker.get(h.ticker);
    byTicker.set(h.ticker, { ticker: h.ticker, name: h.name, value: (cur?.value ?? 0) + h.value });
  }
  const merged = [...byTicker.values()].sort((a, b) => b.value - a.value);

  let news: NewsItem[];
  try {
    news = await fetchHeadlines(merged.map(({ ticker, name }) => ({ ticker, name })));
  } catch {
    return { news: [], explained: false, error: "Couldn't reach Google News." };
  }
  news.sort((a, b) => b.date.localeCompare(a.date));
  if (!coachConnected() || news.length === 0) return { news, explained: false };

  const total = merged.reduce((s, h) => s + h.value, 0) || 1;
  const context = JSON.stringify({
    holdings: merged.map((h) => `${h.ticker} (${h.name}): ${Math.round((h.value / total) * 100)}%`),
    headlines: news.map((n, index) => ({ index, headline: n.headline, source: n.source, searchedFor: n.tickers.join(",") || "economy" })),
  });
  try {
    const notes = await explain(context);
    const keep = new Map(notes.filter((n) => n.relevant).map((n) => [n.index, n.whyItMatters]));
    return { news: news.flatMap((n, i) => (keep.has(i) ? [{ ...n, whyItMatters: keep.get(i) }] : [])), explained: true };
  } catch (err) {
    const message = err instanceof Anthropic.AuthenticationError ? "The Claude API key was rejected." : "Claude couldn't explain the headlines.";
    return { news, explained: false, error: message };
  }
}
