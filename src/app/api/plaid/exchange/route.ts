import { revalidateTag } from "next/cache";
import { plaidClient, plaidErrorMessage, saveItem } from "@/lib/plaid";
import { isSignedIn } from "@/lib/auth";

// After you log in through Plaid, swap the one-time public token for a
// permanent access token and store it on the server.
export async function POST(request: Request) {
  if (!(await isSignedIn())) return Response.json({ error: "Not signed in." }, { status: 401 });
  const { publicToken, institution, kind } = (await request.json()) as {
    publicToken: string;
    institution: string;
    kind: "bank" | "investments";
  };
  try {
    const res = await plaidClient().itemPublicTokenExchange({ public_token: publicToken });
    await saveItem({
      itemId: res.data.item_id,
      accessToken: res.data.access_token,
      institution,
      kind,
      linkedAt: new Date().toISOString(),
    });
    revalidateTag("plaid", { expire: 0 });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: plaidErrorMessage(err) }, { status: 500 });
  }
}
