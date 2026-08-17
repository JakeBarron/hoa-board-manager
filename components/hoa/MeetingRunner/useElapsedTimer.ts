"use client";

import { useState, useEffect } from "react";

/**
 * Returns a HH:MM:SS elapsed-time string counting up from `startedAt`.
 * Returns "00:00:00" until `startedAt` is set.
 *
 * @param startedAt - ISO timestamp string when counting began, or null
 */
export function useElapsedTimer(startedAt: string | null): string {
  // Holds "now" and lets the elapsed value be derived, so the effect only ever
  // schedules a tick rather than setting state as it runs.
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return "00:00:00";

  const elapsed = Math.max(
    0,
    Math.floor((nowMs - new Date(startedAt).getTime()) / 1000)
  );

  const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
