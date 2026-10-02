"use client";

import { useState } from "react";
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

export default function RunManageCreateRunPage() {
  const router = useRouter();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [wizardValues, setWizardValues] = useState<RunInstanceWizardValues>(() =>
    emptyWizardValues(localCalendarYmd(tomorrow))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runClubId, setRunClubId] = useState("");

  const handleCreate = async () => {
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

      if (runClubId.trim()) {
        payload.runClubId = runClubId.trim();
      }

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
      <h1 className="text-2xl font-bold text-gray-900">Create run</h1>
      <p className="mt-1 text-sm text-gray-600">
        One-off or club run — after save, attach a brand partner (e.g. ASICS) on the edit screen.
      </p>

      <label className="mt-4 block max-w-md text-sm">
        <span className="font-medium text-gray-700">Run club id (optional)</span>
        <input
          type="text"
          value={runClubId}
          onChange={(e) => setRunClubId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>

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
              clubName: runClubId.trim() ? "Selected club" : null,
              clubId: runClubId.trim() || null,
            }}
            onSave={() => void handleCreate()}
            saving={saving}
            error={error}
            onErrorChange={setError}
            saveLabel="Create draft run"
            publicSources={null}
          />
        )}
      </div>
    </div>
  );
}
