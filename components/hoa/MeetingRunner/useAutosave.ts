"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Lifecycle of the debounced save, surfaced to the operator in the top bar. */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseAutosaveOptions {
  /** The value to persist. Every change restarts the debounce. */
  value: string;
  /** Persists the value. Rejections surface as `status: "error"`. */
  save: (value: string) => Promise<void>;
  /** When false, nothing is saved and no unload warning is installed. */
  enabled: boolean;
  /** Debounce window in milliseconds. */
  delayMs?: number;
}

export interface UseAutosaveResult {
  status: SaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
  /** Persists immediately, bypassing the debounce. Rejects on failure. */
  saveNow: () => Promise<void>;
  /**
   * Marks a value as already persisted without writing it. Use after loading
   * server state or seeding the scaffold, so restoring the document doesn't
   * immediately save it straight back.
   */
  markClean: (value: string) => void;
}

/**
 * Debounced autosave for the live minutes.
 *
 * Before this existed the minutes were written only when a vote or action item
 * was recorded and at adjournment, so closing the runner discarded everything
 * typed since the last of those. This saves on a timer, reports its state so the
 * operator can see the document is safe, and warns before an unload that would
 * drop unsaved work.
 *
 * @param options - Value, persistence callback, enablement, and debounce window
 */
export function useAutosave({
  value,
  save,
  enabled,
  delayMs = 1500,
}: UseAutosaveOptions): UseAutosaveResult {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** The value most recently confirmed as written, or null if nothing yet. */
  const savedValue = useRef<string | null>(null);
  // Latest-value refs so `saveNow` and the unload handler are not rebuilt on
  // every keystroke. Written after commit rather than during render.
  const valueRef = useRef(value);
  const saveRef = useRef(save);

  useEffect(() => {
    valueRef.current = value;
    saveRef.current = save;
  });

  const flush = useCallback(async (next: string): Promise<void> => {
    if (savedValue.current === next) return;
    setStatus("saving");
    try {
      await saveRef.current(next);
      savedValue.current = next;
      setLastSavedAt(new Date());
      setStatus("saved");
      setError(null);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to save minutes.");
      throw err;
    }
  }, []);

  const markClean = useCallback((next: string): void => {
    savedValue.current = next;
  }, []);

  const saveNow = useCallback((): Promise<void> => flush(valueRef.current), [flush]);

  useEffect(() => {
    if (!enabled || savedValue.current === value) return;
    const id = setTimeout(() => {
      // Failures are reflected in `status`; nothing here should reject unhandled.
      void flush(value).catch(() => {});
    }, delayMs);
    return () => clearTimeout(id);
  }, [value, enabled, delayMs, flush]);

  useEffect(() => {
    if (!enabled) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (savedValue.current !== valueRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [enabled]);

  return { status, lastSavedAt, error, saveNow, markClean };
}
