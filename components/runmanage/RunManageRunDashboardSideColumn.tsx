"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ClipboardCopy,
  ExternalLink,
  ImageIcon,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import RunInstanceSourcesPanel from "@/components/runmanage/runInstanceWizard/RunInstanceSourcesPanel";
import RunManageRouteAttachPanel from "@/components/runmanage/runInstanceWizard/RunManageRouteAttachPanel";
import TrackWorkoutBuilder from "@/components/runmanage/runInstanceWizard/TrackWorkoutBuilder";
import { RunManageDayCorrectionsDialog } from "@/components/runmanage/RunManageDayCorrectionsDialog";
import { generateCitySlugFromParts } from "@/lib/utils/parseAddress";
import { isTrackRun } from "@/lib/runTypes";
import {
  MAX_ROUTE_PHOTOS,
  pickRoutePhotoFiles,
  uploadImageFiles,
} from "@/lib/client/uploadImages";
import runmanageApi from "@/lib/runmanage/api-client";
import { buildRunValidateLlmPacket } from "@/lib/runmanage/run-validate-llm-packet";
import { contentStudioRunBuildUrl } from "@/lib/runmanage/content-studio-run-build";
import { formatInstanceDateLabel } from "@/components/runmanage/runInstanceWizard/shared";
import type { RunInstanceWizardContext, RunInstanceWizardValues } from "@/components/runmanage/runInstanceWizard/shared";
import WizardInstanceToolbar from "@/components/runmanage/runInstanceWizard/WizardInstanceToolbar";
import type { RunDashboardInstanceToolbar } from "@/components/runmanage/run-dashboard-instance-toolbar";

function SideCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="space-y-3 px-4 py-3 text-sm">{children}</div>
    </div>
  );
}

type Props = {
  values: RunInstanceWizardValues;
  patch: (partial: Partial<RunInstanceWizardValues>) => void;
  context: RunInstanceWizardContext;
  cityLabel: string;
  onErrorChange?: (msg: string | null) => void;
  onRunRefreshed?: () => void;
  instanceToolbar?: RunDashboardInstanceToolbar;
};

export default function RunManageRunDashboardSideColumn({
  values,
  patch,
  context,
  cityLabel,
  onErrorChange,
  onRunRefreshed,
  instanceToolbar,
}: Props) {
  const [showAttach, setShowAttach] = useState(false);
  const [showWorkout, setShowWorkout] = useState(
    Boolean(values.plannedWorkoutId?.trim() || values.trackWorkoutDescription?.trim())
  );
  const [uploadingMapImage, setUploadingMapImage] = useState(false);
  const [uploadingRoutePhoto, setUploadingRoutePhoto] = useState(false);
  const [llmOpen, setLlmOpen] = useState(false);
  const [correctionsOpen, setCorrectionsOpen] = useState(false);
  const [copiedPacket, setCopiedPacket] = useState(false);
  const [contentHasDraft, setContentHasDraft] = useState<boolean | null>(null);
  const [contentConfigured, setContentConfigured] = useState(true);

  const isTrack = isTrackRun(values.runType);
  const linkedSavedRoute = Boolean(values.routeId?.trim());
  const cityRunId = context.cityRunId?.trim() ?? "";
  const buildUrl = cityRunId ? contentStudioRunBuildUrl(cityRunId) : null;

  const { packet, row: runsForParse } = useMemo(
    () =>
      buildRunValidateLlmPacket({
        cityLabel,
        run: {
          id: cityRunId,
          title: values.title,
          date: values.date,
          startTimeHour: values.startTimeHour ? Number(values.startTimeHour) : null,
          startTimeMinute: values.startTimeMinute ? Number(values.startTimeMinute) : null,
          startTimePeriod: values.startTimePeriod || null,
          meetUpPoint: values.meetUpPoint,
          description: values.description,
          stravaMapUrl: values.stravaMapUrl,
          routeNotes: values.routeNotes,
          stravaEventUrl: values.stravaEventUrl,
          webUrl: values.webUrl,
          runClub: context.clubName ? { name: context.clubName } : null,
        },
      }),
    [cityLabel, cityRunId, values, context.clubName]
  );

  const allowedRunIds = useMemo(() => (cityRunId ? [cityRunId] : []), [cityRunId]);

  useEffect(() => {
    if (!cityRunId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await runmanageApi.get(`/api/runmanage/runs/${encodeURIComponent(cityRunId)}/content-draft`);
        if (cancelled) return;
        const data = res.data as { hasDraft?: boolean; configured?: boolean };
        setContentHasDraft(Boolean(data?.hasDraft));
        setContentConfigured(data?.configured !== false);
      } catch {
        if (!cancelled) {
          setContentHasDraft(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cityRunId]);

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
      route: values.stravaMapUrl.trim() ? "Strava link set" : values.routeId?.trim() ? "Catalog route" : "No route",
      photos: values.mapImageUrl || values.routePhotos.length > 0 ? "Yes" : "No",
      workout:
        values.plannedWorkoutId?.trim() || values.attachedWorkoutTitle?.trim()
          ? values.attachedWorkoutTitle.trim() || "Attached"
          : "None",
    };
  }, [values]);

  const copyPacket = useCallback(async () => {
    await navigator.clipboard.writeText(packet);
    setCopiedPacket(true);
    setTimeout(() => setCopiedPacket(false), 2000);
  }, [packet]);

  return (
  <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      {!isTrack ? (
        <SideCard
          title="Route"
          actions={
            <>
              <button
                type="button"
                onClick={() => setShowAttach((v) => !v)}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
              >
                {showAttach ? "Hide attach" : "Attach a route"}
              </button>
            </>
          }
        >
          <p className="text-xs text-gray-600">
            {values.stravaMapUrl.trim() ? (
              <a
                href={values.stravaMapUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sky-700 underline break-all"
              >
                {values.linkedRouteName.trim() || values.stravaMapUrl.trim()}
              </a>
            ) : values.routeId?.trim() ? (
              <span className="text-gray-900">Catalog: {values.linkedRouteName.trim() || "Attached route"}</span>
            ) : (
              <span className="text-gray-500">No route link</span>
            )}
          </p>
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
            </>
          ) : (
            <p className="text-xs text-orange-800">
              Map fields come from the saved route. Use Replace on attach panel to edit manually.
            </p>
          )}
          {showAttach ? (
            <div className="border-t border-gray-100 pt-3">
              <RunManageRouteAttachPanel
                values={values}
                patch={patch}
                cityRunId={context.cityRunId}
                citySlug={generateCitySlugFromParts(values.meetUpCity, values.meetUpState) || null}
                onError={onErrorChange}
              />
            </div>
          ) : null}
        </SideCard>
      ) : null}

      {!isTrack ? (
        <SideCard title="Photos">
          <label className="block text-xs font-medium text-gray-800">Route map image</label>
          {values.mapImageUrl ? (
            <div className="flex items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={values.mapImageUrl}
                alt="Route map"
                className="max-w-full rounded-lg border border-gray-200"
              />
              {!linkedSavedRoute ? (
                <button
                  type="button"
                  onClick={() => patch({ mapImageUrl: "" })}
                  className="text-xs text-red-600"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ) : linkedSavedRoute ? null : (
            <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-3 text-center hover:border-sky-500">
              <span className="inline-flex items-center gap-2 text-xs text-gray-600">
                <ImageIcon className="h-4 w-4" />
                {uploadingMapImage ? "Uploading…" : "Upload map screenshot"}
              </span>
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
          <div>
            <p className="mb-1 text-xs font-medium text-gray-800">
              Route photos ({values.routePhotos.length}/{MAX_ROUTE_PHOTOS})
            </p>
            <div className="grid grid-cols-2 gap-2">
              {values.routePhotos.map((photo, index) => (
                <div key={`${photo}-${index}`} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="" className="aspect-video w-full rounded border object-cover" />
                  {!linkedSavedRoute ? (
                    <button
                      type="button"
                      onClick={() =>
                        patch({ routePhotos: values.routePhotos.filter((_, i) => i !== index) })
                      }
                      className="absolute right-1 top-1 rounded-full bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              ))}
              {!linkedSavedRoute && values.routePhotos.length < MAX_ROUTE_PHOTOS ? (
                <label className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-gray-300 text-xs text-gray-600 hover:border-sky-500">
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
                        if (skipped > 0) {
                          onErrorChange?.(`${skipped} photo(s) skipped — max ${MAX_ROUTE_PHOTOS}.`);
                        }
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
        </SideCard>
      ) : null}

      <SideCard title="Sources">
        <RunInstanceSourcesPanel values={values} onChange={(p) => patch(p)} />
      </SideCard>

      {context.cityRunType !== "RACE_SHAKEOUT" ? (
        <SideCard
          title="Workout"
          actions={
            <button
              type="button"
              onClick={() => setShowWorkout((v) => !v)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
            >
              {showWorkout ? "Hide" : values.plannedWorkoutId ? "Edit" : "Add"}
            </button>
          }
        >
          <p className="text-xs text-gray-600">
            {values.attachedWorkoutTitle?.trim() || values.plannedWorkoutId
              ? values.attachedWorkoutTitle.trim() || "Workout attached"
              : "No workout"}
          </p>
          {showWorkout ? (
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
          ) : null}
        </SideCard>
      ) : null}

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-xs text-gray-700">
        <p className="font-semibold text-gray-900">On this run</p>
        <ul className="mt-2 space-y-1">
          <li>
            <span className="text-gray-500">Title:</span> {miniSummary.title}
          </li>
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
            <span className="text-gray-500">Photos:</span> {miniSummary.photos}
          </li>
          <li>
            <span className="text-gray-500">Workout:</span> {miniSummary.workout}
          </li>
        </ul>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          disabled={!cityRunId}
          onClick={() => setLlmOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
        >
          <ClipboardCopy className="h-4 w-4" />
          Check this run
        </button>
        <button
          type="button"
          disabled={!cityRunId}
          onClick={() => setCorrectionsOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          Apply run corrections
        </button>
        {buildUrl ? (
          <a
            href={buildUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100"
          >
            <Sparkles className="h-4 w-4" />
            {contentHasDraft ? "Continue" : "New"} — Build content for this run
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
        ) : (
          <p className="text-center text-xs text-gray-500">Set GOFAST_CONTENT_API_URL for content builder link.</p>
        )}
        {!contentConfigured && buildUrl ? (
          <p className="text-center text-xs text-gray-500">Sign in on Content Studio to see draft status.</p>
        ) : null}
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

      {llmOpen ? (
        <RunLlmPacketDialog packet={packet} copied={copiedPacket} onCopy={() => void copyPacket()} onClose={() => setLlmOpen(false)} />
      ) : null}

      <RunManageDayCorrectionsDialog
        open={correctionsOpen}
        onClose={() => setCorrectionsOpen(false)}
        allowedRunIds={allowedRunIds}
        runsForParse={[runsForParse]}
        onApplied={() => onRunRefreshed?.()}
      />
    </aside>
  );
}

function RunLlmPacketDialog({
  packet,
  copied,
  onCopy,
  onClose,
}: {
  packet: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Check this run — LLM packet</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <textarea
          readOnly
          value={packet}
          className="min-h-[280px] flex-1 resize-none border-0 px-4 py-3 font-mono text-xs text-gray-800 focus:ring-0"
        />
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white"
          >
            <ClipboardCopy className="h-4 w-4" />
            {copied ? "Copied" : "Copy packet"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
