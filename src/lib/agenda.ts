import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { cacheLife } from "next/cache";
import ical from "node-ical";
import { upcomingEvents, type CalEvent } from "./calendar";
import { coachConnected } from "./coach";

// The morning view: Today and This Week task lists, built from
// - school tasks synced from the syllabi (scripts/sync-agenda.mjs → Redis),
// - Canvas due dates (CANVAS_ICS_URL, live),
// - the calendar: "[CoS] Read:" reminders, classes, recruiting events, drives,
// - recruiting cards (also synced) for coffee chat / interview prep.
// Checked items are stored in Redis; unchecked past items roll over to the top.

const TZ = "America/New_York";
const MPG = 28;
const ROLLOVER_DAYS = 14;

export type AgendaItem = {
  id: string;
  title: string;
  area: "school" | "recruiting" | "travel";
  course?: string;
  kind: string;
  due: string; // YYYY-MM-DD
  time?: string; // HH:MM, local
  estimateMin?: number;
  detail?: string;
  links?: { label: string; href: string }[];
  rolledFrom?: string; // the original due date, for unchecked items carried forward
  flag?: string; // e.g. "Exam in 4 days"
  suggestedDay?: string;
  done: boolean;
};

type SchoolTask = { id: string; course: string; title: string; kind: string; due: string; dueTime: string | null; estimateMin: number };
type Recruiting = {
  firms: { name: string; aliases: string[]; stage: string; nextStep: string; brief: string }[];
  people: { name: string; firm: string; role: string; lastContact: string | null; notes: string }[];
};

const redis = () => (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null);
const DONE_KEY = "agenda:done";
// The first day the panels ran. Items due before then never appeared on a list,
// so they can't have been "left unchecked" and don't roll over.
const SINCE_KEY = "agenda:since";

export const localDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const localTime = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const addDays = (date: string, n: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
const hashId = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
};

// "ECON1010", "HIST 2100-001", "[BIO3300/CHEM3300]" → "ECON 1010" etc.
const courseOf = (text: string) => {
  const m = text.match(/\b([A-Z]{2,6})\s?-?(\d{4})\b/);
  return m ? `${m[1].toUpperCase()} ${m[2]}` : undefined;
};

const BIG = new Set(["paper", "problem-set", "quiz", "exam", "debate", "presentation", "project"]);
const HEADS_UP = new Set(["quiz", "exam", "debate"]);
const isBig = (t: { kind: string; estimateMin?: number }) => BIG.has(t.kind) || (t.kind === "assignment" && (t.estimateMin ?? 0) >= 180);

// ---- Sources ----

async function canvasTasks(): Promise<SchoolTask[]> {
  "use cache";
  cacheLife("minutes");
  const url = process.env.CANVAS_ICS_URL?.trim();
  if (!url) return [];
  const out: SchoolTask[] = [];
  for (const e of Object.values(await ical.async.fromURL(url))) {
    if (!e || e.type !== "VEVENT") continue;
    const title = String(typeof e.summary === "string" ? e.summary : (e.summary?.val ?? "")).trim();
    if (/participation grade/i.test(title)) continue;
    let at = new Date(e.start);
    // Canvas marks "due 11:59pm" as midnight of the next day; show it on the day it's really due.
    if (localTime(at) === "00:00") at = new Date(at.getTime() - 60000);
    const kind = /quiz/i.test(title)
      ? "quiz"
      : /exam|prelim/i.test(title)
        ? "exam"
        : /paper/i.test(title)
          ? "paper"
          : /presentation/i.test(title)
            ? "presentation"
            : /project|check.?in/i.test(title)
              ? "project"
              : /debate/i.test(title)
                ? "debate"
                : "assignment";
    const estimate: Record<string, number> = { quiz: 60, exam: 240, paper: 480, presentation: 120, project: 180, debate: 180, assignment: 240 };
    out.push({
      id: `canvas:${hashId(String(e.uid ?? title))}`,
      course: courseOf(title) ?? "Canvas",
      title: title.replace(/\s*\[[^\]]+\]\s*$/, "").replace(/\s*-\s*Requires Respondus LockDown Browser/i, ""),
      kind,
      due: localDate(at),
      dueTime: localTime(at) === "23:59" ? null : localTime(at),
      estimateMin: estimate[kind],
    });
  }
  return out;
}

async function stored<T>(key: string): Promise<T | null> {
  return (await redis()?.get<T>(key)) ?? null;
}

// Rough one-way driving miles from HOME_LOCATION (e.g. "Springfield, IL"), cached for days per place.
async function milesFromHome(place: string): Promise<number | null> {
  "use cache";
  cacheLife("days");
  const home = process.env.HOME_LOCATION?.trim();
  if (!home || !coachConnected()) return null;
  const response = await new Anthropic().beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 200,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: { type: "object", additionalProperties: false, required: ["miles"], properties: { miles: { type: ["integer", "null"] } } } },
    },
    messages: [{ role: "user", content: `Approximate one-way driving distance in miles from ${home} to: ${place}. null if unknown or not drivable.` }],
  });
  const text = response.content.find((b) => b.type === "text");
  return text?.type === "text" ? (JSON.parse(text.text) as { miles: number | null }).miles : null;
}

// Latest US regular gas price (EIA via FRED, weekly, no key).
async function gasPrice(): Promise<number> {
  "use cache";
  cacheLife("days");
  try {
    const csv = await (await fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=GASREGW&cosd=2026-01-01")).text();
    const last = csv.trim().split("\n").reverse().find((l) => /,\d/.test(l));
    return last ? Number(last.split(",")[1]) : 3.5;
  } catch {
    return 3.5;
  }
}

const LOCAL = /hall|room|library|campus|virtual|online|zoom|teams|^\s*$/i;
const isDrive = (e: CalEvent) =>
  Boolean(e.location && !LOCAL.test(e.location) && (e.allDay || /drive|trip|visit|travel|road|airport/i.test(e.title)));

// ---- Building the lists ----

function recruitingPrep(e: CalEvent, rec: Recruiting | null): Omit<AgendaItem, "done"> | null {
  if (!rec) return null;
  const text = e.title.toLowerCase();
  const person = rec.people.find((p) => text.includes(p.name.toLowerCase()) || text.includes(p.name.split(" ")[0].toLowerCase() + " "));
  const firm =
    rec.firms.find((f) => [f.name, ...f.aliases].some((n) => n.length > 2 && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(e.title))) ??
    (person ? rec.firms.find((f) => f.name.toLowerCase().includes(person.firm.toLowerCase().split(" ")[0])) : undefined);
  const isRecruiting = /coffee|chat|interview|superday|info(rmation)? session|networking|recruit|call with/i.test(e.title);
  if (!firm && !person) return null;
  if (!isRecruiting && !person) return null;

  const contacts = person ? [person] : rec.people.filter((p) => firm && p.firm.toLowerCase().includes(firm.name.toLowerCase().split(" ")[0])).slice(0, 3);
  const lines: string[] = [];
  if (firm) lines.push(`${firm.brief} Your stage: ${firm.stage}. Next: ${firm.nextStep}.`);
  for (const p of contacts) lines.push(`${p.name} (${p.role || p.firm}), last contact ${p.lastContact ?? "unknown"}: ${p.notes}`);
  const start = new Date(e.start);
  return {
    id: `prep:${localDate(start)}:${hashId(e.title)}`,
    title: `Prep: ${e.title}`,
    area: "recruiting",
    kind: "prep",
    due: localDate(start),
    time: e.allDay ? undefined : localTime(start),
    estimateMin: 20,
    detail: lines.join("\n"),
    links: contacts.map((p) => ({
      label: `${p.name} on LinkedIn`,
      href: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${p.name} ${p.firm}`)}`,
    })),
  };
}

export async function getAgenda(now: Date): Promise<{ today: AgendaItem[]; week: AgendaItem[]; syncedAt: string | null; notes: string[] }> {
  const today = localDate(now);
  const startOfToday = new Date(`${today}T00:00:00`);
  const notes: string[] = [];

  const [school, rec, canvas, cal, doneMap] = await Promise.all([
    stored<{ syncedAt: string; items: SchoolTask[] }>("agenda:school"),
    stored<Recruiting>("agenda:recruiting"),
    canvasTasks().catch(() => {
      notes.push("Canvas couldn't be loaded.");
      return [] as SchoolTask[];
    }),
    upcomingEvents(startOfToday),
    redis()?.hgetall<Record<string, string>>(DONE_KEY) ?? null,
  ]);
  if (!school) notes.push("School tasks haven't been synced yet.");
  const db = redis();
  let since = (await db?.get<string>(SINCE_KEY)) ?? null;
  if (!since) {
    since = today;
    await db?.set(SINCE_KEY, today, { nx: true });
  }
  if (cal.error) notes.push(cal.error);
  const done = (id: string) => Boolean(doneMap?.[id]);

  // Calendar "[CoS] Read: COURSE — readings" reminders become reading tasks.
  const cosReads: SchoolTask[] = cal.events
    .filter((e) => /^\[CoS\]\s*Read:/i.test(e.title))
    .map((e) => ({
      id: `cos:${localDate(new Date(e.start))}:${hashId(e.title)}`,
      course: courseOf(e.title) ?? "Reading",
      title: e.title.replace(/^\[CoS\]\s*/i, "").replace(/^Read:\s*[A-Z]+\s?\d{4}\s*[—-]\s*/i, "Read "),
      kind: "reading",
      due: localDate(new Date(e.start)),
      dueTime: null,
      estimateMin: 60,
    }));

  // Merge, preferring Canvas (exact times) over the syllabus, and the syllabus
  // (better estimates) over the calendar reminders. Same course within a day = same task.
  const syllabus = school?.items ?? [];
  const near = (a: SchoolTask, b: SchoolTask) => a.course === b.course && Math.abs(daysBetween(a.due, b.due)) <= 1;
  const tasks = [
    ...canvas,
    ...syllabus.filter((s) => !(s.kind !== "reading" && canvas.some((c) => near(c, s)))),
    ...cosReads.filter((c) => !syllabus.some((s) => s.kind === "reading" && s.course === c.course && s.due === c.due)),
  ];

  const events = cal.events.filter((e) => !/^\[CoS\]/i.test(e.title));
  const eventsOn = (date: string) => events.filter((e) => localDate(new Date(e.start)) === date);
  const classTime = (course: string, date: string) => {
    const e = eventsOn(date).find((ev) => courseOf(ev.title) === course && !ev.allDay);
    return e ? localTime(new Date(e.start)) : undefined;
  };
  const toItem = (t: SchoolTask): AgendaItem => ({
    id: t.id,
    title: t.title,
    area: "school",
    course: t.course,
    kind: t.kind,
    due: t.due,
    // Readings are due when the class starts.
    time: t.dueTime ?? (t.kind === "reading" ? classTime(t.course, t.due) : undefined),
    estimateMin: t.estimateMin,
    done: done(t.id),
  });

  // ---- Today ----
  const todayList: AgendaItem[] = [];
  // Unchecked items from the last two weeks roll over, flagged, to the top.
  for (const t of tasks) {
    if (t.due < today && t.due >= since && t.due >= addDays(today, -ROLLOVER_DAYS) && !done(t.id)) todayList.push({ ...toItem(t), rolledFrom: t.due });
  }
  for (const t of tasks) if (t.due === today) todayList.push(toItem(t));

  for (const e of eventsOn(today)) {
    const prep = recruitingPrep(e, rec);
    if (prep) todayList.push({ ...prep, done: done(prep.id) });
    if (isDrive(e)) {
      const miles = await milesFromHome(e.location!).catch(() => null);
      if (miles) {
        const price = await gasPrice();
        const id = `gas:${today}:${hashId(e.title)}`;
        todayList.push({
          id,
          title: `Gas for ${e.title}`,
          area: "travel",
          kind: "drive",
          due: today,
          time: e.allDay ? undefined : localTime(new Date(e.start)),
          detail: `About ${miles * 2} miles round trip to ${e.location}. At ${MPG} mpg and $${price.toFixed(2)}/gal, plan on roughly $${Math.round(((miles * 2) / MPG) * price)} for gas.`,
          done: done(id),
        });
      }
    }
  }
  const areaRank = { school: 0, recruiting: 1, travel: 2 };
  todayList.sort(
    (a, b) =>
      Number(!a.rolledFrom) - Number(!b.rolledFrom) ||
      (a.rolledFrom ?? "").localeCompare(b.rolledFrom ?? "") ||
      (a.time ?? "99").localeCompare(b.time ?? "99") ||
      areaRank[a.area] - areaRank[b.area],
  );

  // ---- This week ----
  // Suggest the lightest day before each due date, counting classes/events and
  // work already suggested for that day, so big items don't pile up on one day.
  const planned = new Map<string, number>();
  const load = (date: string) => eventsOn(date).filter((e) => !e.allDay).length + 3 * (planned.get(date) ?? 0);
  const suggest = (t: SchoolTask) => {
    const lead = HEADS_UP.has(t.kind) ? 2 : t.kind === "paper" || t.kind === "project" ? 3 : 1;
    let best: string | undefined;
    for (let d = addDays(t.due, -lead - 1); d < t.due; d = addDays(d, 1)) {
      if (d < today) continue;
      if (!best || load(d) < load(best)) best = d;
    }
    if (best) planned.set(best, (planned.get(best) ?? 0) + 1);
    return best;
  };
  const week = tasks
    .filter((t) => isBig(t) && t.due >= today && (t.due <= addDays(today, 7) || (HEADS_UP.has(t.kind) && t.due <= addDays(today, 10))))
    .sort((a, b) => a.due.localeCompare(b.due) || (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99"))
    .map((t) => {
      const inDays = daysBetween(today, t.due);
      return {
        ...toItem(t),
        suggestedDay: suggest(t),
        flag: HEADS_UP.has(t.kind) && inDays <= 5 ? `${t.kind[0].toUpperCase() + t.kind.slice(1)} ${inDays === 0 ? "today" : inDays === 1 ? "tomorrow" : `in ${inDays} days`}` : undefined,
      };
    });

  return { today: todayList, week, syncedAt: school?.syncedAt ?? null, notes };
}

export async function setDone(id: string, value: boolean) {
  const db = redis();
  if (!db) return;
  if (value) await db.hset(DONE_KEY, { [id]: localDate(new Date()) });
  else await db.hdel(DONE_KEY, id);
}
