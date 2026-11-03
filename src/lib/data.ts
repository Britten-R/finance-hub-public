import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { AccountBase, Transaction as PlaidTransaction } from "plaid";
import { isoDate, sampleData, type Account, type FinanceData, type Holding, type Transaction } from "./mock-data";
import { plaidClient, plaidConfigured, plaidErrorMessage, readItems, type PlaidItem } from "./plaid";

// The one place pages get money data from: real Plaid data when accounts are
// connected, otherwise the sample data.

// Plaid labels these "general services", but they're monthly subscriptions.
const SUBSCRIPTION_MERCHANTS = /anthropic|claude|openai|chatgpt|linkedin|spotify|netflix|icloud|apple\.com\/bill/i;

// Plaid's spending categories mapped onto our budget categories.
function budgetCategory(t: PlaidTransaction): string | null {
  const primary = t.personal_finance_category?.primary ?? "";
  const detailed = t.personal_finance_category?.detailed ?? "";
  const merchant = `${t.merchant_name ?? ""} ${t.name}`;
  if (["TRANSFER_IN", "TRANSFER_OUT", "LOAN_PAYMENTS", "INCOME", "BANK_FEES"].includes(primary)) return null;
  if (SUBSCRIPTION_MERCHANTS.test(merchant) || detailed.startsWith("ENTERTAINMENT_TV") || detailed.includes("SUBSCRIPTION")) return "Subscriptions";
  // 7-Eleven is labeled a convenience store, but it's food.
  if (detailed === "GENERAL_MERCHANDISE_CONVENIENCE_STORES" || /7.?eleven/i.test(merchant)) return "Food out";
  if (detailed === "FOOD_AND_DRINK_GROCERIES") return "Groceries";
  if (primary === "FOOD_AND_DRINK") return "Food out";
  if (primary === "TRANSPORTATION" || primary === "TRAVEL") return "Travel & transport";
  if (primary === "GENERAL_MERCHANDISE" || primary === "ENTERTAINMENT") return "Shopping & fun";
  return "Other";
}

function accountType(a: AccountBase): Account["type"] | null {
  const subtype = String(a.subtype ?? "");
  if (a.type === "credit") return "credit";
  if (a.type === "depository") return subtype === "savings" ? "savings" : "checking";
  if (a.type === "investment") return subtype.includes("roth") || subtype.includes("ira") ? "roth" : "brokerage";
  return null; // loans etc. aren't shown yet
}

async function loadItem(item: PlaidItem) {
  const client = plaidClient();
  const accounts: Account[] = [];
  const transactions: Transaction[] = [];
  const holdings: Holding[] = [];

  const accRes = await client.accountsGet({ access_token: item.accessToken });
  for (const a of accRes.data.accounts) {
    const type = accountType(a);
    if (!type) continue;
    accounts.push({
      id: a.account_id,
      name: a.official_name ?? a.name,
      type,
      balance: a.balances.current ?? 0,
      institution: item.institution,
    });
  }

  if (item.kind === "bank") {
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const res = await client.transactionsSync({ access_token: item.accessToken, cursor, count: 500 });
      for (const t of res.data.added) {
        const category = budgetCategory(t);
        if (!category || t.amount <= 0) continue; // only money going out
        transactions.push({
          id: t.transaction_id,
          date: t.date,
          merchant: t.merchant_name ?? t.name,
          category,
          amount: t.amount,
          accountId: t.account_id,
          pending: t.pending,
        });
      }
      cursor = res.data.next_cursor;
      if (!res.data.has_more) break;
    }
  } else {
    const res = await client.investmentsHoldingsGet({ access_token: item.accessToken });
    const securities = new Map(res.data.securities.map((s) => [s.security_id, s]));
    for (const h of res.data.holdings) {
      const s = securities.get(h.security_id);
      if (s?.type === "cash") continue;
      holdings.push({
        ticker: s?.ticker_symbol ?? "—",
        name: s?.name ?? "Unknown security",
        accountId: h.account_id,
        shares: h.quantity,
        price: h.institution_price,
        value: h.institution_value,
        dayChangePct: null,
      });
    }
  }
  return { accounts, transactions, holdings };
}

export async function getFinanceData(): Promise<FinanceData> {
  "use cache";
  cacheTag("plaid");
  cacheLife("minutes");
  const now = new Date();
  if (!plaidConfigured()) return sampleData(now);
  const items = await readItems();
  if (items.length === 0) return sampleData(now);

  const results = await Promise.allSettled(items.map(loadItem));
  const notices: string[] = [];
  const data: FinanceData = {
    source: "plaid",
    today: isoDate(now),
    accounts: [],
    transactions: [],
    holdings: [],
    history: null,
    institutions: items.map((i) => i.institution),
    notices,
  };
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      data.accounts.push(...r.value.accounts);
      data.transactions.push(...r.value.transactions);
      data.holdings.push(...r.value.holdings);
    } else {
      notices.push(`${items[i].institution}: ${plaidErrorMessage(r.reason)}`);
    }
  });
  data.transactions.sort((a, b) => b.date.localeCompare(a.date));
  if (items.some((i) => i.kind === "bank") && data.transactions.length === 0) {
    notices.push("Plaid is still pulling your transactions. Refresh in a minute.");
  }
  return data;
}
