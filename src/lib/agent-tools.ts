import "server-only";
import { getFinanceData } from "./data";
import { cashRunway, categoryStatus, idealToDate, monthInfo, spentThisMonth, suggestions } from "./finance";
import { monthlyBudgetTotal, type FinanceData } from "./mock-data";

// Read-only tools for the Claude connector. Each returns plain numbers (same
// math as the site) and can't change anything.

const round = (n: number) => Math.round(n * 100) / 100;

type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; additionalProperties: false };
  run: (data: FinanceData, args: Record<string, unknown>) => unknown;
};

function sumOf(d: FinanceData, types: string[]) {
  return d.accounts.filter((a) => types.includes(a.type)).reduce((s, a) => s + a.balance, 0);
}

const noArgs = { type: "object" as const, properties: {}, additionalProperties: false as const };

export const TOOLS: Tool[] = [
  {
    name: "get_overview",
    title: "Balances overview",
    description: "Net worth, cash, invested, and credit card owed, plus every account balance. Credit card balances are amounts owed.",
    inputSchema: noArgs,
    run: (d) => {
      const cash = sumOf(d, ["checking", "savings"]);
      const invested = sumOf(d, ["brokerage", "roth"]);
      const owed = sumOf(d, ["credit"]);
      return {
        asOf: d.today,
        dataSource: d.source === "plaid" ? "live bank data (Plaid)" : "SAMPLE data, not real",
        netWorth: round(cash + invested - owed),
        cash: round(cash),
        invested: round(invested),
        creditCardOwed: round(owed),
        accounts: d.accounts.map((a) => ({ name: a.name, type: a.type, institution: a.institution, balance: round(a.balance) })),
        notices: d.notices,
      };
    },
  },
  {
    name: "get_budget",
    title: "Budget status",
    description:
      "This month's budget: total, spent, left, pace vs. an even spread, each category's status (under/near/over pace), cash runway (how long cash lasts if income stopped), and suggestions.",
    inputSchema: noArgs,
    run: (d) => {
      const { dayOfMonth, daysInMonth, monthName } = monthInfo(d);
      const spent = spentThisMonth(d);
      const runway = cashRunway(d);
      return {
        asOf: d.today,
        month: monthName,
        day: `${dayOfMonth} of ${daysInMonth}`,
        monthlyBudget: monthlyBudgetTotal,
        spent: round(spent),
        left: round(monthlyBudgetTotal - spent),
        evenPaceSpendToDate: round(idealToDate(d)),
        categories: categoryStatus(d).map((c) => ({
          category: c.category,
          spent: round(c.spent),
          monthlyBudget: c.monthly,
          evenPaceToDate: round(c.idealToDate),
          status: c.status,
        })),
        cashRunway: {
          cashAfterCardPaid: round(runway.cash),
          months: round(runway.months),
          lastsUntil: runway.lastsUntil.toISOString().slice(0, 10),
        },
        suggestions: suggestions(d),
      };
    },
  },
  {
    name: "get_transactions",
    title: "Recent transactions",
    description: "Purchases from the last N days (default 30, max 120), newest first. Amounts are dollars spent.",
    inputSchema: {
      type: "object",
      properties: { days: { type: "integer", minimum: 1, maximum: 120, description: "How many days back. Default 30." } },
      additionalProperties: false,
    },
    run: (d, args) => {
      const days = Math.min(120, Math.max(1, Math.floor(Number(args.days) || 30)));
      const from = new Date(new Date(d.today + "T12:00:00").getTime() - days * 86400000).toISOString().slice(0, 10);
      const list = d.transactions.filter((t) => t.date >= from);
      return {
        asOf: d.today,
        from,
        count: list.length,
        total: round(list.reduce((s, t) => s + t.amount, 0)),
        transactions: list.map((t) => ({ date: t.date, merchant: t.merchant, category: t.category, amount: round(t.amount), pending: Boolean(t.pending) })),
      };
    },
  },
  {
    name: "get_holdings",
    title: "Investment holdings",
    description: "Each investment holding (ticker, shares, price, value) and which account it's in (brokerage or Roth IRA).",
    inputSchema: noArgs,
    run: (d) => {
      const accountName = new Map(d.accounts.map((a) => [a.id, a.name]));
      return {
        asOf: d.today,
        holdings: [...d.holdings]
          .sort((a, b) => b.value - a.value)
          .map((h) => ({ ticker: h.ticker, name: h.name, account: accountName.get(h.accountId), shares: h.shares, price: round(h.price), value: round(h.value) })),
      };
    },
  },
];

export async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.run(await getFinanceData(), args);
}
