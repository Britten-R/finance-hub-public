import type { ReactNode } from "react";
import SectionSettle from "@/components/SectionSettle";
import { SECTIONS, type SectionId } from "@/lib/sections";
import BudgetSection from "@/sections/Budget";
import HeadlinesSection from "@/sections/Headlines";
import InvestmentsSection from "@/sections/Investments";
import NewsSection from "@/sections/News";
import OverviewSection from "@/sections/Overview";
import SpendingSection from "@/sections/Spending";
import TodaySection from "@/sections/Today";
import WeekSection from "@/sections/Week";

// Only Overview shows where the data comes from; the rest would repeat it.
const CONTENT: Record<SectionId, ReactNode> = {
  today: <TodaySection />,
  overview: <OverviewSection />,
  week: <WeekSection />,
  spending: <SpendingSection notice={false} />,
  budget: <BudgetSection notice={false} />,
  investments: <InvestmentsSection notice={false} />,
  news: <NewsSection />,
  headlines: <HeadlinesSection />,
};

// One long page. The menu follows along as you scroll (see Nav), and the page
// settles onto a section when you stop near its top (SectionSettle).
export default function Home() {
  return (
    <div>
      <SectionSettle />
      {SECTIONS.map((s, i) => (
        <section key={s.id} id={s.id} aria-label={s.label} className="snap-section">
          {i > 0 && (
            <div aria-hidden className="label mb-6 flex items-center gap-3 pt-10 text-muted">
              <span>{s.code}</span>
              <span className="h-px flex-1 bg-line" />
              <span>{s.label}</span>
            </div>
          )}
          {CONTENT[s.id]}
        </section>
      ))}
    </div>
  );
}
