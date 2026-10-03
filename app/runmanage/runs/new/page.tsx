"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import RunInstanceWizard from "@/components/runmanage/runInstanceWizard/RunInstanceWizard";
import {
  emptyWizardValues,
  type RunInstanceWizardValues,
} from "@/components/runmanage/runInstanceWizard/shared";
import { localCalendarYmd } from "@/lib/date-local";
import { generateCitySlugFromParts } from "@/lib/utils/parseAddress";
import { nullRouteFieldsForTrackRun } from "@/lib/runTypes";
import { normalizeRunType } from "@/lib/runTypes";
import runmanageApi from "@/lib/runmanage/api-client";
import { runInstanceEditPath, RUN_MANAGE_DASHBOARD_PATH } from "@/lib/runmanage/paths";
import {
  affiliationsToPayload,
  emptyAffiliationDraft,
  type RunAffiliationDraft,
} from "@/components/runmanage/RunManageRunAffiliations";
import { useRunManageAuth } from "@/components/runmanage/RunManageProviders";
import RunManageCreateRunScope from "@/components/runmanage/create-run/RunManageCreateRunScope";
import RunContainerIdentityStrip from "@/components/runmanage/create-run/RunContainerIdentityStrip";
import {
  containerIdentityFromScope,
  defaultCreateRunScopeFork,
  isCreateScopeComplete,
  validateCreateRunScope,
  type CreateRunScopeFork,
} from "@/lib/runmanage/create-run-scope";
import {
  emptySpecialEventDraft,
  specialEventApiBodyFromDraft,
  type SpecialEventDraft,
} from "@/lib/runmanage/special-event-draft";

export default function RunManageCreateRunPage() {
  const router = useRouter();
  const { session } = useRunManageAuth();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [affiliations, setAffiliations] = useState<RunAffiliationDraft>(() =>
    emptyAffiliationDraft("CLUB")
  );
  const [scopeFork, setScopeFork] = useState<CreateRunScopeFork>(() => defaultCreateRunScopeFork());
  const [specialEvent, setSpecialEvent] = useState<SpecialEventDraft>(() => emptySpecialEventDraft());
  const [clubDescription, setClubDescription] = useState<string | null>(null);
  const [wizardValues, setWizardValues] = useState<RunInstanceWizardValues>(() =>
    emptyWizardValues(localCalendarYmd(tomorrow))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeComplete = isCreateScopeComplete(
    wizardValues.title,
    affiliations,
    scopeFork,
    specialEvent
  );

  useEffect(() => {
    const clubId = affiliations.runClubId;
    if (!clubId || affiliations.cityRunType !== "CLUB") {
      setClubDescription(null);
      return;
    }
    void (async () => {
      try {
        const res = await runmanageApi.get(`/api/runmanage/run-clubs/${clubId}`);
        if (res.data?.success && res.data.runClub) {
          const desc = (res.data.runClub as { description?: string }).description;
          setClubDescription(typeof desc === "string" ? desc : null);
        }
      } catch {
        setClubDescription(null);
      }
    })();
  }, [affiliations.runClubId, affiliations.cityRunType]);

  const containerIdentity = useMemo(
    () =>
      scopeComplete
        ? containerIdentityFromScope(wizardValues.title, affiliations, scopeFork, {
            clubHydrate: { description: clubDescription },
            specialEvent,
          })
        : null,
    [scopeComplete, wizardValues.title, affiliations, scopeFork, clubDescription, specialEvent]
  );

  const handleCreate = async () => {
    const scopeErr = validateCreateRunScope(
      wizardValues.title,
      affiliations,
      scopeFork,
      specialEvent
    );
    if (scopeErr) {
      setError(scopeErr);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let specialEventId: string | null = specialEvent.id;
      if (affiliations.cityRunType === "SPECIAL") {
        const evRes = await runmanageApi.post(
          "/api/runmanage/special-events",
          specialEventApiBodyFromDraft(specialEvent)
        );
        const evId = evRes.data?.specialEvent?.id;
        if (!evId) {
          throw new Error(evRes.data?.error || "Failed to create special event parent.");
        }
        specialEventId = String(evId);
        setSpecialEvent((prev) => ({ ...prev, id: specialEventId }));
      }
      const finalCitySlug = generateCitySlugFromParts(
        wizardValues.meetUpCity,
        wizardValues.meetUpState
      );
      if (!finalCitySlug) {
        throw new Error("City is required — pick a meet-up from Google Places or enter city.");
      }

      const dateObj = wizardValues.date ? new Date(wizardValues.date) : new Date();
      const trackRouteNulls = nullRouteFieldsForTrackRun(wizardValues.runType);
      const isTrack = wizardValues.runType?.toLowerCase() === "track";

      const payload: Record<string, unknown> = {
        ...affiliationsToPayload(affiliations, session?.athleteId, { specialEventId }),
        citySlug: finalCitySlug,
        title: wizardValues.title.trim(),
        dayOfWeek: wizardValues.dayOfWeek?.trim() || null,
        date: dateObj.toISOString(),
        startTimeHour: wizardValues.startTimeHour.trim()
          ? parseInt(wizardValues.startTimeHour, 10)
          : null,
        startTimeMinute: wizardValues.startTimeMinute.trim()
          ? parseInt(wizardValues.startTimeMinute, 10)
          : null,
        startTimePeriod: wizardValues.startTimePeriod || null,
        meetUpPoint: wizardValues.meetUpPoint.trim(),
        meetUpStreetAddress: wizardValues.meetUpStreetAddress.trim() || null,
        meetUpCity: wizardValues.meetUpCity.trim() || null,
        meetUpState: wizardValues.meetUpState.trim() || null,
        meetUpZip: wizardValues.meetUpZip.trim() || null,
        meetUpPlaceId: wizardValues.meetUpPlaceId.trim() || null,
        meetUpLat: wizardValues.meetUpLat.trim() ? parseFloat(wizardValues.meetUpLat) : null,
        meetUpLng: wizardValues.meetUpLng.trim() ? parseFloat(wizardValues.meetUpLng) : null,
        endPoint: wizardValues.endPointSameAsStart ? null : wizardValues.endPoint.trim() || null,
        endStreetAddress: wizardValues.endPointSameAsStart
          ? null
          : wizardValues.endStreetAddress.trim() || null,
        endCity: wizardValues.endPointSameAsStart ? null : wizardValues.endCity.trim() || null,
        endState: wizardValues.endPointSameAsStart ? null : wizardValues.endState.trim() || null,
        routeNeighborhood: trackRouteNulls ? null : wizardValues.routeNeighborhood.trim() || null,
        runType: normalizeRunType(wizardValues.runType) || wizardValues.runType.trim() || null,
        workoutDescription: isTrack
          ? wizardValues.trackWorkoutDescription.trim() || null
          : wizardValues.routeDescription.trim() || null,
        directionsText: trackRouteNulls ? null : wizardValues.directionsText.trim() || null,
        totalMiles: isTrack
          ? null
          : wizardValues.totalMiles.trim()
            ? parseFloat(wizardValues.totalMiles)
            : null,
        pace: isTrack ? null : wizardValues.pace.trim() || null,
        stravaMapUrl: trackRouteNulls ? null : wizardValues.stravaMapUrl.trim() || null,
        mapImageUrl: trackRouteNulls ? null : wizardValues.mapImageUrl.trim() || null,
        routePhotos: trackRouteNulls ? [] : wizardValues.routePhotos.filter((u) => u.trim()),
        description: wizardValues.description.trim() || null,
        postRunActivity: wizardValues.postRunActivity.trim() || null,
        staffNotes: wizardValues.staffNotes.trim() || null,
        stravaEventUrl: wizardValues.stravaEventUrl.trim() || null,
        stravaText: wizardValues.stravaText.trim() || null,
        webUrl: wizardValues.webUrl.trim() || null,
        webText: wizardValues.webText.trim() || null,
        igPostText: wizardValues.igPostText.trim() || null,
        published: false,
      };

      const res = await runmanageApi.post("/api/runs/create", payload);
      const runId = res.data?.run?.id ?? res.data?.cityRunId ?? res.data?.runId;
      if (!runId) {
        throw new Error(res.data?.error || "Run created but no id returned.");
      }
      router.push(runInstanceEditPath(String(runId)));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Failed to create run.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-2">
      <Link
        href={RUN_MANAGE_DASHBOARD_PATH}
        className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Run builder</p>
      <label className="mt-2 block">
        <span className="sr-only">Run title</span>
        <input
          type="text"
          value={wizardValues.title}
          onChange={(e) => setWizardValues((v) => ({ ...v, title: e.target.value }))}
          placeholder="Run title"
          className="w-full max-w-2xl border-0 border-b-2 border-gray-200 bg-transparent pb-1 text-2xl font-bold text-gray-900 placeholder:text-gray-400 focus:border-sky-600 focus:outline-none focus:ring-0"
        />
      </label>
      <p className="mt-2 text-sm text-gray-600">
        Set title, run type, and container attach — then meet-up, miles, pace, and route in the wizard.
      </p>

      <div className="mt-6">
        <RunManageCreateRunScope
          title={wizardValues.title}
          draft={affiliations}
          fork={scopeFork}
          specialEvent={specialEvent}
          onDraftChange={setAffiliations}
          onForkChange={setScopeFork}
          onSpecialEventChange={setSpecialEvent}
        />
      </div>

      {!scopeComplete ? (
        <p className="mt-4 text-sm text-gray-500">
          Complete scope above to open the run builder. Individual runs are athlete-scoped and not
          created here.
        </p>
      ) : null}

      {scopeComplete && containerIdentity ? (
        <div className="mt-4 max-w-3xl">
          <RunContainerIdentityStrip identity={containerIdentity} />
        </div>
      ) : null}

      {scopeComplete ? (
        <div className="mt-6">
          {saving ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating…
            </div>
          ) : (
            <RunInstanceWizard
              values={wizardValues}
              onChange={setWizardValues}
              context={{
                variant: "create-scratch",
                isSeriesInstance: false,
                clubName: affiliations.runClubLabel,
                clubId: affiliations.runClubId,
              }}
              titleInPageHeading
              onSave={() => void handleCreate()}
              saving={saving}
              error={error}
              onErrorChange={setError}
              saveLabel="Create draft run"
              publicSources={null}
              headerSlot={null}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
