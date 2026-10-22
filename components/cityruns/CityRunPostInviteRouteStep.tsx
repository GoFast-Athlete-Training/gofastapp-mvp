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
  suggestedRouteId?: string | null;
  onSkip: () => void;
  /** Edit run invite — no skip, different heading. */
  variant?: "postCreate" | "edit";
  onAttached?: () => void;
};

type StepMode = "choose" | "attach" | "create";

export default function CityRunPostInviteRouteStep({
  cityRunId,
  suggestedRouteId = null,
  onSkip,
  variant = "postCreate",
  onAttached,
}: Props) {
  const [mode, setMode] = useState<StepMode>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedName, setAttachedName] = useState<string | null>(null);
  const [pickerRouteId, setPickerRouteId] = useState<string | null>(suggestedRouteId);

  const attachRoute = useCallback(
    async (routeId: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.post<{
          success?: boolean;
          routeName?: string;
          error?: string;
        }>(`/cityrun/${encodeURIComponent(cityRunId)}/attach-route`, {
          routeId,
          neighborhoodAuthority: "route",
        });
        if (!res.data?.success) {
          throw new Error(res.data?.error || "Could not attach route");
        }
        const name = res.data.routeName || "Route";
        if (variant === "edit") {
          setAttachedName(null);
          setMode("choose");
          onAttached?.();
        } else {
          setAttachedName(name);
          setMode("choose");
          onAttached?.();
        }
      } catch (e: unknown) {
        const err = e as {
          response?: { data?: { error?: string } };
          message?: string;
        };
        setError(err.response?.data?.error || err.message || "Could not attach route.");
      } finally {
        setBusy(false);
      }
    },
    [cityRunId, onAttached, variant]
  );

  const handleSelectSaved = (snap: SavedRouteSnapshot) => {
    setPickerRouteId(snap.routeId);
    void attachRoute(snap.routeId);
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
          {variant === "edit" ? "Route" : "Step 2 — Route (optional)"}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {variant === "edit"
            ? "Attach a saved route so runners see the map and path on your invite."
            : "Your invite is saved. A route is a named saved path — attach one you already built or create one now."}
        </p>
      </div>

      {mode === "choose" ? (
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
          {variant === "postCreate" ? (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Skip for now
            </button>
          ) : null}
        </div>
      ) : null}

      {mode === "attach" ? (
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
              onClick={() => void attachRoute(suggestedRouteId)}
              className="text-sm font-semibold text-orange-700 hover:underline disabled:opacity-50"
            >
              Attach the route you picked earlier
            </button>
          ) : null}
        </div>
      ) : null}

      {mode === "create" ? (
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
            className="border-0 shadow-none p-0"
            onSaved={(routeId) => void attachRoute(routeId)}
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
