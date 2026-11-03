import { cacheLife } from "next/cache";
import ical, { type ParameterValue } from "node-ical";

// Reads Outlook (or any) calendars from private "publish" .ics links set in
// CALENDAR_ICS_URLS (comma-separated, in .env.local). Without it, shows sample events.

export type CalEvent = {
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
};

const text = (v: ParameterValue | undefined) => (v === undefined ? undefined : typeof v === "string" ? v : v.val);

export const calendarConnected = () => Boolean(process.env.CALENDAR_ICS_URLS?.trim());

async function fetchCalendar(url: string, fromISO: string, toISO: string): Promise<CalEvent[]> {
  "use cache";
  cacheLife("minutes");
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const data = await ical.async.fromURL(url);
  const events: CalEvent[] = [];
  for (const item of Object.values(data)) {
    if (!item || item.type !== "VEVENT") continue;
    // Busy-only feeds also list open time as "Free"; those aren't plans.
    if (text(item.summary)?.trim().toLowerCase() === "free") continue;
    for (const e of ical.expandRecurringEvent(item, { from, to, expandOngoing: true })) {
      events.push({
        title: text(e.summary) ?? "(no title)",
        start: new Date(e.start).toISOString(),
        end: new Date(e.end ?? e.start).toISOString(),
        allDay: e.isFullDay,
        location: text(item.location),
      });
    }
  }
  return events;
}

function sampleEvents(now: Date): CalEvent[] {
  const at = (dayOffset: number, h: number, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  // Days until the next given weekday (0 = Sunday), always 1-7 days ahead.
  const until = (weekday: number) => (weekday - now.getDay() + 7) % 7 || 7;
  const daysToSat = until(6);
  return [
    { title: "ECON 1010 lecture", start: at(until(2), 10, 10), end: at(until(2), 11, 25), allDay: false, location: "Main Hall" },
    { title: "Study group", start: at(until(3), 19), end: at(until(3), 21), allDay: false, location: "Library" },
    { title: "ECON 1010 lecture", start: at(until(4), 10, 10), end: at(until(4), 11, 25), allDay: false, location: "Main Hall" },
    { title: "Weekend trip with friends", start: at(daysToSat, 0), end: at(daysToSat + 2, 0), allDay: true, location: "Portland, ME" },
  ];
}

// The next 7 days of events, from every connected calendar, sorted by start time.
export async function upcomingEvents(now: Date): Promise<{ events: CalEvent[]; sample: boolean; error?: string }> {
  const to = new Date(now);
  to.setDate(to.getDate() + 7);
  if (!calendarConnected()) {
    return { events: sampleEvents(now).sort((a, b) => a.start.localeCompare(b.start)), sample: true };
  }
  // Round to the hour so the cache key doesn't change every request.
  const from = new Date(now);
  from.setMinutes(0, 0, 0);
  const urls = process.env.CALENDAR_ICS_URLS!.split(",").map((u) => u.trim()).filter(Boolean);
  const results = await Promise.allSettled(urls.map((u) => fetchCalendar(u, from.toISOString(), to.toISOString())));
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  // The same event can appear in more than one calendar (e.g. a "Personal Copy").
  const seen = new Set<string>();
  const events = all.filter((e) => {
    const key = `${e.title}|${e.start}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const failed = results.filter((r) => r.status === "rejected").length;
  return {
    events: events.filter((e) => e.end >= now.toISOString()).sort((a, b) => a.start.localeCompare(b.start)),
    sample: false,
    error: failed ? `${failed} of ${urls.length} calendars couldn't be loaded.` : undefined,
  };
}
