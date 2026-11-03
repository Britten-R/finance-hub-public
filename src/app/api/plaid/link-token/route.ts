import { CountryCode, Products } from "plaid";
import { plaidClient, plaidConfigured, plaidErrorMessage } from "@/lib/plaid";
import { isSignedIn } from "@/lib/auth";

// Creates a short-lived token that opens Plaid's "connect your bank" window.
export async function POST(request: Request) {
  if (!(await isSignedIn())) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (!plaidConfigured()) {
    return Response.json({ error: "Add PLAID_CLIENT_ID and PLAID_SECRET to .env.local first." }, { status: 400 });
  }
  const { kind } = (await request.json()) as { kind: "bank" | "investments" };
  try {
    const res = await plaidClient().linkTokenCreate({
      user: { client_user_id: "owner" },
      client_name: "Finance Hub",
      language: "en",
      country_codes: [CountryCode.Us],
      ...(kind === "investments"
        ? { products: [Products.Investments] }
        : {
            products: [Products.Transactions],
            transactions: { days_requested: 365 },
          }),
    });
    return Response.json({ linkToken: res.data.link_token });
  } catch (err) {
    return Response.json({ error: plaidErrorMessage(err) }, { status: 500 });
  }
}
