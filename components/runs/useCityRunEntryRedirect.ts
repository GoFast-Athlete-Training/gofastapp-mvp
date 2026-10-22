'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import {
  cityRunDoorUrl,
  cityRunJoinPath,
  cityRunTogetherPath,
} from '@/lib/city-run/run-nav-paths';
import { athleteHasCityRunMembership } from '@/lib/city-run/rsvp-attendance';
import type { CityRunDetails } from '@/components/runs/city-run-types';

/**
 * Resolve legacy /gorun and /runrsvp deep links to door vs join vs member hub.
 */
export function useCityRunEntryRedirect(runSegment: string) {
  const [pending, setPending] = useState(true);

  useEffect(() => {
    if (!runSegment) {
      setPending(false);
      return;
    }

    let cancelled = false;

    const finish = (href: string) => {
      if (cancelled) return;
      window.location.replace(href);
    };

    const runAuthPath = async (loggedIn: boolean) => {
      if (!loggedIn) {
        finish(cityRunDoorUrl(runSegment));
        return;
      }

      try {
        const runRes = await api.get(`/runs/${runSegment}`);
        const run = runRes.data?.run as CityRunDetails | undefined;
        if (!run) {
          finish(cityRunDoorUrl(runSegment));
          return;
        }
        const athleteId = LocalStorageAPI.getAthleteId();
        if (athleteHasCityRunMembership(run, athleteId)) {
          finish(cityRunTogetherPath(run.slug?.trim() || run.id));
        } else {
          finish(cityRunJoinPath(run.slug?.trim() || run.id));
        }
      } catch {
        finish(cityRunJoinPath(runSegment));
      } finally {
        if (!cancelled) setPending(false);
      }
    };

    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      void runAuthPath(Boolean(user));
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [runSegment]);

  return pending;
}
