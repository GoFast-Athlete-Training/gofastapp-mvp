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
    initialWizardStep ?? (isCreateScratch ? "intake" : "core");
  const [wizardStep, setWizardStep] = useState<WizardStep>(resolvedInitialStep);
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

  const showAssociateStep = Boolean(associateDraft && onAssociateChange);

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

          {wizardStep === "associate" && showAssociateStep && associateDraft && onAssociateChange ? (
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

          {wizardStep === "core" ? (
            <RunManageOpenCorePanel
              values={values}
              onChange={onChange}
              patch={patch}
              context={context}
              weekdayMismatch={weekdayMismatch}
              onErrorChange={onErrorChange}
            />
          ) : null}


          {wizardStep === "route" && (!isTrack || isCreateScratch) && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white px-4 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Route</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Map, directions, and route description for this run.
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
                <h3 className="text-sm font-semibold text-gray-900">Staff notes</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Internal only — not shown on the public run page. Public description is edited
                  above the core fields.
                </p>
              </div>
              <textarea
                value={values.staffNotes}
                onChange={(e) => patch({ staffNotes: e.target.value })}
                rows={4}
                placeholder="Internal notes…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
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
