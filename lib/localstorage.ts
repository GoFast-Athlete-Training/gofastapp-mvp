'use client';

/** Keys used across join/signup flows — keep in sync with those pages */
export const RUNCREW_JOIN_INTENT_KEY = 'runCrewJoinIntent';
export const RUNCREW_JOIN_INTENT_HANDLE_KEY = 'runCrewJoinIntentHandle';
export const RUNCREW_CREATE_INTENT_KEY = 'runCrewCreateIntent';
/** Canonical Club Manager activation context keys */
export const CLUB_MANAGER_MODE_KEY = 'clubManagerMode';
export const CLUB_MANAGER_ACTIVATION_TOKEN_KEY = 'clubManagerActivationToken';

/** @deprecated Legacy keys — read for compatibility, prefer CLUB_MANAGER_* setters */
export const CLUB_OWNER_MODE_KEY = 'clubOwnerMode';
export const CLUB_OWNER_INVITE_TOKEN_KEY = 'clubOwnerInviteToken';

const ATHLETE_ID_KEY = 'athleteId';
const COACH_ID_KEY = 'coachId';

export const LocalStorageAPI = {
  setCoachId(id: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(COACH_ID_KEY, id);
    }
  },

  getCoachId() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(COACH_ID_KEY);
    }
    return null;
  },

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

  setClubManagerMode(enabled: boolean) {
    if (typeof window !== 'undefined') {
      if (enabled) {
        localStorage.setItem(CLUB_MANAGER_MODE_KEY, '1');
        localStorage.setItem(CLUB_OWNER_MODE_KEY, '1');
      } else {
        localStorage.removeItem(CLUB_MANAGER_MODE_KEY);
        localStorage.removeItem(CLUB_OWNER_MODE_KEY);
      }
    }
  },

  getClubManagerMode() {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem(CLUB_MANAGER_MODE_KEY) === '1' ||
        localStorage.getItem(CLUB_OWNER_MODE_KEY) === '1'
      );
    }
    return false;
  },

  clearClubManagerMode() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CLUB_MANAGER_MODE_KEY);
      localStorage.removeItem(CLUB_OWNER_MODE_KEY);
    }
  },

  setClubManagerActivationToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CLUB_MANAGER_ACTIVATION_TOKEN_KEY, token);
      localStorage.setItem(CLUB_OWNER_INVITE_TOKEN_KEY, token);
    }
  },

  getClubManagerActivationToken() {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem(CLUB_MANAGER_ACTIVATION_TOKEN_KEY) ||
        localStorage.getItem(CLUB_OWNER_INVITE_TOKEN_KEY)
      );
    }
    return null;
  },

  clearClubManagerActivationToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CLUB_MANAGER_ACTIVATION_TOKEN_KEY);
      localStorage.removeItem(CLUB_OWNER_INVITE_TOKEN_KEY);
    }
  },

  /** @deprecated Use setClubManagerMode */
  setClubOwnerMode(enabled: boolean) {
    LocalStorageAPI.setClubManagerMode(enabled);
  },

  /** @deprecated Use getClubManagerMode */
  getClubOwnerMode() {
    return LocalStorageAPI.getClubManagerMode();
  },

  /** @deprecated Use clearClubManagerMode */
  clearClubOwnerMode() {
    LocalStorageAPI.clearClubManagerMode();
  },

  /** @deprecated Use setClubManagerActivationToken */
  setClubOwnerInviteToken(token: string) {
    LocalStorageAPI.setClubManagerActivationToken(token);
  },

  /** @deprecated Use getClubManagerActivationToken */
  getClubOwnerInviteToken() {
    return LocalStorageAPI.getClubManagerActivationToken();
  },

  /** @deprecated Use clearClubManagerActivationToken */
  clearClubOwnerInviteToken() {
    LocalStorageAPI.clearClubManagerActivationToken();
  },

  clearAll() {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  },
};
