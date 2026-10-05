"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import RunPublicDescriptionField from "@/components/runmanage/RunPublicDescriptionField";
import { validateCreateRunScope } from "@/lib/runmanage/create-run-scope";

export default function RunManageCreateRunPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useRunManageAuth();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [affiliations, setAffiliations] = useState<RunAffiliationDraft>(() =>
    emptyAffiliationDraft("CLUB")
  );
  const [wizardValues, setWizardValues] = useState<RunInstanceWizardValues>(() =>
    emptyWizardValues(localCalendarYmd(tomorrow))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imprintedCompanyRaceId, setImprintedCompanyRaceId] = useState<string | null>(null);
  const [imprintedRaceLabel, setImprintedRaceLabel] = useState<string | null>(null);
  const [frontDoorReady, setFrontDoorReady] = useState(false);

  useEffect(() => {
    const clubId = searchParams.get("clubId")?.trim();
    const companyRaceId = searchParams.get("companyRaceId")?.trim();
    const typeParam = searchParams.get("cityRunType")?.trim();

    if (clubId) {
      setAffiliations((prev) => ({
        ...emptyAffiliationDraft("CLUB"),
        runClubId: clubId,
        cityRunType: "CLUB",
      }));
      void (async () => {
        try {
          const res = await runmanageApi.get(`/api/runmanage/run-clubs/${clubId}`);
          const club = res.data?.runClub as { name?: string } | undefined;
          if (club?.name) {
            setAffiliations((prev) => ({
              ...prev,
              runClubLabel: club.name ?? null,
              runClubPick: {
                id: clubId,
                name: club.name ?? "",
              },
            }));
          }
        } catch {
          /* optional hydrate */
        } finally {
          setFrontDoorReady(true);
        }
      })();
      return;
    }

    if (companyRaceId || typeParam === "RACE_SHAKEOUT") {
      setImprintedCompanyRaceId(companyRaceId ?? null);
      setAffiliations(emptyAffiliationDraft("RACE_SHAKEOUT"));
      const raceName = searchParams.get("raceName")?.trim();
      if (raceName) setImprintedRaceLabel(raceName);
    }

    setFrontDoorReady(true);
  }, [searchParams]);

  const handleCreate = async () => {
    const scopeErr = validateCreateRunScope(wizardValues.title, affiliations, { clubBoltMode: null });
    if (scopeErr) {
      setError(scopeErr);
      return;
    }

    setSaving(true);
    setError(null);
    try {
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
        ...affiliationsToPayload(affiliations, session?.athleteId, { specialEventId: null }),
        ...(imprintedCompanyRaceId ? { companyRaceId: imprintedCompanyRaceId } : {}),
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

  const headerSlot = (
    <div className="mb-4 space-y-3 border-b border-gray-100 pb-4">
      <RunPublicDescriptionField
        values={wizardValues}
        onDescriptionChange={(description) => setWizardValues((v) => ({ ...v, description }))}
        cityRunType={affiliations.cityRunType}
        clubName={affiliations.runClubLabel}
        onError={setError}
        compact
      />
    </div>
  );

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
        Pick run type, add title and public description, then fill core details in the wizard.
      </p>

      <div className="mt-4">
        <RunManageCreateRunScope
          draft={affiliations}
          onDraftChange={setAffiliations}
          imprintedCompanyRaceId={imprintedCompanyRaceId}
          imprintedRaceLabel={imprintedRaceLabel}
        />
      </div>

      {frontDoorReady ? (
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
                variant: "edit",
                cityRunType: affiliations.cityRunType,
                isSeriesInstance: false,
                clubName: affiliations.runClubLabel,
                clubId: affiliations.runClubId,
              }}
              titleInPageHeading
              initialWizardStep="core"
              onSave={() => void handleCreate()}
              saving={saving}
              error={error}
              onErrorChange={setError}
              saveLabel="Create draft run"
              publicSources={null}
              headerSlot={headerSlot}
              associateDraft={affiliations}
              onAssociateChange={setAffiliations}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
