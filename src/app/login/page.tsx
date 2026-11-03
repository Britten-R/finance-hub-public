import { Suspense } from "react";
import { cookies } from "next/headers";
import { DEVICE_COOKIE, verifyToken } from "@/lib/session";
import LoginForm from "./LoginForm";

async function Form({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  // A browser that already passed the authenticator code only needs the password.
  const trusted = await verifyToken("device", (await cookies()).get(DEVICE_COOKIE)?.value);
  return <LoginForm next={typeof next === "string" ? next : "/"} needCode={!trusted} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <div className="hud mx-auto mt-16 max-w-sm p-6 md:mt-24">
      <h1 className="mb-1 font-mono text-lg font-semibold tracking-[0.2em] text-accent">FINANCE HUB</h1>
      <p className="mb-5 text-sm text-ink-2">Restricted access. Identify yourself.</p>
      <Suspense>
        <Form {...props} />
      </Suspense>
    </div>
  );
}
