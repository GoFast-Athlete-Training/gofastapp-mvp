export type RaceSummary = {
  id: string;
  name: string;
  slug: string | null;
  companyRaceId: string | null;
  raceDate: string;
  city: string | null;
  state: string | null;
  distanceMeters: number | null;
  logoUrl: string | null;
  distanceLabel: string | null;
  startTime: string | null;
  courseSlug: string | null;
};

export type MembershipRow = {
  id: string;
  athleteId: string;
  role: string;
  joinedAt: string;
  Athlete: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    photoURL: string | null;
    bio: string | null;
  };
};

export type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  Athlete: { firstName: string | null; lastName: string | null };
};

export type RaceEventRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  address: string | null;
  description: string | null;
  race_event_rsvps?: { status: string }[];
};

export type ShakeoutRunRow = {
  id: string;
  title: string;
  date: string;
  meetUpPoint: string;
  meetUpLat: number | null;
  meetUpLng: number | null;
  pace: string | null;
  totalMiles: number | null;
  description: string | null;
  postRunActivity: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  gorunPath: string;
  runClub: { id: string; name: string; slug: string } | null;
  rsvpCount: number;
  myRsvp: { status: string } | null;
};

export type MyRaceResultRow = {
  id: string;
  officialFinishTime: string | null;
  source: string;
  actualAvgPaceSecPerMile: number | null;
  overallPlace: number | null;
  ageGroupPlace: number | null;
};

export type HubGateResult = {
  canAccessHub: boolean;
  loadedRace: RaceSummary | null;
};

export function distanceSnapToChips(snap: string | null | undefined): string[] {
  if (!snap?.trim()) return [];
  return snap
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatRaceStartTimeLabel(raw: string | null | undefined): string | null {
  return raw?.trim() || null;
}

export function formatDistanceFallback(distanceMeters: number | null | undefined): string {
  const m = distanceMeters;
  if (m == null || !Number.isFinite(m) || m <= 0) return "—";
  const km = m / 1000;
  if (km >= 40) return "Marathon";
  if (km >= 20 && km <= 23) return "Half marathon";
  if (km >= 9.5 && km <= 10.5) return "10K";
  if (km >= 4.5 && km <= 5.5) return "5K";
  return `${km.toFixed(1)} km`;
}

export function formatSecPerMileForHub(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

export function mapRaceRoleToCrewRole(role: string): "member" | "manager" | "admin" {
  if (role === "ADMIN") return "admin";
  return "member";
}

export function memberInitials(a: MembershipRow["Athlete"]): string {
  const f = a.firstName?.trim()?.[0] ?? "";
  const l = a.lastName?.trim()?.[0] ?? "";
  const h = a.gofastHandle?.trim();
  if (f && l) return `${f}${l}`.toUpperCase();
  if (f) return f.toUpperCase();
  if (h) return h.slice(0, 2).toUpperCase();
  return "?";
}
