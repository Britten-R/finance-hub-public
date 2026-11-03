// The dashboard's sections, in scroll order. The home page stacks them all
// (each as <section id={id}>); each also has its own page at `path`.
export const SECTIONS = [
  { id: "today", label: "Today", code: "01", path: "/today" },
  { id: "overview", label: "Overview", code: "02", path: "/" },
  { id: "week", label: "Week", code: "03", path: "/week" },
  { id: "spending", label: "Spending", code: "04", path: "/spending" },
  { id: "budget", label: "Budget", code: "05", path: "/budget" },
  { id: "investments", label: "Investing", code: "06", path: "/investments" },
  { id: "news", label: "News", code: "07", path: "/news" },
  { id: "headlines", label: "Headlines", code: "08", path: "/headlines" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
