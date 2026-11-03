"use client";

import { useEffect, useRef } from "react";

// Ticking UTC clock, "2026-10-29 14:02:07Z" (time only on phones). Runs in the browser (pages are
// pre-built, so the server can't stamp the time) and writes straight to the DOM.
export default function LiveClock() {
  const date = useRef<HTMLSpanElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tick = () => {
      const iso = new Date().toISOString();
      if (date.current) date.current.textContent = `${iso.slice(0, 10)} `;
      if (time.current) time.current.textContent = `${iso.slice(11, 19)}Z`;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="tabular">
      <span ref={date} className="hidden sm:inline" />
      <span ref={time}>--:--:--Z</span>
    </span>
  );
}
