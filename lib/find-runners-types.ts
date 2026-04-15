export type DiscoverRunnerCard = {
  athleteId: string;
  gofastHandle: string;
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
  city: string | null;
  state: string | null;
  fiveKPace: string | null;
  race: {
    id: string;
    name: string;
    distanceLabel: string | null;
    distanceMeters: number | null;
    raceDate: string | null;
  } | null;
  goalTime: string | null;
  nextRun: {
    id: string;
    title: string;
    date: string;
    meetUpPoint: string;
    gofastCity: string;
    gorunPath: string;
  } | null;
};
