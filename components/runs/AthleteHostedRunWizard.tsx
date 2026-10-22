"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import RunInstanceWizard from "@/components/runmanage/runInstanceWizard/RunInstanceWizard";
import {
  emptyWizardValues,
  type RunInstanceWizardValues,
} from "@/components/runmanage/runInstanceWizard/shared";
import SaveStatusPill, {
  type AutoSaveStatus,
} from "@/components/runclub/edit/SaveStatusPill";
import api from "@/lib/api";
import { ensureAthleteIdInStorage } from "@/lib/ensure-athlete-session";
import {
  buildFromWorkoutCreateBody,
  buildHostedInvitePatchBody,
  parseWizardStartTime,
  wizardValuesFromHostedInvite,
  wizardValuesFromMeetupTemplate,
  type AthleteHostedInviteDetail,
  type MeetupTemplateSeed,
} from "@/lib/city-run/athlete-hosted-wizard-map";
import type { CreateCityRunFormWorkout } from "@/components/cityruns/CreateCityRunForm";
import HostRunCopyFromPrior from "@/components/runs/HostRunCopyFromPrior";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function serializeAthleteDraftSnapshot(values: RunInstanceWizardValues): string {
  return JSON.stringify(values);
}

function coreDraftReady(values: RunInstanceWizardValues): boolean {
  return Boolean(
    values.title.trim() &&
      values.date.trim() &&
      values.meetUpPoint.trim() &&
      values.meetUpCity.trim() &&
      values.meetUpPlaceId.trim() &&
      parseWizardStartTime(values),
  );
}

type Props = {
  mode: "create" | "edit";
  cityRunId?: string;
  initialRouteId?: string | null;
  templateSeed?: MeetupTemplateSeed | null;
  showCopyFromPrior?: boolean;
  trainingWorkout?: CreateCityRunFormWorkout | null;
  pageTitle: string;
  backHref?: string;
  backLabel?: string;
};

export default function AthleteHostedRunWizard({
  mode,
  cityRunId,
  initialRouteId,
  templateSeed,
  showCopyFromPrior = false,
  trainingWorkout,
  pageTitle,
  backHref = "/gorun",
  backLabel = "Back to Run",
}: Props) {
  const [values, setValues] = useState<RunInstanceWizardValues>(() =>
    emptyWizardValues(trainingWorkout?.date ?? todayYmd()),
  );
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("saved");
  const [resolvedRunId, setResolvedRunId] = useState(cityRunId ?? "");
  const [lastAttachedRouteId, setLastAttachedRouteId] = useState("");
  const saveBaselineRef = useRef("");
  const autoSavingRef = useRef(false);

  const plannedWorkoutId = trainingWorkout?.id ?? null;
  const workoutSeedTitle = trainingWorkout?.title?.trim() || null;

  const effectiveRunId = cityRunId?.trim() || resolvedRunId.trim();
  const isDraftCreated = Boolean(effectiveRunId);

  useEffect(() => {
    void ensureAthleteIdInStorage();
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !cityRunId?.trim()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data } = await api.get<{ success: boolean; invite: AthleteHostedInviteDetail }>(
          `/me/hosted-run-invites/${encodeURIComponent(cityRunId)}`,
        );
        const inv = data?.invite;
        if (!inv || cancelled) {
          if (!cancelled) setLoadError("Could not load this run.");
          return;
        }
        const next = wizardValuesFromHostedInvite(inv, emptyWizardValues(todayYmd()));
        setValues(next);
        saveBaselineRef.current = serializeAthleteDraftSnapshot(next);
        setLastAttachedRouteId(inv.routeId?.trim() || inv.route?.id?.trim() || "");
        setResolvedRunId(inv.id);
        setAutoSaveStatus("saved");
      } catch {
        if (!cancelled) setLoadError("Could not load this run.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, cityRunId]);

  useEffect(() => {
    if (mode !== "create") return;
    const base = emptyWizardValues(trainingWorkout?.date ?? todayYmd());
    let next = base;
    if (templateSeed) {
      next = wizardValuesFromMeetupTemplate(templateSeed, next);
    }
    if (trainingWorkout) {
      next = {
        ...next,
        title: next.title.trim() || trainingWorkout.title?.trim() || "Hosted group run",
        description: next.description.trim() || trainingWorkout.description?.trim() || "",
        totalMiles:
          next.totalMiles.trim() ||
          (trainingWorkout.estimatedDistanceInMeters
            ? String(Math.round((trainingWorkout.estimatedDistanceInMeters / 1609.34) * 10) / 10)
            : ""),
        plannedWorkoutId: plannedWorkoutId ?? "",
        attachedWorkoutTitle: workoutSeedTitle ?? "",
      };
    }
    if (initialRouteId?.trim()) {
      next = { ...next, routeId: initialRouteId.trim() };
    }
    setValues(next);
    saveBaselineRef.current = serializeAthleteDraftSnapshot(next);
  }, [mode, templateSeed, trainingWorkout, initialRouteId, plannedWorkoutId, workoutSeedTitle]);

  const wizardContext = useMemo(
    () => ({
      variant: "athlete-hosted" as const,
      cityRunType: "INDIVIDUAL",
      cityRunId: effectiveRunId || null,
      plannedWorkoutTitle: workoutSeedTitle,
    }),
    [effectiveRunId, workoutSeedTitle],
  );

  const attachRouteIfNeeded = useCallback(async (runId: string, routeId: string) => {
    const rid = routeId.trim();
    if (!rid || rid === lastAttachedRouteId) return;
    await api.post(`/cityrun/${encodeURIComponent(runId)}/attach-route`, {
      routeId: rid,
      neighborhoodAuthority: "route",
    });
    setLastAttachedRouteId(rid);
  }, [lastAttachedRouteId]);

  const persistDraft = useCallback(async (): Promise<boolean> => {
    if (!coreDraftReady(values)) return false;
    if (autoSavingRef.current) return false;

    const athleteId = await ensureAthleteIdInStorage();
    if (!athleteId) {
      setError("Sign in to save this run.");
      setAutoSaveStatus("error");
      return false;
    }

    autoSavingRef.current = true;
    setAutoSaveStatus("saving");
    setError(null);

    try {
      let runId = effectiveRunId;

      if (!runId) {
        const body = buildFromWorkoutCreateBody(values, {
          plannedWorkoutId,
          routeId: initialRouteId ?? values.routeId,
        });
        if ("error" in body) {
          setError(String(body.error));
          setAutoSaveStatus("error");
          return false;
        }
        const { data } = await api.post<{ cityRunId?: string }>("/cityrun/from-workout", body);
        runId = data?.cityRunId?.trim() || "";
        if (!runId) {
          setError("Unexpected response from server.");
          setAutoSaveStatus("error");
          return false;
        }
        setResolvedRunId(runId);
      } else {
        const patchBody = buildHostedInvitePatchBody(values);
        if ("error" in patchBody) {
          setError(String(patchBody.error));
          setAutoSaveStatus("error");
          return false;
        }
        await api.patch(`/me/hosted-run-invites/${encodeURIComponent(runId)}`, patchBody);
      }

      if (values.routeId.trim()) {
        await attachRouteIfNeeded(runId, values.routeId);
      }

      saveBaselineRef.current = serializeAthleteDraftSnapshot(values);
      setAutoSaveStatus("saved");
      return true;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || "Could not save.");
      setAutoSaveStatus("error");
      return false;
    } finally {
      autoSavingRef.current = false;
    }
  }, [values, effectiveRunId, plannedWorkoutId, initialRouteId, attachRouteIfNeeded]);

  useEffect(() => {
    if (loading || loadError) return;
    const snap = serializeAthleteDraftSnapshot(values);
    if (snap === saveBaselineRef.current) return;
    if (!coreDraftReady(values)) {
      setAutoSaveStatus("unsaved");
      return;
    }

    setAutoSaveStatus("unsaved");
    const timer = window.setTimeout(() => {
      void persistDraft();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [values, loading, loadError, persistDraft]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await persistDraft();
    } finally {
      setSaving(false);
    }
  }, [persistDraft]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        <p>{loadError}</p>
        <Link href={backHref} className="mt-3 inline-block text-sm font-semibold underline">
          {backLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Core meetup details, optional description, route, and workout — same flow as club runs.
            Changes save automatically; you stay here until you open the run from Run home.
          </p>
        </div>
        <SaveStatusPill status={autoSaveStatus} />
      </div>

      {mode === "create" && showCopyFromPrior && !templateSeed ? <HostRunCopyFromPrior /> : null}

      {isDraftCreated ? (
        <p className="text-xs text-gray-500">
          Draft saved — keep editing steps or use Copy invite on Run home when you are ready to share.
        </p>
      ) : null}

      <RunInstanceWizard
        values={values}
        onChange={setValues}
        context={wizardContext}
        onSave={handleSave}
        saving={saving}
        error={error}
        onErrorChange={setError}
        saveLabel={mode === "create" && !isDraftCreated ? "Create run" : "Save"}
      />

      {saving ? (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving…
        </p>
      ) : null}
    </div>
  );
}
