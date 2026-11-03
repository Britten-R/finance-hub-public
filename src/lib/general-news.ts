import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { upcomingEvents } from "./calendar";
import { coachConnected } from "./coach";
import { tag } from "./news";

// General news: at most 10 stories a day, ranked by how widely major outlets
// cover them and how much they could move markets, policy or an industry.
// Interest topics raise a story's score; they never filter stories out.
// Opening a story bumps its topic's weight, so tomorrow's ranking adapts.
// The day's list is stored in Redis so Claude ranks once per day.

export const TOPICS = [
  { id: "ai-research", label: "AI research", hint: "AI research papers that are being cited heavily" },
  { id: "ai-policy", label: "AI & tech policy", hint: "state AI laws, federal preemption, chip export controls" },
  { id: "macro-policy", label: "Economy & policy", hint: "large economic and policy shifts, significant executive orders (not routine noise)" },
  { id: "international", label: "International", hint: "international developments that affect US markets, e.g. major Chinese AI model releases" },
  { id: "deals", label: "Tech, PE & VC", hint: "tech, private equity and venture capital news, big mergers and deals" },
  { id: "pe-accounting", label: "PE & accounting", hint: "private equity acquisitions of accounting firms and regulators' responses" },
  { id: "energy", label: "Energy & gas", hint: "energy and gas price policy" },
  { id: "calendar-firms", label: "Your calendar", hint: "news about a firm or organization on the user's calendar this week" },
  { id: "voices", label: "Voices", hint: "a major essay, paper or episode by a major figure (e.g. Dario Amodei, Dwarkesh Patel); never routine posts" },
  { id: "breakthrough", label: "Breakthrough", hint: "a major breakthrough in any field (e.g. health or biotech) with wide impact" },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"] | "other";

export type GeneralStory = {
  id: string;
  headline: string;
  source: string;
  url: string;
  outlets: number; // how many outlets Google News groups under this story
  topic: TopicId;
  whyItMatters: string;
};

// Searches that widen the pool beyond top stories, so topic stories can compete.
const SEARCHES = [
  'AI research paper "state of the art" OR arXiv',
  '"AI law" OR "AI preemption" OR "export controls" chips',
  '"executive order" economy OR tariffs OR Fed',
  "China AI model release OR DeepSeek OR Qwen",
  '"private equity" OR "venture capital" acquisition OR merger OR funding round',
  '"private equity" "accounting firm" OR CPA',
  "gas prices energy policy",
  '"Dario Amodei" OR "Dwarkesh Patel" essay OR interview',
];
const SECTIONS = ["BUSINESS", "TECHNOLOGY", "SCIENCE", "HEALTH", "WORLD"];

type Candidate = Omit<GeneralStory, "topic" | "whyItMatters">;

async function feed(url: string, limit: number): Promise<Candidate[]> {
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
      url: tag(m[1], "link"),
      // Top stories list every outlet covering them; a single article counts as 1.
      outlets: Math.max(1, (tag(m[1], "description").match(/<li>/g) ?? []).length),
    };
  });
}

async function candidates(): Promise<Candidate[]> {
  const base = "https://news.google.com/rss";
  const tail = "hl=en-US&gl=US&ceid=US:en";
  const results = await Promise.allSettled([
    feed(`${base}?${tail}`, 40),
    ...SECTIONS.map((s) => feed(`${base}/headlines/section/topic/${s}?${tail}`, 12)),
    ...SEARCHES.map((q) => feed(`${base}/search?q=${encodeURIComponent(q + " when:2d")}&${tail}`, 6)),
  ]);
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  // Keep the first copy of a headline, but remember the widest coverage seen.
  const byHeadline = new Map<string, Candidate>();
  for (const c of all) {
    const prev = byHeadline.get(c.headline);
    byHeadline.set(c.headline, prev ? { ...prev, outlets: Math.max(prev.outlets, c.outlets) } : c);
  }
  return [...byHeadline.values()];
}

// ---- Learning: clicks per topic become weights between 0.5 and 2 ----

const redis = () => (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null);
const CLICKS_KEY = "news:clicks";
const dayKey = (date: string) => `news:general:${date}`;

export async function topicWeights(): Promise<Record<string, number>> {
  const clicks = ((await redis()?.hgetall<Record<string, number>>(CLICKS_KEY)) ?? {}) as Record<string, number>;
  const total = Object.values(clicks).reduce((s, n) => s + Number(n), 0);
  const weights: Record<string, number> = {};
  for (const t of TOPICS) {
    // With few clicks every weight stays near 1; heavy interest tops out at 2.
    const share = (Number(clicks[t.id] ?? 0) + 1) / (total + TOPICS.length);
    weights[t.id] = Math.min(2, Math.max(0.5, Math.round(share * TOPICS.length * 100) / 100));
  }
  return weights;
}

export async function recordOpen(date: string, storyId: string): Promise<string | null> {
  const db = redis();
  const stories = await db?.get<GeneralStory[]>(dayKey(date));
  const story = stories?.find((s) => s.id === storyId);
  if (!db || !story) return null;
  if (story.topic !== "other") await db.hincrby(CLICKS_KEY, story.topic, 1);
  return story.url;
}

// ---- Ranking ----

const rankSchema = {
  type: "object",
  additionalProperties: false,
  required: ["stories"],
  properties: {
    stories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "topic", "whyItMatters"],
        properties: {
          index: { type: "integer" },
          topic: { type: "string", enum: [...TOPICS.map((t) => t.id), "other"] },
          whyItMatters: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `You pick the morning's most important news for a college student interested in policy, finance and AI.
From the numbered candidates, choose AT MOST 10 distinct stories (no two about the same event), most important first.
Importance = how widely major outlets cover it ("outlets" is a strong signal) plus how much it could change markets, policy or an industry.
Interest topics (with weights; higher = the reader opens these more) RAISE a story's score but never exclude anything important.
"Voices" only for a major essay, paper or episode, never routine posts or quotes. "Breakthrough" qualifies even without a topic match if its impact is wide.
Skip routine noise, celebrity, sports, crime blotter and clickbait unless it truly matters.
For each pick, set "topic" to the best-matching topic id or "other", and write "whyItMatters": one plain sentence on the stakes.`;

async function rank(list: Candidate[], weights: Record<string, number>, firms: string[]): Promise<GeneralStory[]> {
  const response = await new Anthropic().beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: rankSchema } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          topics: TOPICS.map((t) => ({ id: t.id, about: t.hint, weight: weights[t.id] })),
          calendarThisWeek: firms,
          candidates: list.map((c, index) => ({ index, headline: c.headline, source: c.source, outlets: c.outlets })),
        }),
      },
    ],
  });
  if (response.stop_reason === "refusal") return [];
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return [];
  const picks = (JSON.parse(text.text) as { stories: { index: number; topic: TopicId; whyItMatters: string }[] }).stories;
  return picks
    .filter((p) => list[p.index])
    .slice(0, 10)
    .map((p) => ({ ...list[p.index], topic: p.topic, whyItMatters: p.whyItMatters }));
}

// Today's list (date in New York time). Built once per day, then reused.
export async function generalNews(date: string): Promise<{ stories: GeneralStory[]; ranked: boolean; error?: string }> {
  const db = redis();
  const saved = await db?.get<GeneralStory[]>(dayKey(date));
  if (saved?.length) return { stories: saved, ranked: true };

  const list = await candidates();
  if (!coachConnected()) {
    const byCoverage = [...list].sort((a, b) => b.outlets - a.outlets).slice(0, 10);
    return { stories: byCoverage.map((c) => ({ ...c, topic: "other", whyItMatters: "" })), ranked: false };
  }
  try {
    const { events } = await upcomingEvents(new Date());
    const stories = await rank(list, await topicWeights(), events.map((e) => e.title));
    if (stories.length) await db?.set(dayKey(date), stories, { ex: 60 * 60 * 24 * 3 });
    return { stories, ranked: true };
  } catch (err) {
    const message = err instanceof Anthropic.AuthenticationError ? "The Claude API key was rejected." : "Claude couldn't rank today's news.";
    return { stories: [...list].sort((a, b) => b.outlets - a.outlets).slice(0, 10).map((c) => ({ ...c, topic: "other", whyItMatters: "" })), ranked: false, error: message };
  }
}
