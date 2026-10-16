'use client';

import { useEffect, useRef } from 'react';
import api from '@/lib/api';
import {
  applySavedRouteToFormFields,
  snapshotFromRouteCatalogRow,
  type CityRunRouteFieldSetters,
  type RouteCatalogRow,
} from '@/lib/city-run/saved-route-snapshot';

type Args = {
  initialRouteId?: string | null;
  onRouteId: (id: string | null) => void;
  onRoutePhotos: (photos: string[]) => void;
  fieldSetters: CityRunRouteFieldSetters;
};

export function useApplyInitialRoute({
  initialRouteId,
  onRouteId,
  onRoutePhotos,
  fieldSetters,
}: Args): void {
  const appliedRef = useRef<string | null>(null);
  const fieldSettersRef = useRef(fieldSetters);
  fieldSettersRef.current = fieldSetters;

  useEffect(() => {
    const id = initialRouteId?.trim();
    if (!id || appliedRef.current === id) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<{ route?: RouteCatalogRow }>(`/routes/${encodeURIComponent(id)}`);
        const row = res.data?.route;
        if (!row?.id || cancelled) return;
        const snap = snapshotFromRouteCatalogRow(row);
        onRouteId(snap.routeId);
        onRoutePhotos(snap.routePhotos);
        applySavedRouteToFormFields(snap, fieldSettersRef.current);
        appliedRef.current = id;
      } catch {
        /* user can pick manually */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialRouteId, onRouteId, onRoutePhotos]);
}
