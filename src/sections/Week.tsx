import { connection } from "next/server";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui";
import { upcomingEvents } from "@/lib/calendar";
import { weeklyTips } from "@/lib/coach";
import { getFinanceData } from "@/lib/data";
import { money } from "@/lib/finance";

const dayLabel = (iso: string) =>
  new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

async function WeekPlan() {
  await connection(); // personal, live page: render on every request
  const data = await getFinanceData();
  const { events, sample, error: calError } = await upcomingEvents(new Date());
  const { tips, source, error: tipError } = await weeklyTips(events, data);

  return (
    <>
      {(sample || source === "rules" || calError || tipError) && (
        <div className="mb-6 space-y-1 rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink-2">
          {sample && <p>Sample calendar: your Outlook calendar isn&apos;t connected yet.</p>}
          {source === "rules" && <p>Simple rule-based tips: Claude isn&apos;t connected yet.</p>}
          {calError && <p>{calError}</p>}
          {tipError && <p>{tipError}</p>}
        </div>
      )}

      <Card title={source === "claude" ? "Tips from Claude" : "Tips"} className="mb-6">
        {tips.length === 0 ? (
          <p className="text-sm text-ink-2">No tips this week.</p>
        ) : (
          <ul className="divide-y divide-line">
            {tips.map((t, i) => (
              <li key={i} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{t.title}</p>
                  {t.estimatedSavings ? (
                    <span className="shrink-0 text-xs text-good-text">saves ~{money(t.estimatedSavings, false)}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-ink-2">{t.detail}</p>
                {t.day && <p className="mt-1 text-xs text-muted">{dayLabel(t.day)}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Next 7 days">
        {events.length === 0 ? (
          <p className="text-sm text-ink-2">Nothing on your calendar.</p>
        ) : (
          <ul className="divide-y divide-line">
            {events.map((e, i) => (
              <li key={i} className="flex gap-4 py-2 text-sm">
                <span className="w-28 shrink-0 text-ink-2">
                  {dayLabel(e.start)}
                  {!e.allDay && <span className="block text-xs text-muted">{timeLabel(e.start)}</span>}
                </span>
                <span>
                  {e.title}
                  {e.location && <span className="block text-xs text-ink-2">{e.location}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function WeekSection() {
  return (
    <>
      <PageHeader title="This week" subtitle="Your plans, and how to spend smarter around them" />
      <Suspense fallback={<p className="text-sm text-ink-2">Reading your calendar…</p>}>
        <WeekPlan />
      </Suspense>
    </>
  );
}
