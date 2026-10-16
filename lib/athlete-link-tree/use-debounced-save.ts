"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;

/** Debounced async save with global status for link-tree editor. */
export function useDebouncedSave(saveFn: () => Promise<void>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setStatus("saving");
    try {
      await saveFnRef.current();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  const schedule = useCallback(() => {
    setStatus((s) => (s === "error" ? "error" : "pending"));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, DEBOUNCE_MS);
  }, [flush]);

  const saveOnBlur = useCallback(() => {
    if (timerRef.current) {
      void flush();
    }
  }, [flush]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { status, schedule, saveOnBlur, retry: flush };
}
