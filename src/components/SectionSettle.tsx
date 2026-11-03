"use client";

import { useEffect } from "react";
import { SECTIONS } from "@/lib/sections";

// When scrolling stops with a section's top close to the top of the screen,
// glide the page so that section lines up. Only for a section you scrolled
// *into* from farther away, so small nudges from a section's start are never
// pulled back. Never acts mid-scroll. (CSS scroll-snap fought the scroll
// inside long sections, so this replaces it.)

const NEAR_PX = 140; // how close a section's top must be to count as "near"
const OFFSET_PX = 8; // matches .snap-section's scroll-margin-top
const IDLE_MS = 160; // how long without scrolling counts as "stopped"

export default function SectionSettle() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let restY = window.scrollY; // where the page sat when scrolling last stopped

    const settle = () => {
      const moved = window.scrollY - restY;
      restY = window.scrollY;
      for (const [i, s] of SECTIONS.entries()) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        // The first section lines up with the very top of the page.
        const delta = i === 0 ? -window.scrollY : el.getBoundingClientRect().top - OFFSET_PX;
        const deltaAtStart = delta + moved;
        if (Math.abs(delta) > 3 && Math.abs(delta) < NEAR_PX && Math.abs(deltaAtStart) >= NEAR_PX) {
          const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.scrollBy({ top: delta, behavior: smooth ? "smooth" : "instant" });
          return;
        }
      }
    };

    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, IDLE_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, []);
  return null;
}
