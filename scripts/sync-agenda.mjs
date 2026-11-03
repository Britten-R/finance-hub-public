// Reads this term's syllabi/reading schedules and the recruiting notes on this
// laptop, has Claude turn them into dated tasks and contact cards, and saves
// them to Redis for the Today / This Week panels. Re-run when a syllabus or the
// recruiting notes change:
//   node --env-file=.env.local scripts/sync-agenda.mjs
// Needs pdftotext (comes with Git for Windows' ucrt64 tools).
import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";

// Set these in .env.local. COURSES_DIR holds one folder per course named like "ECON_1010";
// NOTEBOOK_DIR holds "Recruiting Status.md" / "Applications Status.md" (optional).
const COURSES = process.env.COURSES_DIR;
const NOTEBOOK = process.env.NOTEBOOK_DIR ?? "";
if (!COURSES) throw new Error("Set COURSES_DIR in .env.local");
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const client = new Anthropic();

async function ask(system, content, schema) {
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content }],
  });
  const text = response.content.find((b) => b.type === "text");
  if (response.stop_reason === "refusal" || !text) throw new Error("Claude returned no answer");
  return JSON.parse(text.text);
}

const pdfText = (file) => execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
const id = (...parts) => createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 12);

// ---- School ----

const taskSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "kind", "due", "dueTime", "estimateMin"],
        properties: {
          title: { type: "string" },
          kind: { type: "string", enum: ["reading", "assignment", "paper", "problem-set", "quiz", "exam", "debate", "presentation", "project", "other"] },
          due: { type: "string", description: "YYYY-MM-DD" },
          dueTime: { type: ["string", "null"], description: "HH:MM 24h, or null" },
          estimateMin: { type: "integer" },
        },
      },
    },
  },
};

const SCHOOL_SYSTEM = `You turn a college course's syllabus and reading schedule into a task list.
List every reading, assignment and assessment due on or after TODAY through the end of the semester. Skip anything before TODAY.
- Readings: "due" is the date of the class session the reading is assigned for; title names the reading(s) briefly, e.g. "Read Dahl ch. 2 and 6".
- Assignments, papers, problem sets, quizzes, exams, debates, presentations, project milestones: "due" is the due/exam date; "dueTime" if stated.
- estimateMin: realistic minutes to finish (academic reading about 3 minutes per page; a short response ~60; a paper ~600 spread over days; exam prep ~240).
Use the exact year from the syllabus. If a date is only "TBD", skip it.`;

async function syncCourse(dir) {
  const course = dir.replace("_", " ");
  const folder = path.join(COURSES, dir);
  const files = readdirSync(folder).filter((f) => /syllab|schedule/i.test(f) && f.endsWith(".pdf"));
  if (!files.length) return [];
  let text = files.map((f) => `=== ${f} ===\n${pdfText(path.join(folder, f))}`).join("\n\n");
  const context = path.join(folder, "COURSE CONTEXT.md");
  if (existsSync(context)) text += `\n\n=== COURSE CONTEXT.md (my notes; newer than the syllabus) ===\n${readFileSync(context, "utf8").slice(0, 8000)}`;
  const { items } = await ask(SCHOOL_SYSTEM, `TODAY: ${today}\nCOURSE: ${course}\n\n${text}`, taskSchema);
  return items.filter((t) => t.due >= today).map((t) => ({ id: id(course, t.title, t.due), course, source: "syllabus", ...t }));
}

// ---- Recruiting ----

const recruitingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["firms", "people"],
  properties: {
    firms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "aliases", "stage", "nextStep", "brief"],
        properties: {
          name: { type: "string" },
          aliases: { type: "array", items: { type: "string" }, description: "short names used on calendars, e.g. DB, Deutsche, JPM" },
          stage: { type: "string" },
          nextStep: { type: "string" },
          brief: { type: "string", description: "1-2 sentences on what this firm/division does and anything to know going in" },
        },
      },
    },
    people: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "firm", "role", "lastContact", "notes"],
        properties: {
          name: { type: "string" },
          firm: { type: "string" },
          role: { type: "string" },
          lastContact: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
          notes: { type: "string", description: "the last notes: where it stands and next follow-up" },
        },
      },
    },
  },
};

async function syncRecruiting() {
  const files = ["Recruiting Status.md", "Applications Status.md"].map((f) => path.join(NOTEBOOK, f)).filter(existsSync);
  const text = files.map((f) => `=== ${path.basename(f)} ===\n${readFileSync(f, "utf8")}`).join("\n\n");
  return ask(
    "Turn these recruiting notes into firm cards and person cards. One person card per named person (split rows listing several names). Keep notes short and factual. The brief may use general knowledge about the firm.",
    text,
    recruitingSchema,
  );
}

// ---- Run ----

const dirs = readdirSync(COURSES, { withFileTypes: true }).filter((d) => d.isDirectory() && /^[A-Z]+_\d{4}$/.test(d.name)).map((d) => d.name);
const [recruiting, ...courses] = await Promise.all([syncRecruiting(), ...dirs.map(syncCourse)]);
const items = courses.flat().sort((a, b) => a.due.localeCompare(b.due));

const redis = Redis.fromEnv();
await redis.set("agenda:school", { syncedAt: new Date().toISOString(), items });
await redis.set("agenda:recruiting", { syncedAt: new Date().toISOString(), ...recruiting });

dirs.forEach((d, i) => console.log(`${d.replace("_", " ")}: ${courses[i].length} items`));
console.log(`Recruiting: ${recruiting.firms.length} firms, ${recruiting.people.length} people`);
