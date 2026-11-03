import type { ReactNode } from "react";
import CountUp from "./CountUp";
import Globe from "./Globe";
import LiveClock from "./LiveClock";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="label flex items-center gap-2 whitespace-nowrap">
          <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          Secure link · <LiveClock />
        </div>
        <h1 className="mt-1 font-mono text-2xl font-semibold tracking-wide uppercase">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      <Globe size={76} className="shrink-0" />
    </header>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`hud reveal p-5 ${className}`}>
      {title && (
        <h2 className="label mb-4 flex items-center gap-2">
          <span aria-hidden className="h-3 w-0.5 bg-accent" />
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="hud reveal p-4">
      <div className="label">{label}</div>
      <div className="tabular mt-1 font-mono text-2xl font-semibold">
        <CountUp text={value} />
      </div>
      {note && <div className="mt-1 text-xs text-ink-2">{note}</div>}
    </div>
  );
}

// Status always pairs color with an icon and a word, never color alone.
export function StatusTag({ status }: { status: "under" | "near" | "over" }) {
  const map = {
    under: { icon: "✓", label: "On track", color: "var(--good)" },
    near: { icon: "!", label: "Near limit", color: "var(--warning)" },
    over: { icon: "▲", label: "Over pace", color: "var(--critical)" },
  }[status];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-2">
      <span
        aria-hidden
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: map.color, color: status === "near" ? "var(--on-warning)" : "var(--on-accent)" }}
      >
        {map.icon}
      </span>
      {map.label}
    </span>
  );
}
