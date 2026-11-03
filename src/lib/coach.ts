import Anthropic from "@anthropic-ai/sdk";
import { cacheLife } from "next/cache";
import type { CalEvent } from "./calendar";
import { categoryStatus, money, monthInfo, thisMonth } from "./finance";
import type { FinanceData } from "./mock-data";
import { profile } from "./profile";

export type Tip = {
  title: string;
  detail: string;
  day: string | null; // YYYY-MM-DD the tip applies to, if any
  estimatedSavings: number | null;
};

export const coachConnected = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

const tipSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tips"],
  properties: {
    tips: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "day", "estimatedSavings"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          day: { type: ["string", "null"] },
          estimatedSavings: { type: ["number", "null"] },
        },
      },
    },
  },
};

const SYSTEM = `You are a friendly personal-finance coach for a college student.
Read their calendar for the next 7 days, their budget status, recent card spending and personal facts.
Write 3 to 5 short, concrete tips tied to specific upcoming events: where to save, what spending target to set for a trip, or a cheaper swap (for example, using an already-paid dining hall swipe or dining dollars instead of buying coffee on the card).
Plain language, direct, no hedging. Each title is under 10 words; each detail is 1-2 sentences with a dollar figure when possible.
"day" is the event date (YYYY-MM-DD) or null. "estimatedSavings" is dollars saved or null.
If "spendingDataIsSample" is true, the budget and merchant numbers are made up: base tips on the calendar and profile, and don't quote those numbers.
These are budgeting tips, not investment advice.`;

function buildContext(events: CalEvent[], data: FinanceData) {
  const { dayOfMonth, daysInMonth } = monthInfo(data);
  const merchants = new Map<string, { count: number; total: number }>();
  for (const t of thisMonth(data)) {
    const m = merchants.get(t.merchant) ?? { count: 0, total: 0 };
    merchants.set(t.merchant, { count: m.count + 1, total: m.total + t.amount });
  }
  const topMerchants = [...merchants.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([name, m]) => `${name}: ${m.count} purchases, ${money(m.total)}`);
  return JSON.stringify(
    {
      today: data.today,
      spendingDataIsSample: data.source === "sample",
      monthProgress: `day ${dayOfMonth} of ${daysInMonth}`,
      budget: categoryStatus(data).map((c) => ({
        category: c.category,
        spent: Math.round(c.spent),
        monthly: c.monthly,
        status: c.status,
      })),
      topMerchantsThisMonth: topMerchants,
      profile,
      calendarNext7Days: events.map((e) => ({
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        location: e.location,
      })),
    },
    null,
    1,
  );
}

// Cached for an hour per unique input, so a page refresh doesn't cost another API call.
async function askClaude(context: string): Promise<Tip[]> {
  "use cache";
  cacheLife("hours");
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: tipSchema } },
    system: SYSTEM,
    messages: [{ role: "user", content: context }],
  });
  if (response.stop_reason === "refusal") return [];
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return [];
  return (JSON.parse(text.text) as { tips: Tip[] }).tips;
}

// Free fallback when no API key is set: a couple of simple rules.
function ruleTips(events: CalEvent[]): Tip[] {
  const tips: Tip[] = [];
  for (const e of events) {
    const day = e.start.slice(0, 10);
    if (e.allDay && /trip|weekend|visit/i.test(e.title)) {
      tips.push({
        title: `Set a food target for ${e.title}`,
        detail: "Trips are where budgets slip. Pick a food cap before you leave, such as $400 for the weekend, and check this dashboard each evening.",
        day,
        estimatedSavings: null,
      });
    } else if (/lecture|class|section/i.test(e.title)) {
      tips.push({
        title: "Use a swipe instead of buying coffee",
        detail: `Before ${e.title}, grab a snack at a dining hall with a meal swipe or dining dollars instead of paying for coffee on your card.`,
        day,
        estimatedSavings: 6,
      });
    }
  }
  const unique = tips.filter((t, i) => tips.findIndex((o) => o.title === t.title) === i);
  return unique.slice(0, 4);
}

export async function weeklyTips(events: CalEvent[], data: FinanceData): Promise<{ tips: Tip[]; source: "claude" | "rules"; error?: string }> {
  if (!coachConnected()) return { tips: ruleTips(events), source: "rules" };
  try {
    return { tips: await askClaude(buildContext(events, data)), source: "claude" };
  } catch (err) {
    const message = err instanceof Anthropic.AuthenticationError ? "The Claude API key was rejected." : "Claude couldn't be reached.";
    return { tips: ruleTips(events), source: "rules", error: message };
  }
}
