"use client";

import GooglePlacesAutocomplete from "@/components/runmanage/GooglePlacesAutocomplete";
import { parseGoogleAddress } from "@/lib/utils/parseAddress";
import { formatDayLabel } from "@/lib/runmanage/format-day-label";
import {
  DEFAULT_PACE_OPTION,
  isTrackRun,
  nullRouteFieldsForTrackRun,
  PACE_OPTIONS,
  RUN_TYPE_LABELS,
  RUN_TYPE_VALUES,
} from "@/lib/runTypes";
import type { RunInstanceWizardContext, RunInstanceWizardValues } from "./shared";

type Props = {
  values: RunInstanceWizardValues;
  onChange: (next: RunInstanceWizardValues) => void;
  patch: (partial: Partial<RunInstanceWizardValues>) => void;
  context: RunInstanceWizardContext;
  weekdayMismatch: boolean;
  onErrorChange?: (msg: string | null) => void;
};

export default function RunManageOpenCorePanel({
  values,
  onChange,
  patch,
  context,
  weekdayMismatch,
  onErrorChange,
}: Props) {
  const isSeries = context.isSeriesInstance ?? context.variant === "create-series";
  const dayLabel = context.dayOfWeek ? formatDayLabel(context.dayOfWeek) : "Run";
  const isTrack = isTrackRun(values.runType);

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

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Core details</h3>
        <p className="mt-1 text-xs text-gray-600">
          Date, meet-up, distance, pace, and run type for this run.
        </p>
      </div>
      <div className="space-y-4 px-4 py-4">
        {!isSeries ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">Day of week</label>
            <select
              value={values.dayOfWeek}
              onChange={(e) => patch({ dayOfWeek: e.target.value })}
              className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
          </div>
        ) : null}

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
            {weekdayMismatch ? (
              <p className="mt-1 text-xs text-red-700">Pick a {dayLabel} — this date does not match.</p>
            ) : null}
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

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Meet-up *</label>
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
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.endPointSameAsStart}
              onChange={(e) => patch({ endPointSameAsStart: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-sky-600"
            />
            <span className="text-sm text-gray-900">Finish same as start</span>
          </label>
          {!values.endPointSameAsStart ? (
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
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          ) : null}
        </div>

        {!isTrack ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Distance (miles)</label>
              <input
                type="text"
                value={values.totalMiles}
                onChange={(e) => patch({ totalMiles: e.target.value })}
                placeholder="e.g. 5"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Pace</label>
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
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Post-run</label>
          <input
            type="text"
            value={values.postRunActivity}
            onChange={(e) => patch({ postRunActivity: e.target.value })}
            placeholder="Coffee, bagels, social…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Run type *</label>
          <select
            value={values.runType}
            onChange={(e) => handleRunTypeChange(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {RUN_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {RUN_TYPE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Public description (optional)</label>
          <textarea
            value={values.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Short blurb for this run…"
          />
        </div>
      </div>
    </div>
  );
}
