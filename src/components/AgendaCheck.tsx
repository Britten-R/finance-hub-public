"use client";

import { useOptimistic, useTransition } from "react";
import { toggleItem } from "@/app/today/actions";

// Checkbox that flips instantly, then saves to the database.
export default function AgendaCheck({ id, done, label }: { id: string; done: boolean; label: string }) {
  const [checked, setChecked] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => {
        const next = e.target.checked;
        start(async () => {
          setChecked(next);
          await toggleItem(id, next);
        });
      }}
      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
    />
  );
}
