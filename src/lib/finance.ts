import { budgets, monthlyBudgetTotal, type FinanceData } from "./mock-data";

export const money = (n: number, cents = true) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });

// Calendar facts about the current month, from the data's "today".
export function monthInfo(d: FinanceData) {
  const [y, m, day] = d.today.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthName = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long" });
  return { dayOfMonth: day, daysInMonth, monthName, monthPrefix: d.today.slice(0, 7) };
}

export const thisMonth = (d: FinanceData) => d.transactions.filter((t) => t.date.startsWith(monthInfo(d).monthPrefix));

export const spentThisMonth = (d: FinanceData) => thisMonth(d).reduce((sum, t) => sum + t.amount, 0);

// Where spending "should" be today if the monthly budget were spread evenly.
export function idealToDate(d: FinanceData) {
  const { dayOfMonth, daysInMonth } = monthInfo(d);
  return (monthlyBudgetTotal * dayOfMonth) / daysInMonth;
}

// One point per day: actual cumulative spend vs. the even-pace ideal.
export function spendingPace(d: FinanceData) {
  const { dayOfMonth, daysInMonth } = monthInfo(d);
  const byDay = new Map<number, number>();
  for (const t of thisMonth(d)) {
    const day = Number(t.date.slice(8, 10));
    byDay.set(day, (byDay.get(day) ?? 0) + t.amount);
  }
  let running = 0;
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    if (day <= dayOfMonth) running += byDay.get(day) ?? 0;
    return {
      day,
      actual: day <= dayOfMonth ? Math.round(running) : null,
      ideal: Math.round((monthlyBudgetTotal * day) / daysInMonth),
    };
  });
}

export type CategoryStatus = {
  category: string;
  spent: number;
  monthly: number;
  idealToDate: number;
  status: "under" | "near" | "over";
};

export function categoryStatus(d: FinanceData): CategoryStatus[] {
  const { dayOfMonth, daysInMonth } = monthInfo(d);
  const month = thisMonth(d);
  return budgets.map((b) => {
    const spent = month.filter((t) => t.category === b.category).reduce((sum, t) => sum + t.amount, 0);
    const ideal = (b.monthly * dayOfMonth) / daysInMonth;
    const ratio = spent / ideal;
    return {
      category: b.category,
      spent,
      monthly: b.monthly,
      idealToDate: ideal,
      status: ratio > 1.1 ? "over" : ratio > 0.95 ? "near" : "under",
    };
  });
}

// How long cash would last at this budget if income stopped. Cash = checking + savings
// minus what's owed on the card.
export function cashRunway(d: FinanceData) {
  const sum = (types: string[]) => d.accounts.filter((a) => types.includes(a.type)).reduce((s, a) => s + a.balance, 0);
  const cash = sum(["checking", "savings"]) - sum(["credit"]);
  const months = cash / monthlyBudgetTotal;
  const today = new Date(d.today + "T12:00:00");
  const lastsUntil = new Date(today.getTime() + months * 30.4 * 86400000);
  const christmas = new Date(today.getFullYear(), 11, 25, 12);
  const daysToChristmas = Math.max(0, Math.round((christmas.getTime() - today.getTime()) / 86400000));
  return { cash, months, lastsUntil, daysToChristmas, neededToChristmas: (monthlyBudgetTotal / 30.4) * daysToChristmas };
}

// Simple rule-based suggestions. The Week page has the Claude-written ones.
export function suggestions(d: FinanceData): string[] {
  const { dayOfMonth, daysInMonth, monthName } = monthInfo(d);
  const daysLeft = daysInMonth - dayOfMonth;
  const statuses = categoryStatus(d);
  const tips: string[] = [];
  for (const c of statuses) {
    const left = c.monthly - c.spent;
    if (c.status === "over") {
      tips.push(
        left > 0
          ? `${c.category} is ahead of pace. To stay on budget, keep it under ${money(left / Math.max(daysLeft, 1))} a day for the rest of ${monthName}.`
          : `${c.category} is already ${money(-left)} over the monthly budget. Consider pausing it until next month.`,
      );
    }
  }
  const under = statuses.filter((c) => c.status === "under");
  if (under.length) {
    tips.push(`You're under pace on ${under.map((c) => c.category).join(", ")}. Nice work.`);
  }
  return tips;
}
