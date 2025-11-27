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
};

