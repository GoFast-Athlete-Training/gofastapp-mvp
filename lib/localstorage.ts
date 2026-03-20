'use client';

/** Keys used across join/signup flows — keep in sync with those pages */
export const RUNCREW_JOIN_INTENT_KEY = 'runCrewJoinIntent';
export const RUNCREW_JOIN_INTENT_HANDLE_KEY = 'runCrewJoinIntentHandle';
export const RUNCREW_CREATE_INTENT_KEY = 'runCrewCreateIntent';

const ATHLETE_ID_KEY = 'athleteId';

export const LocalStorageAPI = {
  setAthleteId(id: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ATHLETE_ID_KEY, id);
    }
  },

  getAthleteId() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ATHLETE_ID_KEY);
    }
    return null;
  },

  setRunCrewJoinIntent(crewId: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(RUNCREW_JOIN_INTENT_KEY, crewId);
    }
  },

  getRunCrewJoinIntent() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(RUNCREW_JOIN_INTENT_KEY);
    }
    return null;
  },

  removeRunCrewJoinIntent() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(RUNCREW_JOIN_INTENT_KEY);
      localStorage.removeItem(RUNCREW_JOIN_INTENT_HANDLE_KEY);
    }
  },

  setRunCrewJoinIntentHandle(handle: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(RUNCREW_JOIN_INTENT_HANDLE_KEY, handle);
    }
  },

  getRunCrewJoinIntentHandle() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(RUNCREW_JOIN_INTENT_HANDLE_KEY);
    }
    return null;
  },

  setRunCrewCreateIntent(value: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(RUNCREW_CREATE_INTENT_KEY, value);
    }
  },

  getRunCrewCreateIntent() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(RUNCREW_CREATE_INTENT_KEY);
    }
    return null;
  },

  removeRunCrewCreateIntent() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(RUNCREW_CREATE_INTENT_KEY);
    }
  },

  clearAll() {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  },
};
