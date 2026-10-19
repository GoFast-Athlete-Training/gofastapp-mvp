"use client";

import { useCallback, useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import type {
  PlanIngestPreviewResult,
  PlanIngestScope,
} from "@/lib/training/plan-ingest-contract";

type Params = {
  planId: string;
  scope: PlanIngestScope;
  getToken: () => Promise<string | null>;
  dateKey?: string;
  weekNumber?: number;
};

export function usePlanIngestPreviewCommit({
  planId,
  scope,
  getToken,
  dateKey,
  weekNumber,
}: Params) {
  const [preview, setPreview] = useState<PlanIngestPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  const resetPreview = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  const runPreview = useCallback(
    async (sourceText: string) => {
      setError(null);
      setPreview(null);
      const trimmed = sourceText.trim();
      if (!trimmed) {
        setError("Add your plan text or upload a CSV file");
        return;
      }
      const token = await getToken();
      if (!token) {
        setError("Sign in to continue");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/training/plan/ingest/preview", {
          method: "POST",
          headers: {
            ...athleteBearerFetchHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planId,
            scope,
            sourceText: trimmed,
            dateKey,
            weekNumber,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          preview?: PlanIngestPreviewResult;
        };
        if (!res.ok) {
          setError(data.error ?? "Preview failed");
          return;
        }
        if (data.preview) setPreview(data.preview);
      } catch {
        setError("Preview failed");
      } finally {
        setLoading(false);
      }
    },
    [getToken, planId, scope, dateKey, weekNumber]
  );

  const runCommit = useCallback(async (): Promise<boolean> => {
    if (!preview) return false;
    setError(null);
    const token = await getToken();
    if (!token) {
      setError("Sign in to continue");
      return false;
    }
    setCommitting(true);
    try {
      const res = await fetch("/api/training/plan/ingest/commit", {
        method: "POST",
        headers: {
          ...athleteBearerFetchHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId, preview }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return false;
      }
      setPreview(null);
      return true;
    } catch {
      setError("Could not save");
      return false;
    } finally {
      setCommitting(false);
    }
  }, [getToken, planId, preview]);

  return {
    preview,
    error,
    loading,
    committing,
    runPreview,
    runCommit,
    resetPreview,
    setError,
  };
}
