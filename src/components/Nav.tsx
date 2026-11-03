"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout, logoutEverywhere } from "@/app/login/actions";
import { SECTIONS, type SectionId } from "@/lib/sections";

// On the home page, the section crossing the middle of the screen is "active".
function useActiveSection(enabled: boolean): SectionId {
  const [active, setActive] = useState<SectionId>("overview");
  useEffect(() => {
    if (!enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.id as SectionId);
      },
      { rootMargin: "-45% 0px -50% 0px" }, // a thin band across the middle of the screen
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [enabled]);
  return active;
}

// Sidebar on laptops, bottom tab bar on phones.
export default function Nav() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const scrolled = useActiveSection(onHome);
  if (pathname === "/login") return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/85 backdrop-blur-md md:inset-y-0 md:left-0 md:right-auto md:w-56 md:border-t-0 md:border-r">
      <div className="hidden px-5 pt-6 pb-5 md:block">
        <div className="font-mono text-base font-semibold tracking-[0.2em] text-accent">FINANCE HUB</div>
        <div className="label mt-1 flex items-center gap-2">
          <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          System online
        </div>
      </div>
      <ul className="flex justify-between gap-1 overflow-x-auto px-1 md:flex-col md:overflow-visible md:gap-0.5 md:px-3">
        {SECTIONS.map((s) => {
          const active = onHome ? scrolled === s.id : pathname === s.path;
          return (
            <li key={s.id}>
              <Link
                href={`/#${s.id}`}
                aria-current={active ? "location" : undefined}
                className={`relative block px-1 py-3 font-mono text-[10px] uppercase transition-colors duration-300 md:rounded md:px-3 md:py-2 md:text-xs md:tracking-wider ${
                  active ? "text-accent md:bg-accent-soft" : "text-ink-2 hover:text-ink"
                }`}
              >
                {/* Glowing marker: top edge on phones, left edge on laptops. */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 top-0 h-0.5 bg-accent md:inset-x-auto md:inset-y-1.5 md:left-0 md:h-auto md:w-0.5"
                    style={{ boxShadow: "0 0 8px var(--accent)" }}
                  />
                )}
                <span className="mr-2 hidden text-muted md:inline">{s.code}</span>
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <form action={logout} className="hidden px-3 pt-6 md:block">
        <button type="submit" className="label px-3 py-2 hover:text-ink">
          Sign out
        </button>
      </form>
      <form action={logoutEverywhere} className="hidden px-3 md:block">
        <button type="submit" className="label px-3 py-1 text-left hover:text-critical">
          Sign out all devices
        </button>
      </form>
    </nav>
  );
}
