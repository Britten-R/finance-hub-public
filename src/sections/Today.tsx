import { connection } from "next/server";
import { Suspense } from "react";
import AgendaCheck from "@/components/AgendaCheck";
import { Card, PageHeader } from "@/components/ui";
import { getAgenda, type AgendaItem } from "@/lib/agenda";

const dayLabel = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const timeLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
const duration = (min: number) => (min >= 60 ? `~${Math.round((min / 60) * 2) / 2} h` : `~${min} min`);

function Item({ item, showDue }: { item: AgendaItem; showDue?: boolean }) {
  const meta = [
    item.course ?? (item.area === "recruiting" ? "Recruiting" : item.area === "travel" ? "Travel" : undefined),
    showDue ? `due ${dayLabel(item.due)}${item.time ? ` ${timeLabel(item.time)}` : ""}` : item.time ? `by ${timeLabel(item.time)}` : undefined,
    item.estimateMin ? duration(item.estimateMin) : undefined,
  ].filter(Boolean);
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <AgendaCheck id={item.id} done={item.done} label={item.title} />
      <div className={`min-w-0 ${item.done ? "opacity-50" : ""}`}>
        {(item.rolledFrom || item.flag) && (
          <div className="mb-0.5 flex flex-wrap gap-2 text-xs font-medium" style={{ color: "var(--warning)" }}>
            {item.rolledFrom && <span>↻ Rolled over from {dayLabel(item.rolledFrom)}</span>}
            {item.flag && <span>⚑ {item.flag}</span>}
          </div>
        )}
        <p className={`font-medium ${item.done ? "line-through" : ""}`}>{item.title}</p>
        <p className="text-xs text-muted">{meta.join(" · ")}</p>
        {item.suggestedDay && <p className="mt-0.5 text-xs text-ink-2">Suggested: work on it {dayLabel(item.suggestedDay)}</p>}
        {item.detail && <p className="mt-1 text-sm whitespace-pre-line text-ink-2">{item.detail}</p>}
        {item.links && item.links.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-3 text-xs">
            {item.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {l.label} ↗
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

async function Agenda({ asOf }: { asOf?: Promise<string | undefined> }) {
  await connection(); // personal and time-based: build fresh each request
  // Dev-only "?asOf=YYYY-MM-DDTHH:MM" to preview another day; ignored when deployed.
  const preview = process.env.NODE_ENV === "development" ? await asOf : undefined;
  const { today, week, syncedAt, notes } = await getAgenda(preview ? new Date(preview) : new Date());
  return (
    <>
      {notes.length > 0 && (
        <div className="mb-6 space-y-1 rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink-2">
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Today">
          {today.length === 0 ? (
            <p className="text-sm text-ink-2">Nothing due today.</p>
          ) : (
            <ul className="divide-y divide-line">
              {today.map((i) => (
                <Item key={i.id} item={i} />
              ))}
            </ul>
          )}
        </Card>
        <Card title="This week">
          {week.length === 0 ? (
            <p className="text-sm text-ink-2">No big items in the next 7 days.</p>
          ) : (
            <ul className="divide-y divide-line">
              {week.map((i) => (
                <Item key={i.id} item={i} showDue />
              ))}
            </ul>
          )}
        </Card>
      </div>
      {syncedAt && (
        <p className="mt-3 text-xs text-muted">
          Syllabi and recruiting notes last synced {new Date(syncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Canvas and calendar are live.
        </p>
      )}
    </>
  );
}

export default function TodaySection({ asOf }: { asOf?: Promise<string | undefined> }) {
  return (
    <>
      <PageHeader title="Today" subtitle="What to do, in order, and what's coming this week" />
      <Suspense fallback={<p className="text-sm text-ink-2">Building your day…</p>}>
        <Agenda asOf={asOf} />
      </Suspense>
    </>
  );
}
