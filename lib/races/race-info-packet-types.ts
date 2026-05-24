/** Typed race info packets — time-aware slices of race data for any client surface. */

export type RaceInfoPacketKind =
  | "registration"
  | "course"
  | "trainingTips"
  | "packetPickup"
  | "arrival"
  | "raceDayGuide";

export type RaceInfoPacketPhase = "preRace" | "raceWeek" | "raceDay" | "past";

export type RaceInfoSourceCompleteness = "full" | "partial" | "empty";

export type RaceInfoPacketItem = {
  label: string;
  value: string;
  href?: string | null;
};

export type RaceInfoPacketSegment = {
  order: number;
  name: string;
  mileMarker?: string | null;
  description?: string | null;
  runTip?: string | null;
};

export type RaceInfoPacket = {
  kind: RaceInfoPacketKind;
  title: string;
  summary?: string | null;
  /** Lower number = higher priority when surfacing CTAs. */
  priority: number;
  visible: boolean;
  /** True when this packet should be highlighted for the current timing context. */
  emphasized: boolean;
  /** Show when daysUntilRace <= this value (null = no upper bound). */
  availableFromDaysBeforeRace?: number | null;
  /** Hide when daysUntilRace < this value (null = no lower bound). */
  expiresAfterRace?: boolean;
  items: RaceInfoPacketItem[];
  segments?: RaceInfoPacketSegment[];
  courseMapUrl?: string | null;
  courseSlug?: string | null;
  registrationUrl?: string | null;
  sourceCompleteness: RaceInfoSourceCompleteness;
};

export type RaceInfoTrainingContext = {
  hasActivePlan: boolean;
  planName?: string | null;
  weekNumber?: number | null;
  totalWeeks?: number | null;
  goalTime?: string | null;
};

export type RaceInfoPacketRaceInput = {
  id: string;
  name: string;
  slug?: string | null;
  raceDate: Date;
  startTime?: string | null;
  distanceLabel?: string | null;
  summaryPhrase?: string | null;
  description?: string | null;
  registrationUrl?: string | null;
  registrationOpenNow?: boolean | null;
  registrationOpenDate?: Date | null;
  registrationCloseDate?: Date | null;
  registrationFee?: number | null;
  courseSlug?: string | null;
  courseMapUrl?: string | null;
  packetPickupLocation?: string | null;
  packetPickupDate?: Date | null;
  packetPickupTime?: string | null;
  packetPickupDescription?: string | null;
  spectatorInfo?: string | null;
  logisticsInfo?: string | null;
  gearDropInstructions?: string | null;
  courseSegments?: Array<{
    order: number;
    name: string;
    mileMarker?: string | null;
    description?: string | null;
    runTip?: string | null;
  }>;
};

export type RaceInfoPacketAthleteContext = {
  isSignedUp: boolean;
  training?: RaceInfoTrainingContext | null;
};

export type RaceInfoPacketsResponse = {
  raceRegistryId: string;
  raceDate: string;
  daysUntilRace: number;
  phase: RaceInfoPacketPhase;
  isSignedUp: boolean;
  /** Best packet to open for a contextual CTA (race-week instructions, etc.). */
  primaryPacketKind: RaceInfoPacketKind | null;
  packets: RaceInfoPacket[];
};
