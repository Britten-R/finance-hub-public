import TodaySection from "@/sections/Today";

// Single-section page; the home page stacks every section.
export default function TodayPage({ searchParams }: PageProps<"/today">) {
  const asOf = searchParams.then((p) => (typeof p.asOf === "string" ? p.asOf : undefined));
  return <TodaySection asOf={asOf} />;
}
