"use client";

import { Route } from "lucide-react";
import RoutesDiscoverPicker from "@/components/runs/RoutesDiscoverPicker";
import CityRunRouteMapUploadField from "@/components/cityruns/CityRunRouteMapUploadField";
import CityRunRoutePhotosField from "@/components/cityruns/CityRunRoutePhotosField";
import type { SavedRouteSnapshot } from "@/lib/city-run/saved-route-snapshot";

type Props = {
  selectedRouteId: string | null;
  onSelectSavedRoute: (snap: SavedRouteSnapshot) => void;
  onClearSavedRoute: () => void;
  stravaMapUrl: string;
  onStravaMapUrlChange: (v: string) => void;
  mapImageUrl: string;
  onMapImageUrlChange: (v: string) => void;
  routeNeighborhood: string;
  onRouteNeighborhoodChange: (v: string) => void;
  routePhotos: string[];
  onRoutePhotosChange: (photos: string[]) => void;
  runPhotos: string[];
  onRunPhotosChange: (photos: string[]) => void;
  onError?: (msg: string | null) => void;
  groupNotes?: string;
  onGroupNotesChange?: (v: string) => void;
};

export default function CityRunInviteRouteFields({
  selectedRouteId,
  onSelectSavedRoute,
  onClearSavedRoute,
  stravaMapUrl,
  onStravaMapUrlChange,
  mapImageUrl,
  onMapImageUrlChange,
  routeNeighborhood,
  onRouteNeighborhoodChange,
  routePhotos,
  onRoutePhotosChange,
  runPhotos,
  onRunPhotosChange,
  onError,
  groupNotes,
  onGroupNotesChange,
}: Props) {
  return (
    <div className="border-t border-gray-100 pt-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
        <Route className="w-4 h-4 text-orange-500" />
        Route (optional)
      </p>
      <RoutesDiscoverPicker
        selectedRouteId={selectedRouteId}
        onSelect={onSelectSavedRoute}
        onClear={onClearSavedRoute}
      />
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Strava route URL <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          type="url"
          placeholder="https://www.strava.com/routes/…"
          value={stravaMapUrl}
          onChange={(e) => onStravaMapUrlChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <CityRunRouteMapUploadField
        mapImageUrl={mapImageUrl}
        onChange={onMapImageUrlChange}
        onError={onError}
      />
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Route note <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          placeholder="Down George Mason and through the woods"
          value={routeNeighborhood}
          onChange={(e) => onRouteNeighborhoodChange(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <CityRunRoutePhotosField
        photos={runPhotos}
        onChange={onRunPhotosChange}
        onError={onError}
        heading="Photos of the run"
        hint="Last time out, the group, or anything that shows what this run is like — up to {max} images."
        addPhotosLabel="Add run photos"
      />
      <CityRunRoutePhotosField
        photos={routePhotos}
        onChange={onRoutePhotosChange}
        onError={onError}
        heading="Route photos"
        hint="The path itself — landmarks, turns, trail — up to {max} images."
        addPhotosLabel="Add route photos"
      />
      {onGroupNotesChange ? (
        <textarea
          placeholder="Notes for your group"
          value={groupNotes ?? ""}
          onChange={(e) => onGroupNotesChange(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      ) : null}
    </div>
  );
}
