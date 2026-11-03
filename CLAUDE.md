@AGENTS.md

# Finance Hub

Personal finance dashboard (budget, card spending, checking and savings, brokerage, Roth IRA, news, calendar, daily agenda). Used on a laptop and a phone.

## Stack
- Next.js 16 (App Router, `src/app`), React 19, TypeScript, Tailwind v4, Recharts.
- Pages: `/` overview, `/today`, `/week`, `/spending`, `/budget`, `/investments`, `/news`, `/headlines`.
- Money data comes from `getFinanceData()` in `src/lib/data.ts`: Plaid when accounts are linked, otherwise `sampleData()` in `src/lib/mock-data.ts`. Budget math (all functions take `FinanceData`) lives in `src/lib/finance.ts`.
- Plaid: `src/lib/plaid.ts`, routes in `src/app/api/plaid/`, connect buttons in `src/components/PlaidConnect.tsx`. Access tokens: `.data/plaid-items.json` (gitignored) locally, or AES-encrypted (`TOKEN_KEY`) in Upstash Redis when `KV_REST_API_URL` is set. `scripts/upload-plaid-items.mjs` copies the local file to Redis once.
- Login: `src/proxy.ts` sends every request without a valid signed cookie to `/login` (`DASHBOARD_PASSWORD`, `TOTP_SECRET`, `AUTH_SECRET`; `src/lib/session.ts`). Plaid API routes also check `isSignedIn()`.
- Budget: categories and caps in `budgets` (`src/lib/mock-data.ts`), Plaid category mapping in `budgetCategory()` (`src/lib/data.ts`). The Budget page shows cash runway.
- Claude connector (read-only): MCP server at `src/app/api/mcp/[key]/route.ts`, tools in `src/lib/agent-tools.ts`. Secret key in the URL; only its hash is in Redis. `node scripts/agent-key.mjs new | revoke`.
- Today (morning view): `src/lib/agenda.ts` builds Today / This Week from syllabus tasks + recruiting cards (synced by `node --env-file=.env.local scripts/sync-agenda.mjs` into Redis `agenda:school` / `agenda:recruiting`), Canvas (`CANVAS_ICS_URL`, live) and the calendar ("[CoS] Read:" events, classes, recruiting events, drives). Checks in Redis `agenda:done`; unchecked items since `agenda:since` roll over. Dev-only preview: `/today?asOf=<ISO date-time>`.
- Positions prices: `src/lib/quotes.ts` (Yahoo chart endpoint). Headlines: `src/lib/general-news.ts` (top 10/day stored in Redis, click weights in `news:clicks`).
- Live economy data: `src/lib/economy.ts` (FRED CSV, no key, cached hourly).
- Week page: `src/lib/calendar.ts` (.ics links via `CALENDAR_ICS_URLS`), `src/lib/coach.ts` (Claude tips via `ANTHROPIC_API_KEY`, cached hourly), `src/lib/profile.ts` (meal plan, habits). Both fall back to sample/rule-based output when unset. See `.env.example`.

## Commands
- `npm run dev`: local site at http://localhost:3000
- `npm run lint`, `npm run build`: run both before every commit.

## Rules
- Colors are CSS variables in `src/app/globals.css` (light and dark). Use those tokens, not raw hex.
- Never commit secrets. API keys go only in `.env.local`, which git ignores.
- The deployed app must require login.
- Keep explanations short and plain.
