'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import type { CityRunCheckin, CityRunDetails, CityRunRsvp } from '@/components/runs/city-run-types';
import {
  mapPublicRunToCityRunDetails,
  type PublicCityRunPayload,
} from '@/lib/city-run/map-public-run-to-details';

export function useCityRunPageLoad(runId: string) {
  const router = useRouter();
  const [run, setRun] = useState<CityRunDetails | null>(null);
  const [checkins, setCheckins] = useState<CityRunCheckin[]>([]);
  const [myCheckin, setMyCheckin] = useState<CityRunCheckin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuestSession, setIsGuestSession] = useState(false);

  const fetchAll = useCallback(
    async (guest: boolean) => {
      try {
        setLoading(true);
        setError(null);

        if (guest) {
          const segment = encodeURIComponent(runId);
          const runRes = await fetch(`/api/runs/public/${segment}`, { cache: 'no-store' });
          const runJson = (await runRes.json()) as {
            success?: boolean;
            run?: PublicCityRunPayload;
            error?: string;
          };
          if (!runRes.ok || !runJson.success || !runJson.run) {
            setError(runRes.status === 404 ? 'Run not found' : runJson.error || 'Run not found');
            setRun(null);
            return;
          }

          let rsvps: CityRunRsvp[] = [];
          try {
            const rsvpRes = await fetch(`/api/runs/${segment}/rsvp`, { cache: 'no-store' });
            const rsvpJson = (await rsvpRes.json()) as {
              success?: boolean;
              rsvps?: CityRunRsvp[];
            };
            if (rsvpRes.ok && rsvpJson.success && Array.isArray(rsvpJson.rsvps)) {
              rsvps = rsvpJson.rsvps;
            }
          } catch (rsvpErr) {
            console.warn('city run page: public RSVP list failed', rsvpErr);
          }

          const loaded = mapPublicRunToCityRunDetails(runJson.run, rsvps);
          setRun(loaded);
          setCheckins([]);
          setMyCheckin(null);
          return;
        }

        const runRes = await api.get(`/runs/${runId}`);
        if (!runRes.data.success || !runRes.data.run) {
          setError('Run not found');
          return;
        }
        const loaded = runRes.data.run as CityRunDetails;
        setRun(loaded);

        try {
          const checkinRes = await api.get(`/runs/${runId}/checkin`);
          if (checkinRes.data.success) {
            const list = (checkinRes.data.checkins || []) as CityRunCheckin[];
            const my = (checkinRes.data.myCheckin ?? null) as CityRunCheckin | null;
            setCheckins(list);
            setMyCheckin(my);
          }
        } catch (checkinErr: unknown) {
          console.warn('city run page: checkin fetch failed', checkinErr);
        }
      } catch (err: unknown) {
        console.error('city run page: run fetch failed', err);
        setError('Failed to load run');
      } finally {
        setLoading(false);
      }
    },
    [runId],
  );

  useEffect(() => {
    if (!runId) return;

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe();
      const guest = !user;
      setIsGuestSession(guest);
      if (user) {
        const athleteId = LocalStorageAPI.getAthleteId();
        if (!athleteId) {
          try {
            const token = await user.getIdToken();
            const res = await api.get('/athlete/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data?.success && res.data?.athleteId) {
              LocalStorageAPI.setAthleteId(res.data.athleteId);
            }
          } catch (e) {
            console.warn('city run page: /athlete/me failed', e);
          }
        }
      }
      void fetchAll(guest);
    });
  }, [runId, fetchAll]);

  const canonicalSlug = run?.slug?.trim() || run?.id;

  return {
    run,
    checkins,
    myCheckin,
    loading,
    error,
    isGuestSession,
    fetchAll,
    canonicalSlug,
    router,
  };
}
