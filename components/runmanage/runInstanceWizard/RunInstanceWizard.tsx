"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  MapPin,
  Route,
  Sparkles,
  Activity,
  ClipboardList,
  Users,
  X,
} from "lucide-react";
import RunManageAssociateStep from "@/components/runmanage/runInstanceWizard/RunManageAssociateStep";
import type { RunAffiliationDraft } from "@/components/runmanage/RunManageRunAffiliations";
import runmanageApi from "@/lib/runmanage/api-client";
import GooglePlacesAutocomplete from "@/components/runmanage/GooglePlacesAutocomplete";
import { parseGoogleAddress } from "@/lib/utils/parseAddress";
import { dateMatchesDayOfWeek } from "@/lib/calendarDay";
import { formatDayLabel } from "@/lib/runmanage/format-day-label";
import { composeInstanceDescriptionDraft } from "@/lib/runInstanceContent";
import { hasRouteDetailsSource } from "@/lib/services/route-details-source";
import {
  DEFAULT_PACE_OPTION,
  isTrackRun,
  normalizeRunType,
  nullRouteFieldsForTrackRun,
  PACE_OPTIONS,
  RUN_TYPE_LABELS,
  RUN_TYPE_VALUES,
} from "@/lib/runTypes";
import {
  MAX_ROUTE_PHOTOS,
  pickRoutePhotoFiles,
  uploadImageFiles,
} from "@/lib/client/uploadImages";
import CoreChecklistRow from "./CoreChecklistRow";
import RunInstanceSourcesPanel, { hasRunInstanceSources } from "./RunInstanceSourcesPanel";
import TrackWorkoutBuilder from "./TrackWorkoutBuilder";
import RunClubPublicSourcesCard, {
  type RunClubPublicSources,
} from "./RunClubPublicSourcesCard";
import WizardInstanceToolbar from "./WizardInstanceToolbar";
import type { AutoSaveStatus } from "@/components/runclub/edit/SaveStatusPill";
import { wizardSidebarButtonClasses } from "@/components/club-manager/WizardStatusDot";
import type { WizardStepVisualStatus } from "@/lib/runmanage/wizard-step-visual-status";
import {
  WIZARD_STEPS,
  wizardStepOrderForVariant,
  buildInstanceContextFromValues,
  fieldChanged,
  formatInstanceDateLabel,
  formatStartTimeLabel,
  type CoreEditKey,
  type RunInstanceWizardContext,
  type RunInstanceWizardValues,
  type WizardStep,
} from "./shared";
import type { IntakeMode } from "@/components/runmanage/intake/IntakeModePicker";
import RunManageScratchIntakeStep from "./RunManageScratchIntakeStep";
import RunManageOpenCorePanel from "./RunManageOpenCorePanel";

export type RunInstanceWizardProps = {
  values: RunInstanceWizardValues;
  onChange: (values: RunInstanceWizardValues) => void;
  context: RunInstanceWizardContext;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  error?: string | null;
  onErrorChange?: (msg: string | null) => void;
  saveLabel?: string;
  hideFooter?: boolean;
  headerSlot?: ReactNode;
  /** Club public links + overview — shown above wizard steps in every flow when set. */
  publicSources?: RunClubPublicSources | null;
  /** Sticky sidebar: autosave status, lifecycle, submit/publish, preview link. */
  instanceToolbar?: {
    autoSaveStatus: AutoSaveStatus;
    published: boolean;
    workflowStatus?: string;
    isFounder?: boolean;
    onSubmitForReview?: () => void;
    submitting?: boolean;
    onTogglePublished?: () => void;
    togglingPublished?: boolean;
    onSaveAndPreview: () => void;
    savingPreview?: boolean;
    saveLabel?: string;
    previewPublicUrl?: string | null;
  };
  /** Open directly on a wizard step (e.g. workout from Active Schedule). */
  initialWizardStep?: WizardStep;
  /** Title is edited in the page heading — core step skips title checklist */
  titleInPageHeading?: boolean;
  /** Shakeout / special — optional club and brand stamps */
  associateDraft?: RunAffiliationDraft;
  onAssociateChange?: (next: RunAffiliationDraft) => void;
  onAssociateSave?: () => void | Promise<void>;
  associateSaving?: boolean;
  associateError?: string | null;
  associateMessage?: string | null;
};

function renderCoreStatusBadge(opts: {
  changed?: boolean;
  missing?: boolean;
  instanceOnly?: boolean;
  series?: boolean;
}) {
  if (opts.missing) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
        Missing
      </span>
    );
  }
  if (opts.changed) {
    return (
      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-900">
        Changed
      </span>
    );
  }
  if (opts.instanceOnly) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">
        This instance
      </span>
    );
  }
  if (opts.series) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        Series
      </span>
    );
  }
  return null;
}

export default function RunInstanceWizard({
  values,
  onChange,
  context,
  onSave,
  saving = false,
  error,
  onErrorChange,
  saveLabel = "Save",
  hideFooter = false,
  headerSlot,
  publicSources,
  instanceToolbar,
  initialWizardStep,
  titleInPageHeading = false,
  associateDraft,
  onAssociateChange,
  onAssociateSave,
  associateSaving = false,
  associateError,
  associateMessage,
}: RunInstanceWizardProps) {
  const isCreateScratch = context.variant === "create-scratch";
  const resolvedInitialStep: WizardStep =
    initialWizardStep ?? (isCreateScratch ? "intake" : "sources");
  const [wizardStep, setWizardStep] = useState<WizardStep>(resolvedInitialStep);
  const [coreEditKey, setCoreEditKey] = useState<CoreEditKey>(null);
  const [intakeMode, setIntakeMode] = useState<IntakeMode | null>(null);
  const [intakeApplied, setIntakeApplied] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [generatingRouteDetails, setGeneratingRouteDetails] = useState(false);
  const [uploadingMapImage, setUploadingMapImage] = useState(false);
  const [uploadingRoutePhoto, setUploadingRoutePhoto] = useState(false);

  const patch = (partial: Partial<RunInstanceWizardValues>) => {
    onChange({ ...values, ...partial });
  };

  const isTrack = isTrackRun(values.runType);
  const dayLabel = context.dayOfWeek ? formatDayLabel(context.dayOfWeek) : "Run";
  const baseline = context.seriesBaseline;
  const isSeries = context.isSeriesInstance ?? context.variant === "create-series";

  const weekdayMismatch =
    values.date.trim() !== "" && context.requireSeriesDay
      ? !dateMatchesDayOfWeek(values.date.trim(), context.requireSeriesDay)
      : false;

  const canGenerateRouteDetails = useMemo(
    () =>
      hasRouteDetailsSource({
        mapImageUrl: values.mapImageUrl.trim() || null,
        directionsText: values.directionsText.trim() || null,
        routeNotes: values.routeDescription.trim() || null,
      }),
    [values.mapImageUrl, values.directionsText, values.routeDescription]
  );

  const sourcesStepComplete = hasRunInstanceSources(values);

  const coreStepComplete = Boolean(
    values.date.trim() &&
      !weekdayMismatch &&
      values.meetUpPoint.trim() &&
      (titleInPageHeading || values.title.trim())
  );

  const routeStepComplete = Boolean(
    values.routeDescription.trim() ||
      values.mapImageUrl.trim() ||
      values.stravaMapUrl.trim() ||
      values.directionsText.trim() ||
      values.routeNeighborhood.trim()
  );

  const workoutStepComplete =
    Boolean(values.plannedWorkoutId.trim() && values.attachedWorkoutTitle.trim()) ||
    !values.trackWorkoutDescription.trim();

  const descriptionStepComplete = Boolean(values.description.trim());

  const stepOrder = useMemo(
    () => wizardStepOrderForVariant(context.variant),
    [context.variant]
  );

  const showAssociateStep =
    context.variant === "edit" &&
    (context.cityRunType === "RACE_SHAKEOUT" || context.cityRunType === "SPECIAL") &&
    Boolean(associateDraft && onAssociateChange && onAssociateSave);

  const visibleWizardSteps = useMemo(() => {
    let steps = isCreateScratch ? stepOrder : isTrack ? stepOrder.filter((s) => s !== "route") : stepOrder;
    if (!showAssociateStep) {
      steps = steps.filter((s) => s !== "associate");
    }
    return steps;
  }, [isCreateScratch, isTrack, stepOrder, showAssociateStep]);

  const lastWizardStep = visibleWizardSteps[visibleWizardSteps.length - 1] ?? "workout";

  const goToWizardStep = (step: WizardStep) => {
    setWizardStep(step);
    setCoreEditKey(null);
    onErrorChange?.(null);
  };

  const validateCoreStep = (): boolean => {
    if (!values.date.trim()) {
      onErrorChange?.("Pick a date.");
      return false;
    }
    if (weekdayMismatch) {
      onErrorChange?.(`Date must be a ${dayLabel}.`);
      return false;
    }
    if (!values.meetUpPoint.trim()) {
      onErrorChange?.("Meet-up is required.");
      return false;
    }
    if (!titleInPageHeading && !values.title.trim()) {
      onErrorChange?.("Title is required.");
      return false;
    }
    if (titleInPageHeading && !values.title.trim()) {
      onErrorChange?.("Add a run title in the heading above.");
      return false;
    }
    onErrorChange?.(null);
    return true;
  };

  const stepIndex = (step: WizardStep) => visibleWizardSteps.indexOf(step);

  const handleWizardNext = () => {
    const idx = stepIndex(wizardStep);
    const next = visibleWizardSteps[idx + 1];
    if (!next) return;

    if (wizardStep === "intake") {
      if (!intakeMode) {
        onErrorChange?.("Choose manual, AI parse, or CSV.");
        return;
      }
      if (intakeMode !== "manual" && !intakeApplied) {
        onErrorChange?.("Parse or import your row before continuing.");
        return;
      }
      onErrorChange?.(null);
      goToWizardStep(next);
      return;
    }
    if (wizardStep === "core") {
      if (!validateCoreStep()) return;
      goToWizardStep(next);
      return;
    }
    goToWizardStep(next);
  };

  const handleWizardBack = () => {
    const idx = stepIndex(wizardStep);
    const prev = visibleWizardSteps[idx - 1];
    if (prev) goToWizardStep(prev);
  };

  const firstWizardStep = visibleWizardSteps[0] ?? "sources";

  const handleWizardStepClick = (step: WizardStep) => {
    goToWizardStep(step);
  };

  const toggleCoreEdit = (key: CoreEditKey) => {
    setCoreEditKey((prev) => (prev === key ? null : key));
  };

  const handleRunTypeChange = (nextRunType: string) => {
    if (isTrackRun(nextRunType)) {
      const nulls = nullRouteFieldsForTrackRun(nextRunType);
      onChange({
        ...values,
        runType: nextRunType,
        stravaMapUrl: nulls ? "" : values.stravaMapUrl,
        mapImageUrl: nulls ? "" : values.mapImageUrl,
        routePhotos: nulls ? [] : values.routePhotos,
        routeNeighborhood: nulls ? "" : values.routeNeighborhood,
        directionsText: nulls ? "" : values.directionsText,
        routeDescription: nulls ? "" : values.routeDescription,
      });
    } else {
      patch({ runType: nextRunType });
    }
  };

  const meetUpSummary = useMemo(() => {
    const parts = [values.meetUpPoint.trim()];
    const cityState = [values.meetUpCity.trim(), values.meetUpState.trim()].filter(Boolean).join(", ");
    if (cityState) parts.push(cityState);
    return parts.filter(Boolean).join(" · ") || "";
  }, [values.meetUpPoint, values.meetUpCity, values.meetUpState]);

  const dateTimeSummary = `${formatInstanceDateLabel(values.date)} at ${formatStartTimeLabel(
    values.startTimeHour,
    values.startTimeMinute,
    values.startTimePeriod
  )}`;

  const finishSummary = values.endPointSameAsStart
    ? "Same as start"
    : values.endPoint.trim() || "Different finish — not set";

  const milesPaceSummary =
    [values.totalMiles.trim() ? `${values.totalMiles.trim()} mi` : null, values.pace.trim() || null]
      .filter(Boolean)
      .join(" · ") || "—";

  const venueSummary = values.runType
    ? (RUN_TYPE_LABELS[values.runType as keyof typeof RUN_TYPE_LABELS] ?? values.runType)
    : "—";

  const timeChangedFromSeries = baseline
    ? fieldChanged(values.startTimeHour, baseline.startTimeHour) ||
      fieldChanged(values.startTimeMinute, baseline.startTimeMinute) ||
      fieldChanged(values.startTimePeriod, baseline.startTimePeriod)
    : false;

  const wizardStepVisualStatus = (step: WizardStep): WizardStepVisualStatus => {
    const s = wizardStepStatus(step);
    if (s === "complete") return "complete";
    if (s === "partial") return "partial";
    return "notStarted";
  };

  const wizardStepIcon = (step: WizardStep) => {
    if (step === "intake") return <ClipboardList className="h-4 w-4" />;
    if (step === "sources") return <Link2 className="h-4 w-4" />;
    if (step === "associate") return <Users className="h-4 w-4" />;
    if (step === "core") return <MapPin className="h-4 w-4" />;
    if (step === "route") return <Route className="h-4 w-4" />;
    if (step === "workout") return <Activity className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const wizardStepStatus = (step: WizardStep): "complete" | "partial" | "idle" => {
    if (step === "intake") {
      if (intakeMode === "manual") return "complete";
      if (intakeApplied) return "complete";
      if (intakeMode) return "partial";
      return "idle";
    }
    if (step === "sources") {
      if (sourcesStepComplete) return "complete";
      return "idle";
    }
    if (step === "associate") {
      if (associateDraft?.runClubId || associateDraft?.runBrandId) return "complete";
      return "idle";
    }
    if (step === "core") {
      if (coreStepComplete) return "complete";
      if (values.date.trim() || values.meetUpPoint.trim() || values.title.trim()) return "partial";
      return "idle";
    }
    if (step === "route") {
      if (routeStepComplete) return "complete";
      if (values.stravaMapUrl.trim() || values.mapImageUrl.trim()) return "partial";
      return "idle";
    }
    if (step === "workout") {
      if (workoutStepComplete) return "complete";
      if (values.trackWorkoutDescription.trim()) return "partial";
      return "idle";
    }
    if (step === "description") {
      if (descriptionStepComplete) return "complete";
      if (generatingDescription) return "partial";
      return "idle";
    }
    return "idle";
  };

  const handleGenerateRouteDetails = async () => {
    if (!canGenerateRouteDetails) {
      onErrorChange?.("Upload a route map or add pasted directions first.");
      return;
    }
    setGeneratingRouteDetails(true);
    onErrorChange?.(null);
    try {
      const res = await runmanageApi.post("/api/runs/route-details-generate", {
        mapImageUrl: values.mapImageUrl.trim() || null,
        directionsText: values.directionsText.trim() || null,
        routeNotes: values.routeDescription.trim() || null,
        routeNeighborhood: values.routeNeighborhood.trim() || null,
        stravaMapUrl: values.stravaMapUrl.trim() || null,
        totalMiles: values.totalMiles.trim() || null,
        meetUpPoint: values.meetUpPoint.trim() || null,
      });
      if (res.data?.success && res.data.routeNotes) {
        patch({ routeDescription: String(res.data.routeNotes).trim() });
      } else {
        throw new Error(res.data?.error || "Could not generate route path");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      onErrorChange?.(err.response?.data?.error || err.message || "Route generation failed.");
    } finally {
      setGeneratingRouteDetails(false);
    }
  };

  const handleDraftDescription = () => {
    if (isTrack) {
      const workout = values.trackWorkoutDescription.trim();
      if (workout) {
        patch({ description: workout });
        onErrorChange?.(null);
      } else {
        onErrorChange?.("Add a workout description for this track session first.");
      }
      return;
    }
    const draft = composeInstanceDescriptionDraft({
      routeNotes: values.routeDescription,
      routeNeighborhood: values.routeNeighborhood,
      postRunActivity: values.postRunActivity,
      endPoint: values.endPointSameAsStart ? null : values.endPoint,
      totalMiles: values.totalMiles || null,
    });
    if (draft) {
      patch({ description: draft });
      onErrorChange?.(null);
    } else {
      onErrorChange?.("Add route notes, finish point, or post-run details for this run first.");
    }
  };

  const handleGenerateDescription = async () => {
    setGeneratingDescription(true);
    onErrorChange?.(null);
    try {
      const instanceContext = buildInstanceContextFromValues(values);
      const res = await runmanageApi.post("/api/runs/run-description-generate", {
        clubName: context.clubName ?? undefined,
        isSeriesInstance: isSeries,
        ...(isSeries && context.seriesContext
          ? {
              seriesContext: context.seriesContext,
              instanceContext,
            }
          : {
              dayOfWeek: values.dayOfWeek || context.dayOfWeek || undefined,
              dateYmd: values.date || undefined,
              meetUpPoint: values.meetUpPoint || undefined,
              endPoint: values.endPointSameAsStart ? undefined : values.endPoint || undefined,
              routeNeighborhood: values.routeNeighborhood || undefined,
              runType: values.runType || undefined,
              workoutDescription: isTrack
                ? values.trackWorkoutDescription || undefined
                : values.routeDescription || undefined,
              totalMiles: values.totalMiles || undefined,
              pace: values.pace || undefined,
              postRunActivity: values.postRunActivity || undefined,
              stravaEventUrl: values.stravaEventUrl || undefined,
              stravaText: values.stravaText || undefined,
              webText: values.webText || undefined,
              mapImageUrl: values.mapImageUrl || undefined,
              existingDescription: values.description || undefined,
            }),
      });
      if (res.data?.success && res.data.description) {
        patch({ description: String(res.data.description).trim() });
      } else {
        throw new Error(res.data?.error || "Could not generate description");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      onErrorChange?.(err.response?.data?.error || err.message || "Generate failed.");
    } finally {
      setGeneratingDescription(false);
    }
  };

  const coreIntro = isSeries
    ? "Most fields are pulled from the weekly series. Review the few things that are different this week."
    : "Title, date, meet-up, distance, and pace for this run instance.";

  return (
    <div className="space-y-4">
      {headerSlot}
      {publicSources ? <RunClubPublicSourcesCard runClub={publicSources} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-[10px] text-gray-500">
            Gray = not started · Yellow = in progress · Green = done
          </p>
          <nav className="space-y-2">
            {WIZARD_STEPS.filter((step) => visibleWizardSteps.includes(step.id)).map((step, index) => {
              const isActive = wizardStep === step.id;
              const visualStatus = wizardStepVisualStatus(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleWizardStepClick(step.id)}
                  className={wizardSidebarButtonClasses(visualStatus, isActive)}
                >
                  <div className="flex w-full items-start gap-2">
                    <div className="mt-0.5 shrink-0">
                      {visualStatus === "complete" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                            isActive ? "bg-sky-600 text-white" : "bg-gray-300 text-gray-700"
                          }`}
                        >
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={isActive ? "text-sky-600" : "text-gray-400"}>
                          {wizardStepIcon(step.id)}
                        </span>
                        <p className="truncate text-sm font-medium">{step.title}</p>
                      </div>
                      <p className="mt-0.5 text-xs opacity-80">{step.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
          {instanceToolbar ? (
            <WizardInstanceToolbar
              autoSaveStatus={instanceToolbar.autoSaveStatus}
              run={
                instanceToolbar.published || instanceToolbar.workflowStatus
                  ? {
                      published: instanceToolbar.published,
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
              saveLabel={instanceToolbar.saveLabel ?? saveLabel}
              previewPublicUrl={instanceToolbar.previewPublicUrl}
            />
          ) : null}
        </aside>

        <div className="min-w-0 space-y-4">
          {wizardStep === "intake" && isCreateScratch ? (
            <RunManageScratchIntakeStep
              values={values}
              mode={intakeMode}
              onModeChange={setIntakeMode}
              onIntakeApplied={() => setIntakeApplied(true)}
              onApply={(next) => {
                onChange(next);
                setIntakeApplied(true);
              }}
              onError={(msg) => onErrorChange?.(msg)}
            />
          ) : null}

          {wizardStep === "sources" && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white px-4 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Source info</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Paste this week&apos;s run-specific sources first. General club links stay in the
                  reference card above when you need them.
                </p>
              </div>
              <RunInstanceSourcesPanel values={values} onChange={patch} />
            </div>
          )}

          {wizardStep === "associate" && showAssociateStep && associateDraft && onAssociateChange && onAssociateSave ? (
            <RunManageAssociateStep
              cityRunType={context.cityRunType}
              draft={associateDraft}
              onChange={onAssociateChange}
              saving={associateSaving}
              onSave={onAssociateSave}
              error={associateError}
              message={associateMessage}
            />
          ) : null}

          {wizardStep === "core" && isCreateScratch ? (
            <RunManageOpenCorePanel
              values={values}
              onChange={onChange}
              patch={patch}
              context={context}
              weekdayMismatch={weekdayMismatch}
              onErrorChange={onErrorChange}
            />
          ) : null}

          {wizardStep === "core" && !isCreateScratch && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Core details</h3>
                <p className="mt-1 text-xs text-gray-600">{coreIntro}</p>
              </div>
              <div className="px-4">
                <CoreChecklistRow
                  label="Title"
                  value={values.title}
                  status={renderCoreStatusBadge({
                    missing: !values.title.trim(),
                    changed: context.defaultTitle
                      ? fieldChanged(values.title, context.defaultTitle)
                      : false,
                  })}
                  onEdit={() => toggleCoreEdit("title")}
                  editOpen={coreEditKey === "title"}
                >
                  <input
                    type="text"
                    value={values.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </CoreChecklistRow>

                {!isSeries && (
                  <CoreChecklistRow
                    label="Day of week"
                    value={values.dayOfWeek || "—"}
                    status={renderCoreStatusBadge({ instanceOnly: true })}
                    onEdit={() => toggleCoreEdit("dayOfWeek")}
                    editOpen={coreEditKey === "dayOfWeek"}
                  >
                    <select
                      value={values.dayOfWeek}
                      onChange={(e) => patch({ dayOfWeek: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {[
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday",
                      ].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </CoreChecklistRow>
                )}

                <CoreChecklistRow
                  label="Date / time"
                  value={dateTimeSummary}
                  status={renderCoreStatusBadge({
                    missing: !values.date.trim() || weekdayMismatch,
                    changed: timeChangedFromSeries,
                    instanceOnly: isSeries && !timeChangedFromSeries,
                    series: isSeries && !timeChangedFromSeries && !weekdayMismatch,
                  })}
                  onEdit={() => toggleCoreEdit("datetime")}
                  editOpen={coreEditKey === "datetime"}
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-900">
                        {isSeries && context.dayOfWeek ? `${dayLabel} date *` : "Date *"}
                      </label>
                      <input
                        type="date"
                        value={values.date}
                        onChange={(e) => {
                          patch({ date: e.target.value });
                          onErrorChange?.(null);
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      {weekdayMismatch && (
                        <p className="mt-1 text-xs text-red-700">
                          Pick a {dayLabel} — this date does not match.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-900">Start time</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={values.startTimeHour}
                          onChange={(e) => patch({ startTimeHour: e.target.value })}
                          className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                        />
                        <span className="text-gray-500">:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={values.startTimeMinute}
                          onChange={(e) => patch({ startTimeMinute: e.target.value })}
                          className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                        />
                        <select
                          value={values.startTimePeriod}
                          onChange={(e) => patch({ startTimePeriod: e.target.value })}
                          className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </CoreChecklistRow>

                <CoreChecklistRow
                  label="Meet-up"
                  value={meetUpSummary}
                  status={renderCoreStatusBadge({
                    missing: !values.meetUpPoint.trim(),
                    changed: baseline
                      ? fieldChanged(values.meetUpPoint, baseline.meetUpPoint) ||
                        fieldChanged(values.meetUpStreetAddress, baseline.meetUpStreetAddress) ||
                        fieldChanged(values.meetUpCity, baseline.meetUpCity) ||
                        fieldChanged(values.meetUpState, baseline.meetUpState)
                      : false,
                    series: Boolean(
                      isSeries &&
                        baseline &&
                        !fieldChanged(values.meetUpPoint, baseline.meetUpPoint)
                    ),
                  })}
                  onEdit={() => toggleCoreEdit("meetup")}
                  editOpen={coreEditKey === "meetup"}
                >
                  <GooglePlacesAutocomplete
                    value={values.meetUpPoint}
                    onChange={(e) => patch({ meetUpPoint: e.target.value })}
                    onPlaceSelected={(placeData) => {
                      const parsed = parseGoogleAddress(placeData.address);
                      onChange({
                        ...values,
                        meetUpPoint: placeData.name || placeData.address,
                        meetUpStreetAddress: parsed.streetAddress || "",
                        meetUpCity: parsed.city || "",
                        meetUpState: parsed.state || "",
                        meetUpZip: parsed.zip || "",
                        meetUpPlaceId: placeData.placeId || "",
                        meetUpLat: String(placeData.lat),
                        meetUpLng: String(placeData.lng),
                      });
                    }}
                    placeholder="Search for meet-up…"
                    className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      value={values.meetUpStreetAddress}
                      onChange={(e) => patch({ meetUpStreetAddress: e.target.value })}
                      placeholder="Street"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={values.meetUpCity}
                      onChange={(e) => patch({ meetUpCity: e.target.value })}
                      placeholder="City"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={values.meetUpState}
                      onChange={(e) => patch({ meetUpState: e.target.value })}
                      placeholder="State"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </CoreChecklistRow>

                <CoreChecklistRow
                  label="Finish"
                  value={finishSummary}
                  status={renderCoreStatusBadge({
                    changed: !values.endPointSameAsStart,
                    instanceOnly: !values.endPointSameAsStart,
                  })}
                  onEdit={() => toggleCoreEdit("finish")}
                  editOpen={coreEditKey === "finish"}
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={values.endPointSameAsStart}
                      onChange={(e) => patch({ endPointSameAsStart: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-sky-600"
                    />
                    <span className="text-sm text-gray-900">Finish same as start</span>
                  </label>
                  {!values.endPointSameAsStart && (
                    <GooglePlacesAutocomplete
                      value={values.endPoint}
                      onChange={(e) => patch({ endPoint: e.target.value })}
                      onPlaceSelected={(placeData) => {
                        const parsed = parseGoogleAddress(placeData.address);
                        onChange({
                          ...values,
                          endPoint: placeData.name || placeData.address,
                          endStreetAddress: parsed.streetAddress || "",
                          endCity: parsed.city || "",
                          endState: parsed.state || "",
                        });
                      }}
                      placeholder="Where runners finish"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  )}
                </CoreChecklistRow>

                {!isTrack && (
                  <CoreChecklistRow
                    label="Distance / pace"
                    value={milesPaceSummary}
                    status={renderCoreStatusBadge({
                      changed: baseline ? fieldChanged(values.totalMiles, baseline.totalMiles) : false,
                    })}
                    onEdit={() => toggleCoreEdit("milesPace")}
                    editOpen={coreEditKey === "milesPace"}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={values.totalMiles}
                        onChange={(e) => patch({ totalMiles: e.target.value })}
                        placeholder="Miles"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <select
                        value={values.pace || DEFAULT_PACE_OPTION}
                        onChange={(e) => patch({ pace: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select pace…</option>
                        {PACE_OPTIONS.map((pace) => (
                          <option key={pace} value={pace}>
                            {pace}
                          </option>
                        ))}
                        {values.pace &&
                          !PACE_OPTIONS.includes(values.pace as (typeof PACE_OPTIONS)[number]) && (
                            <option value={values.pace}>{values.pace}</option>
                          )}
                      </select>
                    </div>
                  </CoreChecklistRow>
                )}

                <CoreChecklistRow
                  label="Post-run"
                  value={values.postRunActivity.trim() || "—"}
                  status={renderCoreStatusBadge({
                    changed: baseline
                      ? fieldChanged(values.postRunActivity, baseline.postRunActivity)
                      : false,
                  })}
                  onEdit={() => toggleCoreEdit("postRun")}
                  editOpen={coreEditKey === "postRun"}
                >
                  <input
                    type="text"
                    value={values.postRunActivity}
                    onChange={(e) => patch({ postRunActivity: e.target.value })}
                    placeholder="Coffee, bagels, social…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </CoreChecklistRow>

                <CoreChecklistRow
                  label="Run venue"
                  value={venueSummary}
                  status={renderCoreStatusBadge({
                    missing: !values.runType.trim(),
                    changed: baseline ? fieldChanged(values.runType, baseline.runType) : false,
                  })}
                  onEdit={() => toggleCoreEdit("venue")}
                  editOpen={coreEditKey === "venue"}
                >
                  <select
                    value={values.runType}
                    onChange={(e) => handleRunTypeChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {RUN_TYPE_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {RUN_TYPE_LABELS[v]}
                      </option>
                    ))}
                  </select>
                </CoreChecklistRow>
              </div>
            </div>
          )}

          {wizardStep === "route" && (!isTrack || isCreateScratch) && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white px-4 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Route</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Confirm map, directions, and route description. When the route is firm, go back to
                  Description to regenerate public copy.
                </p>
              </div>

              <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-900">Strava route URL</label>
                    <input
                      type="url"
                      value={values.stravaMapUrl}
                      onChange={(e) => patch({ stravaMapUrl: e.target.value })}
                      placeholder="https://www.strava.com/routes/…"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Route/map link shown to runners. Put route links here — not in description sources.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-900">Route neighborhood</label>
                    <input
                      type="text"
                      value={values.routeNeighborhood}
                      onChange={(e) => patch({ routeNeighborhood: e.target.value })}
                      placeholder="e.g. Fletcher's Cove, Carderock"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-900">Route map</label>
                    {values.mapImageUrl ? (
                      <div className="flex items-start gap-3">
                        <img
                          src={values.mapImageUrl}
                          alt="Route map"
                          className="w-full max-w-md rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => patch({ mapImageUrl: "" })}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-4 hover:border-sky-500">
                        <span className="flex items-center justify-center gap-2 text-sm text-gray-600">
                          <ImageIcon className="h-4 w-4" />
                          {uploadingMapImage ? "Uploading…" : "Upload Strava map screenshot"}
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
                              const fd = new FormData();
                              fd.append("file", file);
                              const res = await fetch("/api/upload", { method: "POST", body: fd });
                              const data = await res.json();
                              if (data.url) patch({ mapImageUrl: data.url });
                              else throw new Error(data.error || "Upload failed");
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
                    <label className="mb-1 block text-sm font-medium text-gray-900">Route directions</label>
                    <textarea
                      value={values.directionsText}
                      onChange={(e) => patch({ directionsText: e.target.value })}
                      rows={4}
                      placeholder="Paste Strava notes or turn-by-turn bullets…"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Saved with this run and copied forward when the next weekly instance is
                      advanced. Use for turn-by-turn or Strava notes before generating route copy.
                    </p>
                  </div>

                  <div>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-sm font-medium text-gray-900">Route description</label>
                      <button
                        type="button"
                        onClick={() => void handleGenerateRouteDetails()}
                        disabled={!canGenerateRouteDetails || generatingRouteDetails}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                      >
                        {generatingRouteDetails ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Generate route description
                      </button>
                    </div>
                    <textarea
                      value={values.routeDescription}
                      onChange={(e) => patch({ routeDescription: e.target.value })}
                      rows={4}
                      placeholder="Generated or edited prose for this run's route…"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-900">Route photos</label>
                    <p className="mb-2 text-xs text-gray-500">
                      Optional — up to {MAX_ROUTE_PHOTOS} images.
                    </p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {values.routePhotos.map((photo, index) => (
                        <div key={`${photo}-${index}`} className="group relative">
                          <img
                            src={photo}
                            alt={`Route photo ${index + 1}`}
                            className="aspect-video w-full rounded-lg border border-gray-200 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              patch({
                                routePhotos: values.routePhotos.filter((_, i) => i !== index),
                              })
                            }
                            className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {values.routePhotos.length < MAX_ROUTE_PHOTOS && (
                        <label className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-sky-500 hover:bg-sky-50">
                          <ImageIcon className="h-6 w-6 text-gray-400" />
                          <span className="text-xs text-gray-600">
                            {uploadingRoutePhoto ? "Uploading…" : "Add photos"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={uploadingRoutePhoto}
                            onChange={async (e) => {
                              const { files, skipped } = pickRoutePhotoFiles(
                                e.target.files,
                                values.routePhotos.length
                              );
                              if (files.length === 0) return;
                              setUploadingRoutePhoto(true);
                              onErrorChange?.(null);
                              try {
                                const urls = await uploadImageFiles(files);
                                patch({ routePhotos: [...values.routePhotos, ...urls] });
                                if (skipped > 0) {
                                  onErrorChange?.(
                                    `Only ${MAX_ROUTE_PHOTOS} route photos allowed — ${skipped} skipped.`
                                  );
                                }
                              } catch (err) {
                                onErrorChange?.(
                                  err instanceof Error ? err.message : "Upload failed."
                                );
                              } finally {
                                setUploadingRoutePhoto(false);
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </>
            </div>
          )}

          {wizardStep === "workout" && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white px-4 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Workout</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Optional structured session for this run — intervals, tempo, hills, or progression.
                  Most social runs only need pace in Core details.
                </p>
              </div>
              <TrackWorkoutBuilder
                clubId={context.clubId?.trim() || ""}
                cityRunId={context.cityRunId}
                runDate={values.date}
                values={{
                  trackWorkoutDescription: values.trackWorkoutDescription,
                  plannedWorkoutId: values.plannedWorkoutId,
                  attachedWorkoutTitle: values.attachedWorkoutTitle,
                }}
                initialSegments={context.plannedWorkoutSegments ?? null}
                initialWorkoutTitle={context.plannedWorkoutTitle ?? null}
                initialWorkoutType={context.plannedWorkoutType ?? null}
                onChange={(partial) => patch(partial)}
                onError={onErrorChange}
              />
            </div>
          )}

          {wizardStep === "description" && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white px-4 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Public description</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Draft or generate public copy from source info and core details. Confirm route
                  next, then return here to regenerate once the route is firm.
                </p>
              </div>

              {!isTrack && values.routeDescription.trim() ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Route description summary
                  </p>
                  <p className="mt-1 line-clamp-4">{values.routeDescription.trim()}</p>
                </div>
              ) : null}

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-gray-900">Public description</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleDraftDescription}
                      disabled={generatingDescription}
                      className="text-xs font-medium text-gray-600 underline hover:text-gray-900 disabled:opacity-50"
                    >
                      Quick draft
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleGenerateDescription()}
                      disabled={generatingDescription}
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                    >
                      {generatingDescription ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Generate public description
                    </button>
                  </div>
                </div>
                <textarea
                  value={values.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  rows={6}
                  placeholder="Instance-specific public copy for this dated run…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">Staff notes</label>
                <textarea
                  value={values.staffNotes}
                  onChange={(e) => patch({ staffNotes: e.target.value })}
                  rows={2}
                  placeholder="Internal notes — not shown on public page."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!hideFooter && (
        <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
          {wizardStep !== firstWizardStep ? (
            <button
              type="button"
              onClick={handleWizardBack}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : null}
          {wizardStep !== lastWizardStep ? (
            <button
              type="button"
              onClick={handleWizardNext}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : instanceToolbar ? null : (
            <button
              type="button"
              onClick={() => {
                if (!validateCoreStep()) return;
                void onSave();
              }}
              disabled={saving || weekdayMismatch || !coreStepComplete}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saveLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { type RunInstanceWizardValues, type RunInstanceWizardContext } from "./shared";
