"use client";

import { useLayoutEffect, useRef } from "react";

// Shows text like "$4,210.55" and, when it scrolls into view, counts the
// number up from 0. Writes straight to the DOM so React only renders once.
// Skips the effect when the phone/computer asks for reduced motion.

const NUMBER = /-?\d[\d,]*(\.\d+)?/;
const DURATION_MS = 900;

export default function CountUp({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const match = text.match(NUMBER);
    if (!el || !match || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const target = Number(match[0].replace(/,/g, ""));
    const decimals = match[1] ? match[1].length - 1 : 0;
    const format = (n: number) =>
      text.replace(
        NUMBER,
        n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: match[0].includes(",") }),
      );

    el.textContent = format(0);
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        el.textContent = format(target * (1 - Math.pow(1 - t, 3))); // ease-out
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = text;
    };
  }, [text]);

  return <span ref={ref}>{text}</span>;
}
