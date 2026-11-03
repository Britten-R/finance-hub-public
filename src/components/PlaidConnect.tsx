"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

type Kind = "bank" | "investments";

// Opens Plaid's window once we have a link token, then saves the connection.
function LinkOpener({ token, kind, onDone }: { token: string; kind: Kind; onDone: (error?: string) => void }) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: async (publicToken, metadata) => {
      const res = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken, institution: metadata.institution?.name ?? "Unknown bank", kind }),
      });
      const body = await res.json();
      onDone(res.ok ? undefined : body.error);
    },
    onExit: (err) => onDone(err ? err.display_message ?? err.error_message : undefined),
  });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return null;
}

export default function PlaidConnect() {
  const router = useRouter();
  const [token, setToken] = useState<{ value: string; kind: Kind } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(kind: Kind) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/plaid/link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error);
      setBusy(false);
      return;
    }
    setToken({ value: body.linkToken, kind });
  }

  function done(err?: string) {
    setToken(null);
    setBusy(false);
    if (err) setError(err);
    router.refresh();
  }

  const button = "rounded-lg border border-line px-3 py-2 text-sm hover:bg-page disabled:opacity-50";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => start("bank")}>
          + Bank or credit card
        </button>
        <button className={button} disabled={busy} onClick={() => start("investments")}>
          + Brokerage or Roth IRA
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-critical">{error}</p>}
      {token && <LinkOpener token={token.value} kind={token.kind} onDone={done} />}
    </div>
  );
}
