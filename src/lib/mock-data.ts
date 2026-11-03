// Made-up sample data, used until real accounts are connected through Plaid.
// Every number, transaction and headline here is fake.

export type AccountType = "checking" | "savings" | "credit" | "brokerage" | "roth";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: number; // credit cards: amount owed
  institution?: string;
};

export type Transaction = {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  category: string;
  amount: number; // positive = money spent
  accountId: string;
  pending?: boolean;
};

export type Budget = { category: string; monthly: number };

export type Holding = {
  ticker: string;
  name: string;
  accountId: string;
  shares: number;
  price: number;
  value: number;
  dayChangePct: number | null; // Plaid doesn't provide this
};

export type NewsItem = {
  id: string;
  headline: string;
  source: string;
  date: string;
  kind: "holding" | "economy";
  tickers: string[];
  url?: string;
  whyItMatters?: string; // written by Claude; missing when Claude is not connected
};

export type FinanceData = {
  source: "sample" | "plaid";
  today: string; // YYYY-MM-DD
  accounts: Account[];
  transactions: Transaction[]; // newest first
  holdings: Holding[];
  history: { date: string; value: number }[] | null; // portfolio value over time, sample only
  institutions: string[];
  notices: string[];
};

// Example monthly budget. Edit the categories and caps to fit yours.
export const budgets: Budget[] = [
  { category: "Food out", monthly: 150 },
  { category: "Groceries", monthly: 200 },
  { category: "Travel & transport", monthly: 100 },
  { category: "Shopping & fun", monthly: 120 },
  { category: "Subscriptions", monthly: 40 },
  { category: "Other", monthly: 60 },
];

export const monthlyBudgetTotal = budgets.reduce((sum, b) => sum + b.monthly, 0);

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Seeded random numbers so the fake data is the same on every page load.
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const merchants: Record<string, string[]> = {
  "Food out": ["Chipotle", "Corner Cafe", "Pizza Place", "Taco Truck"],
  Groceries: ["Grocery Mart", "Aldi"],
  "Travel & transport": ["Uber", "City Bus", "Gas Station"],
  "Shopping & fun": ["Amazon", "Target", "AMC Theatres"],
  Subscriptions: ["Streaming Service", "Music App", "Cloud Storage"],
};

const typicalAmount: Record<string, [number, number]> = {
  "Food out": [3, 25],
  Groceries: [15, 60],
  "Travel & transport": [5, 30],
  "Shopping & fun": [8, 30],
  Subscriptions: [5, 15],
};

// Card transactions for the current month, from the 1st up to today.
function sampleTransactions(today: Date): Transaction[] {
  const rand = seeded(today.getFullYear() * 100 + today.getMonth() + 1);
  const result: Transaction[] = [];
  const categories = Object.keys(merchants);
  for (let day = 1; day <= today.getDate(); day++) {
    const count = Math.floor(rand() * 2.3);
    for (let i = 0; i < count; i++) {
      const category = categories[Math.floor(rand() * categories.length)];
      const names = merchants[category];
      const [lo, hi] = typicalAmount[category];
      result.push({
        id: `t${day}-${i}`,
        date: isoDate(new Date(today.getFullYear(), today.getMonth(), day)),
        merchant: names[Math.floor(rand() * names.length)],
        category,
        amount: Math.round((lo + rand() * (hi - lo)) * 100) / 100,
        accountId: "cc",
      });
    }
  }
  return result.reverse(); // newest first
}

const sampleHoldings: Omit<Holding, "value">[] = [
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", accountId: "roth", shares: 10, price: 550, dayChangePct: 0.5 },
  { ticker: "BND", name: "Vanguard Total Bond Market ETF", accountId: "roth", shares: 20, price: 72, dayChangePct: -0.1 },
  { ticker: "MSFT", name: "Microsoft", accountId: "brk", shares: 5, price: 450, dayChangePct: 0.8 },
  { ticker: "KO", name: "Coca-Cola", accountId: "brk", shares: 25, price: 65, dayChangePct: -0.4 },
];

// 90 days of fake total portfolio value ending at today's total.
function sampleHistory(today: Date, end: number) {
  const rand = seeded(42);
  const points: { date: string; value: number }[] = [];
  let value = end * 0.92;
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    value = i === 0 ? end : value * (1 + (rand() - 0.47) * 0.02);
    points.push({ date: isoDate(d), value: Math.round(value) });
  }
  return points;
}

export function sampleData(today: Date, notices: string[] = []): FinanceData {
  const transactions = sampleTransactions(today);
  const holdings = sampleHoldings.map((h) => ({ ...h, value: h.shares * h.price }));
  const sumFor = (id: string) => holdings.filter((h) => h.accountId === id).reduce((s, h) => s + h.value, 0);
  const accounts: Account[] = [
    { id: "chk", name: "Everyday Checking", type: "checking", balance: 2500 },
    { id: "sav", name: "High-Yield Savings", type: "savings", balance: 8000 },
    { id: "cc", name: "Rewards Credit Card", type: "credit", balance: transactions.reduce((s, t) => s + t.amount, 0) },
    { id: "brk", name: "Brokerage", type: "brokerage", balance: sumFor("brk") },
    { id: "roth", name: "Roth IRA", type: "roth", balance: sumFor("roth") },
  ];
  return {
    source: "sample",
    today: isoDate(today),
    accounts,
    transactions,
    holdings,
    history: sampleHistory(today, holdings.reduce((s, h) => s + h.value, 0)),
    institutions: [],
    notices,
  };
}
