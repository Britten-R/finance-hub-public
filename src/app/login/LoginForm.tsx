"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm({ next, needCode }: { next: string; needCode: boolean }) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className="w-full rounded-lg border border-line bg-page px-3 py-2 text-base"
      />
      {needCode && (
        <>
          <label className="block text-sm font-medium" htmlFor="code">
            Authenticator code
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            className="w-full rounded-lg border border-line bg-page px-3 py-2 text-base tracking-widest"
          />
          <p className="text-xs text-ink-2">New device: enter the 6-digit code from your authenticator app. This browser will be remembered for 90 days.</p>
        </>
      )}
      {error && <p className="text-sm text-critical">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-accent px-3 py-2 font-mono text-sm font-semibold tracking-widest text-on-accent uppercase disabled:opacity-60"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
