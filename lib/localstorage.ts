'use client';

// LocalStorage API - Client-side only
// No hooks, no global state - just clean reads/writes

export const LocalStorageAPI = {
  // MVP1-compatible methods
  setAthlete(athlete: any) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('athlete', JSON.stringify(athlete));
    }
  },

  getAthlete() {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('athlete');
      return data ? JSON.parse(data) : null;
    }
    return null;
  },

  setAthleteId(id: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('athleteId', id);
    }
  },

  getAthleteId() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('athleteId');
    }
    return null;
  },

  setAthleteProfile(athlete: any) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('athleteProfile', JSON.stringify(athlete));
      // Also set as 'athlete' for compatibility
      localStorage.setItem('athlete', JSON.stringify(athlete));
    }
  },

  getAthleteProfile() {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('athleteProfile');
      return data ? JSON.parse(data) : null;
    }
    return null;
  },

  setCrews(crews: any[]) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('crews', JSON.stringify(crews));
    }
  },

  getCrews() {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('crews');
      return data ? JSON.parse(data) : null;
    }
    return null;
  },

  setHydrationTimestamp(timestamp: number) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hydrationTimestamp', timestamp.toString());
    }
  },

  getHydrationTimestamp() {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('hydrationTimestamp');
      return data ? parseInt(data, 10) : null;
    }
    return null;
  },

  setPrimaryCrew(crew: any) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('primaryCrew', JSON.stringify(crew));
    }
  },

  getPrimaryCrew() {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('primaryCrew');
      return data ? JSON.parse(data) : null;
    }
    return null;
  },

  /**
   * setFullHydrationModel - Store the complete Prisma model from /api/athlete/hydrate
   * This captures the entire athlete object tree including all relations
   */
  setFullHydrationModel(model: { athlete: any; weeklyActivities?: any[]; weeklyTotals?: any }) {
    if (typeof window === 'undefined') return;
    if (!model || !model.athlete) {
      console.warn('⚠️ LocalStorageAPI: No athlete in model');
      return;
    }

    const { athlete, weeklyActivities, weeklyTotals } = model;

    // Store the entire athlete object
    this.setAthleteProfile(athlete);
    this.setAthleteId(athlete.id || athlete.athleteId || '');

    // Store crews if they exist (from runCrewMemberships or runCrews)
    if (athlete.runCrews) {
      this.setCrews(athlete.runCrews);
    } else if (athlete.runCrewMemberships) {
      // Extract crews from memberships
      const crews = athlete.runCrewMemberships.map((m: any) => ({
        ...m.runCrew,
        role: athlete.runCrewManagers?.find((mg: any) => mg.runCrewId === m.runCrewId)?.role || 'member',
        joinedAt: m.joinedAt,
      }));
      this.setCrews(crews);
    }

    // Cache run crews, managers, and admin crews if they exist
    if (athlete.runCrewMemberships) {
      localStorage.setItem('runCrewMemberships', JSON.stringify(athlete.runCrewMemberships));
    }
    if (athlete.runCrewManagers) {
      localStorage.setItem('runCrewManagers', JSON.stringify(athlete.runCrewManagers));
    }
    if (athlete.adminRunCrews) {
      localStorage.setItem('adminRunCrews', JSON.stringify(athlete.adminRunCrews));
    }

    // HYDRATION V2: Use clean crew context from backend
    const MyCrew = athlete.MyCrew || '';
    const MyCrewManagerId = athlete.MyCrewManagerId || '';

    localStorage.setItem('MyCrew', MyCrew);
    localStorage.setItem('MyCrewManagerId', MyCrewManagerId);

    // Legacy keys for backward compatibility
    localStorage.setItem('runCrewId', MyCrew);
    localStorage.setItem('runCrewManagerId', MyCrewManagerId);

    // Store full crew data if MyCrew ID exists and we have runCrewMemberships
    if (MyCrew && athlete.runCrewMemberships) {
      const crewMembership = athlete.runCrewMemberships.find(
        (membership: any) => membership.runCrew?.id === MyCrew
      );
      if (crewMembership?.runCrew) {
        this.setRunCrewData(crewMembership.runCrew);
        console.log('✅ LocalStorageAPI: Stored full crew data for:', crewMembership.runCrew.name);
      }
    }

    // Store weekly data if provided
    if (weeklyActivities) {
      localStorage.setItem('weeklyActivities', JSON.stringify(weeklyActivities));
    }
    if (weeklyTotals) {
      localStorage.setItem('weeklyTotals', JSON.stringify(weeklyTotals));
    }

    // Version marker
    localStorage.setItem('hydrationVersion', 'hydration-v2');

    this.setHydrationTimestamp(Date.now());
    console.log('✅ LocalStorageAPI: Full hydration model stored');
  },

  // HYDRATION V2: Getters for new keys
  getMyCrew() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('MyCrew');
    }
    return null;
  },

  getMyCrewManagerId() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('MyCrewManagerId');
    }
    return null;
  },

  // Legacy keys for backward compatibility
  getRunCrewId() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('runCrewId');
    }
    return null;
  },

  getRunCrewManagerId() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('runCrewManagerId');
    }
    return null;
  },

  // Crew data methods
  setRunCrewData(crew: any) {
    if (typeof window !== 'undefined') {
      if (crew) {
        localStorage.setItem('runCrewData', JSON.stringify(crew));
      } else {
        localStorage.removeItem('runCrewData');
      }
    }
  },

  getRunCrewData() {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('runCrewData');
      return data ? JSON.parse(data) : null;
    }
    return null;
  },

  clearRunCrewData() {
    if (typeof window !== 'undefined') {
      // Clear all crew-related keys
      localStorage.removeItem('runCrewData');
      localStorage.removeItem('runCrewId');
      localStorage.removeItem('MyCrew');
      localStorage.removeItem('runCrewManagerId');
      localStorage.removeItem('MyCrewManagerId');
      localStorage.removeItem('runCrewMemberships');
      localStorage.removeItem('runCrewManagers');
      localStorage.removeItem('adminRunCrews');

      // Also clear any crew-specific hydration caches
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('crew_') && key.includes('_hydration')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      console.log('✅ LocalStorageAPI: Cleared all crew data and related caches');
    }
  },

  /**
   * getFullHydrationModel - Retrieve the complete hydration model
   */
  getFullHydrationModel() {
    if (typeof window === 'undefined') {
      return {
        athlete: null,
        weeklyActivities: [],
        weeklyTotals: null,
        runCrewMemberships: [],
        runCrewManagers: [],
        adminRunCrews: [],
      };
    }

    try {
      const athlete = JSON.parse(localStorage.getItem('athleteProfile') || 'null');
      const weeklyActivities = JSON.parse(localStorage.getItem('weeklyActivities') || '[]');
      const weeklyTotals = JSON.parse(localStorage.getItem('weeklyTotals') || 'null');
      const runCrewMemberships = JSON.parse(localStorage.getItem('runCrewMemberships') || '[]');
      const runCrewManagers = JSON.parse(localStorage.getItem('runCrewManagers') || '[]');
      const adminRunCrews = JSON.parse(localStorage.getItem('adminRunCrews') || '[]');

      return {
        athlete,
        weeklyActivities,
        weeklyTotals,
        runCrewMemberships,
        runCrewManagers,
        adminRunCrews,
      };
    } catch (error) {
      console.error('❌ LocalStorageAPI: Failed to parse hydration model', error);
      return {
        athlete: null,
        weeklyActivities: [],
        weeklyTotals: null,
        runCrewMemberships: [],
        runCrewManagers: [],
        adminRunCrews: [],
      };
    }
  },

  clearAll() {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  },
};

