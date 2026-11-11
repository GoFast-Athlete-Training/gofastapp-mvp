"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import TrackWorkoutBuilder from "@/components/runmanage/runInstanceWizard/TrackWorkoutBuilder";
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
  const [showWorkout, setShowWorkout] = useState(false);
  const [contentHasDraft, setContentHasDraft] = useState<boolean | null>(null);

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
      route:
        values.stravaMapUrl.trim() || values.routeId?.trim()
          ? values.linkedRouteName.trim() || "Set"
          : "None",
      workout:
        values.plannedWorkoutId?.trim() || values.attachedWorkoutTitle?.trim()
          ? values.attachedWorkoutTitle.trim() || "Attached"
          : "None",
    };
  }, [values]);

  return (
    <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
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
