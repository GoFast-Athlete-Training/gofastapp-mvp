'use client';

// LocalStorage API - Client-side only
// No hooks, no global state - just clean reads/writes

export const LocalStorageAPI = {
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
    this.setAthlete(athlete);

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

    // Store weekly data if provided
    if (weeklyActivities) {
      localStorage.setItem('weeklyActivities', JSON.stringify(weeklyActivities));
    }
    if (weeklyTotals) {
      localStorage.setItem('weeklyTotals', JSON.stringify(weeklyTotals));
    }

    this.setHydrationTimestamp(Date.now());
    console.log('✅ LocalStorageAPI: Full hydration model stored');
  },
};

