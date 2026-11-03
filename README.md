# Finance Hub

A private, single-user personal dashboard: budget, card spending, checking and savings, brokerage and Roth IRA, live prices, economy data, news, calendar, and a daily Today / This Week checklist. It works on a laptop and a phone, and has a read-only Claude connector so a Claude chat can check your budget.

Built with Next.js 16, React 19, TypeScript, Tailwind v4 and Recharts. Hosted on Vercel.

**Everything in this repo is sample data.** Until you connect your own accounts, the site shows made-up balances, transactions and holdings.

## Features
- **Login gate:** a password plus a 6-digit authenticator code on every page, with a lockout after 5 wrong tries.
- **Accounts:** banks, cards and brokerage accounts through [Plaid](https://plaid.com). Access tokens are encrypted (AES-256-GCM) before they're stored.
- **Budget:** monthly caps per category, spending pace, and cash runway.
- **Investments:** live prices (Yahoo chart endpoint) with daily change in $ and %.
- **Economy:** a few FRED series (no key needed).
- **News:** news for your holdings, plus a daily top-10 ranked by Claude that learns from what you open.
- **Week:** calendar from private .ics links, plus Claude-written budgeting tips.
- **Today:** tasks from syllabi (via a sync script), Canvas due dates and calendar events, with checkboxes. Unchecked items roll over.
- **Claude connector:** a minimal, read-only MCP server at `/api/mcp/<secret-key>`.

## Run it locally
```bash
npm install
cp .env.example .env.local     # then fill in what you need; everything is optional except the login values
node scripts/setup-2fa.mjs     # creates TOTP_SECRET and shows a QR code for your authenticator app
npm run dev                    # http://localhost:3000
```

## Deploy
1. Push to your own GitHub repo, and import it in Vercel.
2. Add every variable from `.env.local` in Vercel → Settings → Environment Variables.
3. Add Upstash Redis from Vercel's Storage/Marketplace tab (free tier). It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
4. Start Plaid in `sandbox`. Switch `PLAID_ENV` to `production` only after Plaid approves production access.

## Security notes
- Never commit `.env.local` or `.data/`. Both are in `.gitignore`.
- The calendar `.ics` links and the connector URL are secrets. Anyone with one can read what it points to.
- Nothing here moves money. Plaid is used read-only.

## License
MIT. See [LICENSE](LICENSE).
