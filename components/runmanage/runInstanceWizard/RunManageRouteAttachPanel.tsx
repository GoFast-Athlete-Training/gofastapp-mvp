"use client";

import { useCallback, useState } from "react";
import { Route } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import RoutesDiscoverPicker from "@/components/runs/RoutesDiscoverPicker";
import type { SavedRouteSnapshot } from "@/lib/city-run/saved-route-snapshot";
import type { RunInstanceWizardValues } from "./shared";

type Props = {
  values: RunInstanceWizardValues;
  patch: (partial: Partial<RunInstanceWizardValues>) => void;
  cityRunId?: string | null;
  citySlug?: string | null;
  onError?: (msg: string | null) => void;
};

function applySnapshotToWizard(
  snap: SavedRouteSnapshot,
  patch: (partial: Partial<RunInstanceWizardValues>) => void
) {
  patch({
    routeId: snap.routeId,
    linkedRouteName: snap.name,
    stravaMapUrl: snap.stravaMapUrl ?? "",
    mapImageUrl: snap.mapImageUrl ?? "",
    routePhotos: snap.routePhotos ?? [],
    routeNeighborhood: snap.routeNeighborhood ?? "",
    routeDescription: snap.routeDescription ?? "",
  });
}

export default function RunManageRouteAttachPanel({
  values,
  patch,
  cityRunId,
  citySlug,
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);
  const linked = Boolean(values.routeId?.trim());

  const handleSelect = useCallback(
    async (snap: SavedRouteSnapshot) => {
      onError?.(null);
      const runId = cityRunId?.trim();
      if (runId) {
        setBusy(true);
        try {
          const res = await runmanageApi.post(`/cityrun/${encodeURIComponent(runId)}/attach-route`, {
            routeId: snap.routeId,
            neighborhoodAuthority: "route",
          });
          if (!res.data?.success) {
            throw new Error(res.data?.error || "Could not attach route");
          }
          applySnapshotToWizard(snap, patch);
        } catch (e: unknown) {
          const err = e as { response?: { data?: { error?: string } }; message?: string };
          onError?.(err.response?.data?.error || err.message || "Could not attach route.");
        } finally {
          setBusy(false);
        }
        return;
      }
      applySnapshotToWizard(snap, patch);
    },
    [cityRunId, onError, patch]
  );

  const handleClear = () => {
    patch({
      routeId: "",
      linkedRouteName: "",
      stravaMapUrl: "",
      mapImageUrl: "",
      routePhotos: [],
      routeNeighborhood: "",
    });
    onError?.(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-2">
          <Route className="h-4 w-4 text-orange-500" />
          Saved route
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Search the route catalog by name, then attach. Map and Strava link come from the saved route.
        </p>
      </div>

      {linked ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50/80 px-4 py-3 space-y-2">
          <p className="text-sm font-semibold text-gray-900">
            Attached: {values.linkedRouteName.trim() || "Saved route"}
          </p>
          {values.mapImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={values.mapImageUrl}
              alt=""
              className="max-w-md rounded-lg border border-orange-100"
            />
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={handleClear}
            className="text-sm font-medium text-orange-900 underline hover:no-underline disabled:opacity-50"
          >
            Replace route
          </button>
        </div>
      ) : (
        <RoutesDiscoverPicker
          deferLoad
          routeSearchScope="catalog"
          citySlug={citySlug}
          selectedRouteId={values.routeId?.trim() || null}
          onSelect={(snap) => void handleSelect(snap)}
          onClear={handleClear}
        />
      )}

      {busy ? <p className="text-sm text-gray-500">Attaching route…</p> : null}
    </div>
  );
}
