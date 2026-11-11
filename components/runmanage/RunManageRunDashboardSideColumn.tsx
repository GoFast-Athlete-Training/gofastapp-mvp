"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, ImageIcon, Loader2, Sparkles, X } from "lucide-react";
import RunManageRouteAttachPanel from "@/components/runmanage/runInstanceWizard/RunManageRouteAttachPanel";
import TrackWorkoutBuilder from "@/components/runmanage/runInstanceWizard/TrackWorkoutBuilder";
import { generateCitySlugFromParts } from "@/lib/utils/parseAddress";
import { isTrackRun } from "@/lib/runTypes";
import {
  MAX_ROUTE_PHOTOS,
  pickRoutePhotoFiles,
  uploadImageFiles,
} from "@/lib/client/uploadImages";
import runmanageApi from "@/lib/runmanage/api-client";
import { contentStudioRunBuildUrl } from "@/lib/runmanage/content-studio-run-build";
import { formatInstanceDateLabel } from "@/components/runmanage/runInstanceWizard/shared";
import type { RunInstanceWizardContext, RunInstanceWizardValues } from "@/components/runmanage/runInstanceWizard/shared";
import WizardInstanceToolbar from "@/components/runmanage/runInstanceWizard/WizardInstanceToolbar";
import type { RunDashboardInstanceToolbar } from "@/components/runmanage/run-dashboard-instance-toolbar";

function SideCard({
  title,
  summary,
  actions,
  expanded,
}: {
  title: string;
  summary: ReactNode;
  actions?: ReactNode;
  expanded?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <div className="mt-1 text-xs text-gray-600">{summary}</div>
          </div>
          {actions ? <div className="flex flex-wrap gap-1.5">{actions}</div> : null}
        </div>
        {expanded ? <div className="mt-3 border-t border-gray-100 pt-3 text-sm">{expanded}</div> : null}
      </div>
    </div>
  );
}

type Props = {
  values: RunInstanceWizardValues;
  patch: (partial: Partial<RunInstanceWizardValues>) => void;
  context: RunInstanceWizardContext;
  onErrorChange?: (msg: string | null) => void;
  onRunRefreshed?: () => void;
  instanceToolbar?: RunDashboardInstanceToolbar;
};

export default function RunManageRunDashboardSideColumn({
  values,
  patch,
  context,
  onErrorChange,
  instanceToolbar,
}: Props) {
  const [routeEditOpen, setRouteEditOpen] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showWorkout, setShowWorkout] = useState(false);
  const [uploadingMapImage, setUploadingMapImage] = useState(false);
  const [uploadingRoutePhoto, setUploadingRoutePhoto] = useState(false);
  const [contentHasDraft, setContentHasDraft] = useState<boolean | null>(null);

  const isTrack = isTrackRun(values.runType);
  const linkedSavedRoute = Boolean(values.routeId?.trim());
  const cityRunId = context.cityRunId?.trim() ?? "";
  const buildUrl = cityRunId ? contentStudioRunBuildUrl(cityRunId) : null;

  useEffect(() => {
    if (!cityRunId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await runmanageApi.get(`/api/runmanage/runs/${encodeURIComponent(cityRunId)}/content-draft`);
        if (cancelled) return;
        const data = res.data as { hasDraft?: boolean };
        setContentHasDraft(Boolean(data?.hasDraft));
      } catch {
        if (!cancelled) setContentHasDraft(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cityRunId]);

  const routeSummary = useMemo(() => {
    if (values.stravaMapUrl.trim()) {
      return (
        <a
          href={values.stravaMapUrl.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-medium text-sky-700 underline"
        >
          {values.linkedRouteName.trim() || "Strava route"}
        </a>
      );
    }
    if (values.routeId?.trim()) {
      return <span>{values.linkedRouteName.trim() || "Catalog route attached"}</span>;
    }
    return <span className="text-gray-500">No route link</span>;
  }, [values]);

  const miniSummary = useMemo(() => {
    const when =
      values.date.trim() && values.startTimeHour
        ? `${formatInstanceDateLabel(values.date.trim())} · ${values.startTimeHour}:${values.startTimeMinute.padStart(2, "0")} ${values.startTimePeriod}`.trim()
        : values.date.trim()
          ? formatInstanceDateLabel(values.date.trim())
          : "—";
    return {
      title: values.title.trim() || "(no title)",
      when,
      where: values.meetUpPoint.trim() || "(no meet-up)",
      route: values.stravaMapUrl.trim() || values.routeId?.trim() ? "Set" : "None",
      workout:
        values.plannedWorkoutId?.trim() || values.attachedWorkoutTitle?.trim()
          ? values.attachedWorkoutTitle.trim() || "Attached"
          : "None",
    };
  }, [values]);

  const routeExpanded =
    routeEditOpen || showAttach ? (
      <div className="space-y-3">
        {!linkedSavedRoute ? (
          <>
            <label className="block text-xs font-medium text-gray-800">
              Strava route link
              <input
                type="url"
                value={values.stravaMapUrl}
                onChange={(e) => patch({ stravaMapUrl: e.target.value })}
                placeholder="https://www.strava.com/routes/…"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-gray-800">
              Route notes
              <textarea
                value={values.routeNotes}
                onChange={(e) => patch({ routeNotes: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-gray-800">
              Turn-by-turn
              <textarea
                value={values.directionsText}
                onChange={(e) => patch({ directionsText: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <div>
              <p className="mb-1 text-xs font-medium text-gray-800">Route map</p>
              {values.mapImageUrl ? (
                <div className="flex items-start gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={values.mapImageUrl} alt="" className="max-h-24 rounded border object-cover" />
                  <button type="button" onClick={() => patch({ mapImageUrl: "" })} className="text-xs text-red-600">
                    Remove
                  </button>
                </div>
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-sky-700">
                  <ImageIcon className="h-3.5 w-3.5" />
                  {uploadingMapImage ? "Uploading…" : "Upload map screenshot"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingMapImage}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingMapImage(true);
                      try {
                        const [url] = await uploadImageFiles([file]);
                        patch({ mapImageUrl: url });
                      } catch (err) {
                        onErrorChange?.(err instanceof Error ? err.message : "Upload failed.");
                      } finally {
                        setUploadingMapImage(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs text-gray-600">
                Route photos ({values.routePhotos.length}/{MAX_ROUTE_PHOTOS})
              </p>
              <div className="flex flex-wrap gap-2">
                {values.routePhotos.map((photo, index) => (
                  <div key={`${photo}-${index}`} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="" className="h-14 w-20 rounded border object-cover" />
                    <button
                      type="button"
                      onClick={() => patch({ routePhotos: values.routePhotos.filter((_, i) => i !== index) })}
                      className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
                {values.routePhotos.length < MAX_ROUTE_PHOTOS ? (
                  <label className="flex h-14 w-20 cursor-pointer items-center justify-center rounded border border-dashed border-gray-300 text-gray-500 hover:border-sky-400">
                    {uploadingRoutePhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={uploadingRoutePhoto}
                      onChange={async (e) => {
                        const { files, skipped } = pickRoutePhotoFiles(e.target.files, values.routePhotos.length);
                        if (files.length === 0) return;
                        setUploadingRoutePhoto(true);
                        try {
                          const urls = await uploadImageFiles(files);
                          patch({ routePhotos: [...values.routePhotos, ...urls] });
                          if (skipped > 0) onErrorChange?.(`${skipped} skipped — max ${MAX_ROUTE_PHOTOS}.`);
                        } catch (err) {
                          onErrorChange?.(err instanceof Error ? err.message : "Upload failed.");
                        } finally {
                          setUploadingRoutePhoto(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-orange-800">Fields come from the saved catalog route.</p>
        )}
        {showAttach ? (
          <RunManageRouteAttachPanel
            values={values}
            patch={patch}
            cityRunId={context.cityRunId}
            citySlug={generateCitySlugFromParts(values.meetUpCity, values.meetUpState) || null}
            onError={onErrorChange}
          />
        ) : null}
      </div>
    ) : null;

  return (
    <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
      {!isTrack ? (
        <SideCard
          title="Route"
          summary={routeSummary}
          actions={
            <>
              <button
                type="button"
                onClick={() => setRouteEditOpen((v) => !v)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-50"
              >
                {routeEditOpen ? "Done" : "Edit route"}
              </button>
              <button
                type="button"
                onClick={() => setShowAttach((v) => !v)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-50"
              >
                {showAttach ? "Hide attach" : "Attach"}
              </button>
              <Link
                href="/build-a-run/routes/new"
                target="_blank"
                className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-900 hover:bg-orange-100"
              >
                Build
              </Link>
            </>
          }
          expanded={routeExpanded}
        />
      ) : null}

      {context.cityRunType !== "RACE_SHAKEOUT" ? (
        <SideCard
          title="Workout"
          summary={
            values.attachedWorkoutTitle?.trim() || values.plannedWorkoutId
              ? values.attachedWorkoutTitle.trim() || "Workout attached"
              : "No workout"
          }
          actions={
            <button
              type="button"
              onClick={() => setShowWorkout((v) => !v)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-50"
            >
              {showWorkout ? "Done" : values.plannedWorkoutId ? "Edit" : "Add"}
            </button>
          }
          expanded={
            showWorkout ? (
              <TrackWorkoutBuilder
                clubId={context.clubId?.trim() || ""}
                cityRunId={context.cityRunId}
                runDate={values.date}
                values={{
                  trackWorkoutDescription: values.trackWorkoutDescription,
                  plannedWorkoutId: values.plannedWorkoutId,
                  attachedWorkoutTitle: values.attachedWorkoutTitle,
                  clubWorkoutType: values.clubWorkoutType,
                }}
                initialSegments={context.plannedWorkoutSegments ?? null}
                initialWorkoutTitle={context.plannedWorkoutTitle ?? null}
                initialWorkoutType={context.plannedWorkoutType ?? null}
                onChange={(partial) => patch(partial)}
                onError={onErrorChange}
              />
            ) : null
          }
        />
      ) : null}

      <SideCard
        title="Build content"
        summary={
          contentHasDraft === null
            ? "Content Studio"
            : contentHasDraft
              ? "Draft in progress"
              : "No draft yet"
        }
        actions={
          buildUrl ? (
            <a
              href={buildUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900 hover:bg-sky-100"
            >
              <Sparkles className="h-3 w-3" />
              {contentHasDraft ? "Continue" : "New"}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          ) : (
            <span className="text-xs text-gray-500">Set content URL</span>
          )
        }
      />

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700">
        <p className="font-medium text-gray-900">On this run</p>
        <ul className="mt-1 space-y-0.5">
          <li>
            <span className="text-gray-500">When:</span> {miniSummary.when}
          </li>
          <li>
            <span className="text-gray-500">Where:</span> {miniSummary.where}
          </li>
          <li>
            <span className="text-gray-500">Route:</span> {miniSummary.route}
          </li>
          <li>
            <span className="text-gray-500">Workout:</span> {miniSummary.workout}
          </li>
        </ul>
      </div>

      {instanceToolbar ? (
        <WizardInstanceToolbar
          autoSaveStatus={instanceToolbar.autoSaveStatus}
          run={
            instanceToolbar.published || instanceToolbar.workflowStatus
              ? {
                  published: Boolean(instanceToolbar.published),
                  workflowStatus: instanceToolbar.workflowStatus ?? "DEVELOP",
                }
              : null
          }
          isFounder={instanceToolbar.isFounder}
          onSubmitForReview={instanceToolbar.onSubmitForReview}
          submitting={instanceToolbar.submitting}
          onTogglePublished={instanceToolbar.onTogglePublished}
          togglingPublished={instanceToolbar.togglingPublished}
          onSaveAndPreview={instanceToolbar.onSaveAndPreview}
          saving={instanceToolbar.savingPreview}
          saveLabel={instanceToolbar.saveLabel ?? "Save & Preview"}
          previewPublicUrl={instanceToolbar.previewPublicUrl}
        />
      ) : null}
    </aside>
  );
}
