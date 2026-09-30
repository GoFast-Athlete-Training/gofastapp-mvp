"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  ArrowLeft,
  ExternalLink,
  Trash2,
  CheckCircle,
  Eye,
  Pencil,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import runmanageApi from "@/lib/runmanage/api-client";
import RunContentPreviewFrame from "@/components/runmanage/RunContentPreviewFrame";
import RunInstanceRsvpPanel from "@/components/runmanage/RunInstanceRsvpPanel";
import RunInstanceWizard from "@/components/runmanage/runInstanceWizard/RunInstanceWizard";
import type { AutoSaveStatus } from "@/components/runclub/edit/SaveStatusPill";
import type { RunInstanceWizardValues } from "@/components/runmanage/runInstanceWizard/shared";
import { normalizeGroupWorkoutSegment } from "@/lib/group-workout-segment-editor";
import {
  acqRunClubToPublicSources,
  type RunClubPublicSources,
} from "@/components/runmanage/runInstanceWizard/RunClubPublicSourcesCard";
import {
  runInstanceEditPath,
  runInstanceRsvpsPath,
  runInstanceViewPath,
  type RunInstanceManageMode,
} from "@/lib/runmanage/paths";
import { getCompanyAppUrl } from "@/lib/app-urls";
import type { WizardStep } from "@/components/runmanage/runInstanceWizard/shared";
import { formatDayLabel } from "@/lib/runmanage/format-day-label";
import {
  cityRunToWizardValues,
  serializeWizardSnapshot,
  wizardValuesToSavePayload,
} from "@/lib/runInstanceWizardMappers";
import { dateMatchesDayOfWeek } from "@/lib/calendarDay";
import {
  instanceStaffState,
  instanceStaffStateBadgeClasses,
  instanceStaffStateLabel,
} from "@/lib/runmanage/instance-staff-state";
import CityRunPartnerPanel, { partnerFromRun } from "@/components/runmanage/CityRunPartnerPanel";

export interface Athlete {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface RSVP {
  id: string;
  athleteId: string;
  status: string;
  createdAt: string;
  Athlete: Athlete;
}

export interface RunClub {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  stravaUrl?: string | null;
}

export interface CityRunData {
  id: string;
  slug?: string | null;
  title: string;
  citySlug: string;
  meetUpPoint: string;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpZip: string | null;
  meetUpPlaceId?: string | null;
  meetUpLat?: number | null;
  meetUpLng?: number | null;
  date: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
  totalMiles: number | null;
  pace: string | null;
  description: string | null;
  stravaMapUrl: string | null;
  routePhotos?: string[] | null | unknown;
  mapImageUrl?: string | null;
  workflowStatus?: string;
  published?: boolean;
  dayOfWeek: string | null;
  runSeriesId?: string | null;
  runClub: RunClub | null;
  runStore?: {
    id: string;
    name: string;
    websiteUrl?: string | null;
    logoUrl?: string | null;
  } | null;
  runBrand?: {
    id: string;
    name: string;
    websiteUrl?: string | null;
    logoUrl?: string | null;
  } | null;
  rsvps?: RSVP[];
  staffNotes?: string | null;
  postRunActivity?: string | null;
  endPoint?: string | null;
  endStreetAddress?: string | null;
  endCity?: string | null;
  endState?: string | null;
  routeNeighborhood?: string | null;
  routeId?: string | null;
  route?: {
    id: string;
    name?: string | null;
    stravaUrl?: string | null;
    stravaMapUrl?: string | null;
    mapImageUrl?: string | null;
    routePhotos?: unknown;
    routeNeighborhood?: string | null;
    runType?: string | null;
    distanceMiles?: number | null;
    citySlug?: string | null;
  } | null;
  runType?: string | null;
  workoutDescription?: string | null;
  directionsText?: string | null;
  locationId?: string | null;
  location?: { id: string; name: string } | null;
  stravaEventUrl?: string | null;
  stravaText?: string | null;
  webUrl?: string | null;
  webText?: string | null;
  igPostText?: string | null;
  workoutId?: string | null;
  plannedWorkoutId?: string | null;
  workout?: {
    id: string;
    title?: string | null;
    workoutType?: string | null;
    description?: string | null;
  } | null;
  plannedWorkout?: {
    id: string;
    title?: string | null;
    workoutType?: string | null;
    segments?: Array<{
      id: string;
      stepOrder: number;
      title: string;
      durationType: string;
      durationValue: number;
      repeatCount?: number | null;
      notes?: string | null;
      recoveryDurationType?: string | null;
      recoveryDurationValue?: number | null;
    }>;
  } | null;
}

interface CityRunManageStaffProps {
  runId: string;
  onApprove?: () => void;
  showBackButton?: boolean;
  backTo?: string;
  /** Club context from ?clubId= on manage URL. */
  clubId?: string | null;
  /** edit | view | rsvps — from ?mode= query param. */
  initialMode?: RunInstanceManageMode;
  /** Jump to a wizard step in edit mode (e.g. ?step=workout). */
  initialWizardStep?: WizardStep;
}

const generateRunUrl = (runId: string, citySlug: string, slug?: string | null): string => {
  const baseDomain = process.env.NEXT_PUBLIC_CONTENT_PUBLIC_BASE_DOMAIN || "gofastcrushgoals.com";
  const citySubdomain = citySlug === "dc" || citySlug === "arlington" ? "dcruns" : "dcruns";
  const segment = slug && slug.trim() ? slug.trim() : runId;
  return `https://${citySubdomain}.${baseDomain}/runs/${segment}`;
};

const toExternalHref = (raw?: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
};

const compactUrl = (raw?: string | null): string => {
  const href = toExternalHref(raw);
  if (!href) return "";
  return href.replace(/^https?:\/\//, "");
};

function ModeTab({
  active,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  href: string;
  icon: typeof Eye;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-sky-600 text-white"
          : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export default function RunManageStaffEditor({
  runId,
  onApprove,
  showBackButton = true,
  backTo = "/runmanage/runs",
  clubId = null,
  initialMode = "edit",
  initialWizardStep,
}: CityRunManageStaffProps) {
  const router = useRouter();
  const [run, setRun] = useState<CityRunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [approving, setApproving] = useState(false);
  const [staffMode, setStaffMode] = useState<RunInstanceManageMode>(initialMode);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardValues, setWizardValues] = useState<RunInstanceWizardValues | null>(null);
  const [editLinksMode, setEditLinksMode] = useState(false);
  const [linkForm, setLinkForm] = useState({ website: "", instagram: "", strava: "" });
  const [savingLinks, setSavingLinks] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingPublished, setTogglingPublished] = useState(false);
  const [publicSources, setPublicSources] = useState<RunClubPublicSources | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("saved");
  const saveBaselineRef = useRef<string | null>(null);
  const autoSavingRef = useRef(false);
  const [isFounder, setIsFounder] = useState(false);
  const [submittingForReview, setSubmittingForReview] = useState(false);

  const isClubContext = Boolean(clubId?.trim());

  useEffect(() => {
    void runmanageApi.get("/api/runmanage/staff/me").then((res) => {
      if (res.data?.success) {
        const role = String(res.data.cockpitRole ?? "");
        setIsFounder(role === "FOUNDER" || role === "SENIOR_EXEC");
      }
    }).catch(() => setIsFounder(false));
  }, []);

  useEffect(() => {
    setStaffMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setWizardValues(null);
    saveBaselineRef.current = null;
    setAutoSaveStatus("saved");
  }, [runId]);

  useEffect(() => {
    void fetchRun();
  }, [runId]);

  useEffect(() => {
    if (run && staffMode === "edit" && !wizardValues) {
      const initial = cityRunToWizardValues(run);
      setWizardValues(initial);
      saveBaselineRef.current = serializeWizardSnapshot(initial, {
        runClubWebsiteUrl: run.runClub?.websiteUrl ?? undefined,
        runClubInstagramUrl: run.runClub?.instagramUrl ?? undefined,
        runClubStravaUrl: run.runClub?.stravaUrl ?? undefined,
      });
      setAutoSaveStatus("saved");
    }
  }, [run, staffMode, wizardValues]);

  useEffect(() => {
    const acqClubId = clubId?.trim() || run?.runClub?.id;
    if (!acqClubId) {
      setPublicSources(null);
      return;
    }
    void (async () => {
      try {
        const res = await runmanageApi.get(`/api/runmanage/run-clubs/${acqClubId}`);
        if (res.data?.success && res.data.runClub) {
          setPublicSources(acqRunClubToPublicSources(res.data.runClub as Record<string, unknown>));
        }
      } catch {
        setPublicSources(null);
      }
    })();
  }, [clubId, run?.runClub?.id]);

  const fetchRun = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const response = await runmanageApi.get(`/api/runs/manage/${runId}`);
        if (response.data.success) {
          setRun(response.data.run);
          return;
        }
      } catch {
        // fallback
      }
      const response = await runmanageApi.get(`/api/runs/${runId}`);
      if (response.data.success) {
        setRun(response.data.run);
      } else {
        setError("Failed to load run");
      }
    } catch {
      setError("Failed to load run details");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const modePath = (mode: RunInstanceManageMode) => {
    if (mode === "view") return runInstanceViewPath(runId, clubId);
    if (mode === "rsvps") return runInstanceRsvpsPath(runId, clubId);
    return runInstanceEditPath(runId, clubId);
  };

  const handleApprove = async () => {
    if (!run || !confirm("Approve this run? It will be marked approved in the editorial workflow.")) {
      return;
    }
    try {
      setApproving(true);
      const response = await runmanageApi.post(`/api/runs/manage/${run.id}/approve`, {});
      if (response.data.success) {
        await fetchRun();
        onApprove?.();
      }
    } catch {
      alert("Failed to approve run. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  const linkExtras = useMemo(
    () => ({
      runClubWebsiteUrl: linkForm.website.trim() || run?.runClub?.websiteUrl || undefined,
      runClubInstagramUrl: linkForm.instagram.trim() || run?.runClub?.instagramUrl || undefined,
      runClubStravaUrl: linkForm.strava.trim() || run?.runClub?.stravaUrl || undefined,
    }),
    [linkForm, run?.runClub?.websiteUrl, run?.runClub?.instagramUrl, run?.runClub?.stravaUrl]
  );

  const weekdayMismatch =
    wizardValues?.date.trim() &&
    run?.dayOfWeek &&
    Boolean(run.runSeriesId) &&
    !dateMatchesDayOfWeek(wizardValues.date.trim(), run.dayOfWeek);

  const canPersistDraft = Boolean(
    wizardValues?.title.trim() &&
      wizardValues?.date.trim() &&
      wizardValues?.meetUpPoint.trim() &&
      !weekdayMismatch
  );

  const persistRunDraft = useCallback(
    async (opts?: { navigateToView?: boolean }) => {
      if (!run || !wizardValues || !canPersistDraft) return false;
      if (autoSavingRef.current && !opts?.navigateToView) return false;

      const isPreview = Boolean(opts?.navigateToView);
      if (isPreview) setSaving(true);
      else {
        autoSavingRef.current = true;
        setAutoSaveStatus("saving");
      }
      setWizardError(null);

      try {
        const runClubSlug = run.runClub?.slug;
        const hasRunClubLinks =
          linkForm.website.trim() || linkForm.instagram.trim() || linkForm.strava.trim();
        if (hasRunClubLinks && run.runClub?.id) {
          try {
            await runmanageApi.put(`/api/runmanage/run-clubs/${run.runClub.id}`, {
              websiteUrl: linkForm.website.trim() || null,
              instagramUrl: linkForm.instagram.trim() || null,
              stravaUrl: linkForm.strava.trim() || null,
            });
          } catch {
            // continue
          }
        }

        const payload = wizardValuesToSavePayload(wizardValues, linkExtras);
        const response = await runmanageApi.put(`/api/runs/${run.id}`, payload);
        if (!response.data.success) {
          throw new Error(response.data.error || "Failed to update run");
        }
        await fetchRun({ silent: true });
        saveBaselineRef.current = serializeWizardSnapshot(wizardValues, linkExtras);
        setPreviewRefreshKey(Date.now());
        setAutoSaveStatus("saved");
        if (isPreview) {
          router.push(modePath("view"));
        }
        return true;
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { error?: string } }; message?: string };
        const msg = ax.response?.data?.error || ax.message || "Failed to update run.";
        setAutoSaveStatus("error");
        setWizardError(msg);
        return false;
      } finally {
        autoSavingRef.current = false;
        if (isPreview) setSaving(false);
      }
    },
    [run, wizardValues, canPersistDraft, linkForm, linkExtras, router, runId, clubId]
  );

  useEffect(() => {
    if (staffMode !== "edit" || !wizardValues || !run || !canPersistDraft) return;

    const snap = serializeWizardSnapshot(wizardValues, linkExtras);
    if (snap === saveBaselineRef.current) return;

    setAutoSaveStatus("unsaved");
    const timer = window.setTimeout(() => {
      void persistRunDraft();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [wizardValues, linkExtras, staffMode, run, canPersistDraft, persistRunDraft]);

  const handleTogglePublished = async () => {
    if (!run || !isFounder) return;
    const next = !run.published;
    try {
      setTogglingPublished(true);
      const response = await runmanageApi.put(`/api/runs/${run.id}`, { published: next });
      if (!response.data?.success) throw new Error(response.data?.error || "Failed");
      await fetchRun();
      setPreviewRefreshKey(Date.now());
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      alert(ax.response?.data?.error || ax.message || "Failed to update publish status.");
    } finally {
      setTogglingPublished(false);
    }
  };

  const handleDelete = async () => {
    if (!run || !confirm(`Delete run "${run.title}"? This cannot be undone. RSVPs will be removed.`)) {
      return;
    }
    try {
      setDeleting(true);
      await runmanageApi.delete(`/api/runs/${run.id}`);
      router.push(backTo ?? "/runmanage/runs");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      alert(ax.response?.data?.error || "Failed to delete run.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!run) return;
    setSubmittingForReview(true);
    try {
      const res = await runmanageApi.patch(`/api/runs/${run.id}/workflow-status`, {
        workflowStatus: "SUBMITTED",
      });
      if (!res.data?.success) {
        throw new Error(res.data?.error || "Submit failed");
      }
      await fetchRun({ silent: true });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      alert(ax.response?.data?.error || ax.message || "Submit failed");
    } finally {
      setSubmittingForReview(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!run) return;
    const url = generateRunUrl(run.id, run.citySlug, run.slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveAndPreview = async () => {
    if (!canPersistDraft) {
      setWizardError("Title, date, and meet-up are required before preview.");
      return;
    }
    await persistRunDraft({ navigateToView: true });
  };

  const handleSaveLinks = async () => {
    if (!run?.runClub?.slug) return;
    try {
      setSavingLinks(true);
      const website = linkForm.website.trim() || null;
      const instagram = linkForm.instagram.trim() || null;
      const strava = linkForm.strava.trim() || null;
      if (run.runClub?.id) {
        try {
          await runmanageApi.put(`/api/runmanage/run-clubs/${run.runClub.id}`, {
            websiteUrl: website,
            instagramUrl: instagram,
            stravaUrl: strava,
          });
        } catch {
          // continue
        }
      }
      await runmanageApi.put(`/api/runs/${run.id}`, {
        runClubWebsiteUrl: website,
        runClubInstagramUrl: instagram,
        runClubStravaUrl: strava,
      });
      await fetchRun();
      setEditLinksMode(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save links.");
    } finally {
      setSavingLinks(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="py-12 text-center text-gray-500">Loading run details…</div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-8">
        <div className="py-12 text-center">
          <p className="mb-4 text-gray-600">{error || "Run not found"}</p>
          {showBackButton && (
            <button
              type="button"
              onClick={() => router.push(backTo)}
              className="rounded-lg bg-sky-500 px-4 py-2 text-white hover:bg-sky-600"
            >
              Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const runUrl = generateRunUrl(run.id, run.citySlug, run.slug);
  const isSeriesInstance = Boolean(run.runSeriesId);
  const rsvpCount = run.rsvps?.length ?? 0;

  return (
    <div className="p-8">
      {showBackButton && (
        <button
          type="button"
          onClick={() => router.push(backTo ?? "/dashboard/runs/list")}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {isClubContext ? "Back to club runs" : "Back to runs"}
        </button>
      )}

      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                {isClubContext ? "Run club runs" : "Run instance"}
              </p>
              <h1 className="text-2xl font-bold text-gray-900">{run.title}</h1>
              {run.runClub && (
                <p className="mt-1 text-sm text-gray-600">{run.runClub.name}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {(() => {
                  const state = instanceStaffState({
                    id: run.id,
                    title: run.title,
                    date: run.date,
                    published: Boolean(run.published),
                    workflowStatus: run.workflowStatus ?? "DEVELOP",
                    runSeriesId: run.runSeriesId ?? null,
                  });
                  return (
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${instanceStaffStateBadgeClasses(state)}`}
                    >
                      {instanceStaffStateLabel(state)}
                    </span>
                  );
                })()}
                {isSeriesInstance && (
                  <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-600/20">
                    From series
                  </span>
                )}
                {run.plannedWorkout?.title || run.plannedWorkoutId ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900 ring-1 ring-inset ring-emerald-600/20">
                    Workout attached
                    {run.plannedWorkout?.title ? `: ${run.plannedWorkout.title}` : ""}
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300">
                    No workout attached
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!run.published && isFounder && (
                <button
                  type="button"
                  onClick={() => void handleTogglePublished()}
                  disabled={togglingPublished}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {togglingPublished ? "Publishing…" : "Publish live"}
                </button>
              )}
              {run.workflowStatus === "SUBMITTED" && isFounder && (
                <button
                  type="button"
                  onClick={() => void handleApprove()}
                  disabled={approving}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  {approving ? "Approving…" : "Approve"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <ModeTab active={staffMode === "view"} href={modePath("view")} icon={Eye} label="View" />
            <ModeTab
              active={staffMode === "edit"}
              href={modePath("edit")}
              icon={Pencil}
              label="Edit"
            />
            <ModeTab
              active={staffMode === "rsvps"}
              href={modePath("rsvps")}
              icon={Users}
              label={`Manage RSVPs (${rsvpCount})`}
            />
          </div>

          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-sky-900">Public run URL</p>
                <a
                  href={runUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-sky-600 underline hover:text-sky-800"
                >
                  {runUrl}
                </a>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={runUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-white"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => void handleCopyUrl()}
                  className="flex items-center gap-1 rounded border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-white"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          {run.runClub && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Club links (verification)
                </p>
                {!editLinksMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setLinkForm({
                        website: run.runClub?.websiteUrl ?? "",
                        instagram: run.runClub?.instagramUrl ?? "",
                        strava: run.runClub?.stravaUrl ?? "",
                      });
                      setEditLinksMode(true);
                    }}
                    className="text-xs font-medium text-sky-600 hover:text-sky-800"
                  >
                    Edit links
                  </button>
                )}
              </div>
              {editLinksMode ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  {(["website", "instagram", "strava"] as const).map((key) => (
                    <input
                      key={key}
                      type="url"
                      value={linkForm[key]}
                      onChange={(e) => setLinkForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={key}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                    />
                  ))}
                  <div className="flex gap-2 md:col-span-3">
                    <button
                      type="button"
                      onClick={() => void handleSaveLinks()}
                      disabled={savingLinks}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      {savingLinks ? "Saving…" : "Save links"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditLinksMode(false)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3 text-xs">
                  {toExternalHref(run.runClub.websiteUrl) ? (
                    <a href={toExternalHref(run.runClub.websiteUrl)!} target="_blank" rel="noopener noreferrer" className="text-sky-700">
                      Website: {compactUrl(run.runClub.websiteUrl)}
                    </a>
                  ) : (
                    <span className="text-gray-400">Website missing</span>
                  )}
                  {toExternalHref(run.runClub.instagramUrl) ? (
                    <a href={toExternalHref(run.runClub.instagramUrl)!} target="_blank" rel="noopener noreferrer" className="text-sky-700">
                      Instagram: {compactUrl(run.runClub.instagramUrl)}
                    </a>
                  ) : (
                    <span className="text-gray-400">Instagram missing</span>
                  )}
                  {toExternalHref(run.runClub.stravaUrl) ? (
                    <a href={toExternalHref(run.runClub.stravaUrl)!} target="_blank" rel="noopener noreferrer" className="text-sky-700">
                      Strava: {compactUrl(run.runClub.stravaUrl)}
                    </a>
                  ) : (
                    <span className="text-gray-400">Strava missing</span>
                  )}
                </div>
              )}
            </div>
          )}

          {run ? (
            <CityRunPartnerPanel
              runId={run.id}
              partner={partnerFromRun(run)}
              onUpdated={() => fetchRun({ silent: true })}
            />
          ) : null}
        </div>

        {isSeriesInstance && run.runSeriesId && run.runClub?.id && staffMode === "edit" && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <p className="font-medium text-gray-900">Weekly series</p>
            <p className="mt-1 text-gray-700">
              {run.dayOfWeek ? `${formatDayLabel(run.dayOfWeek)} · ` : ""}
              {run.meetUpPoint}
            </p>
            <div className="mt-2">
              <Link
                href={`${getCompanyAppUrl()}/dashboard/entities/manage/runclubs/${run.runClub.id}/series/${run.runSeriesId}`}
                className="text-xs font-medium text-violet-700 hover:text-violet-900"
              >
                Manage series
              </Link>
            </div>
          </div>
        )}

        {staffMode === "edit" && wizardValues && (
          <RunInstanceWizard
            values={wizardValues}
            onChange={setWizardValues}
            context={{
              variant: "edit",
              isSeriesInstance,
              cityRunId: run.id,
              dayOfWeek: run.dayOfWeek,
              clubName: run.runClub?.name,
              clubId: clubId ?? run.runClub?.id,
              plannedWorkoutSegments:
                run.plannedWorkout?.segments?.map(normalizeGroupWorkoutSegment) ?? null,
              plannedWorkoutTitle: run.plannedWorkout?.title ?? null,
              plannedWorkoutType: run.plannedWorkout?.workoutType ?? null,
            }}
            onSave={() => void handleSaveAndPreview()}
            saving={saving}
            error={wizardError}
            onErrorChange={setWizardError}
            saveLabel="Save & Preview"
            initialWizardStep={initialWizardStep}
            publicSources={publicSources}
            instanceToolbar={{
              autoSaveStatus,
              published: Boolean(run.published),
              workflowStatus: run.workflowStatus ?? "DEVELOP",
              isFounder,
              onSubmitForReview: () => void handleSubmitForReview(),
              submitting: submittingForReview,
              onTogglePublished: isFounder ? () => void handleTogglePublished() : undefined,
              togglingPublished,
              onSaveAndPreview: () => void handleSaveAndPreview(),
              savingPreview: saving,
              saveLabel: "Save & Preview",
              previewPublicUrl: runUrl,
            }}
          />
        )}

        {staffMode === "view" && (
          <div ref={previewRef} className="space-y-3">
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                run.published
                  ? "border-sky-200 bg-sky-50 text-sky-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              {run.published
                ? "Live on the content site — this is what runners see."
                : "Draft — preview below, then Publish when ready."}
            </div>
            <RunContentPreviewFrame
              runId={run.id}
              slug={run.slug}
              citySlug={run.citySlug}
              refreshKey={previewRefreshKey}
            />
          </div>
        )}

        {staffMode === "rsvps" && (
          <RunInstanceRsvpPanel rsvps={run.rsvps} runTitle={run.title} />
        )}
      </div>
    </div>
  );
}
