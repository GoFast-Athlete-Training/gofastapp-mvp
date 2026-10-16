"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Route } from "lucide-react";
import api from "@/lib/api";
import BuildRouteForm from "@/components/runs/BuildRouteForm";
import RoutesDiscoverPicker from "@/components/runs/RoutesDiscoverPicker";
import type { SavedRouteSnapshot } from "@/lib/city-run/saved-route-snapshot";

type Props = {
  cityRunId: string;
  /** From meetup create — authoritative for this invite unless attach picks route. */
  cityRunRouteNeighborhood?: string | null;
  suggestedRouteId?: string | null;
  onSkip: () => void;
};

type StepMode = "choose" | "attach" | "create";

type NeighborhoodConflict = {
  routeId: string;
  cityRunNeighborhood: string;
  routeNeighborhood: string;
};

export default function CityRunPostInviteRouteStep({
  cityRunId,
  cityRunRouteNeighborhood = null,
  suggestedRouteId = null,
  onSkip,
}: Props) {
  const [mode, setMode] = useState<StepMode>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedName, setAttachedName] = useState<string | null>(null);
  const [pickerRouteId, setPickerRouteId] = useState<string | null>(suggestedRouteId);
  const [conflict, setConflict] = useState<NeighborhoodConflict | null>(null);

  const attachRoute = useCallback(
    async (
      routeId: string,
      neighborhoodAuthority: "auto" | "cityRun" | "route" = "auto"
    ) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.post<{
          success?: boolean;
          routeName?: string;
          error?: string;
          conflict?: boolean;
          cityRunNeighborhood?: string;
          routeNeighborhood?: string;
        }>(`/cityrun/${encodeURIComponent(cityRunId)}/attach-route`, {
          routeId,
          neighborhoodAuthority,
        });
        if (res.status === 409 || res.data?.conflict) {
          setConflict({
            routeId,
            cityRunNeighborhood:
              res.data?.cityRunNeighborhood || cityRunRouteNeighborhood?.trim() || "—",
            routeNeighborhood: res.data?.routeNeighborhood || "—",
          });
          return;
        }
        if (!res.data?.success) {
          throw new Error(res.data?.error || "Could not attach route");
        }
        setConflict(null);
        setAttachedName(res.data.routeName || "Route");
        setMode("choose");
      } catch (e: unknown) {
        const err = e as {
          response?: {
            status?: number;
            data?: {
              error?: string;
              conflict?: boolean;
              cityRunNeighborhood?: string;
              routeNeighborhood?: string;
            };
          };
          message?: string;
        };
        if (err.response?.status === 409 || err.response?.data?.conflict) {
          setConflict({
            routeId,
            cityRunNeighborhood:
              err.response.data?.cityRunNeighborhood ||
              cityRunRouteNeighborhood?.trim() ||
              "—",
            routeNeighborhood: err.response.data?.routeNeighborhood || "—",
          });
          return;
        }
        setError(err.response?.data?.error || err.message || "Could not attach route.");
      } finally {
        setBusy(false);
      }
    },
    [cityRunId, cityRunRouteNeighborhood]
  );

  const handleSelectSaved = (snap: SavedRouteSnapshot) => {
    setPickerRouteId(snap.routeId);
    void attachRoute(snap.routeId, "auto");
  };

  if (attachedName) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Attached route: <span className="font-semibold">{attachedName}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          <Route className="h-4 w-4 text-orange-500" />
          Step 2 — Route (optional)
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Your invite is saved. A route is a named saved path — attach one you already built or create
          one now.
        </p>
        {cityRunRouteNeighborhood?.trim() ? (
          <p className="text-xs text-gray-600 mt-2">
            Route neighborhood on this invite:{" "}
            <span className="font-medium text-gray-900">{cityRunRouteNeighborhood.trim()}</span>
          </p>
        ) : null}
      </div>

      {conflict ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-950">Neighborhood mismatch</p>
          <p className="text-sm text-amber-900">
            This run and the saved route name different areas. Which one should we keep?
          </p>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <div className="rounded-md bg-white/80 border border-amber-100 px-3 py-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">This run</p>
              <p className="font-medium text-gray-900">{conflict.cityRunNeighborhood}</p>
            </div>
            <div className="rounded-md bg-white/80 border border-amber-100 px-3 py-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Saved route</p>
              <p className="font-medium text-gray-900">{conflict.routeNeighborhood}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void attachRoute(conflict.routeId, "cityRun")}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              Use this run
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void attachRoute(conflict.routeId, "route")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              Use saved route
            </button>
            <button
              type="button"
              onClick={() => setConflict(null)}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {mode === "choose" && !conflict ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("attach")}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Attach saved route
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Create a route
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Skip for now
          </button>
        </div>
      ) : null}

      {mode === "attach" && !conflict ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Back
          </button>
          <RoutesDiscoverPicker
            deferLoad
            selectedRouteId={pickerRouteId}
            onSelect={handleSelectSaved}
            onClear={() => setPickerRouteId(null)}
          />
          {suggestedRouteId && !pickerRouteId ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void attachRoute(suggestedRouteId, "auto")}
              className="text-sm font-semibold text-orange-700 hover:underline disabled:opacity-50"
            >
              Attach the route you picked earlier
            </button>
          ) : null}
        </div>
      ) : null}

      {mode === "create" && !conflict ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Back
          </button>
          <BuildRouteForm
            embedded
            defaultRouteNeighborhood={cityRunRouteNeighborhood}
            className="border-0 shadow-none p-0"
            onSaved={(routeId) => void attachRoute(routeId, "auto")}
          />
          <p className="text-xs text-gray-500">
            Saving the route attaches it to this invite automatically.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {busy ? <p className="text-sm text-gray-500">Attaching route…</p> : null}

      <p className="text-xs text-gray-500">
        Manage routes anytime from{" "}
        <Link href="/build-a-run/discover" className="font-semibold text-orange-700 hover:underline">
          Discover routes
        </Link>
        .
      </p>
    </div>
  );
}
