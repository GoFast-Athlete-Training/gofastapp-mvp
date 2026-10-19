/** Fields Race Manage compares after prod push (parity with sync payload). */
export const registryMirrorSelect = {
  id: true,
  name: true,
  slug: true,
  raceDate: true,
  companyRaceId: true,
  companyRegistrationId: true,
  distanceLabel: true,
  distanceMeters: true,
  registrationUrl: true,
  resultsUrl: true,
  summaryPhrase: true,
  startTime: true,
  startLineLabel: true,
  finishLineLabel: true,
  isLoop: true,
  packetPickupLocation: true,
  packetPickupDate: true,
  packetPickupTime: true,
  packetPickupDescription: true,
  courseMapUrl: true,
  courseSlug: true,
  spectatorInfo: true,
  logisticsInfo: true,
  gearDropInstructions: true,
  course_segments: {
    orderBy: { order: "asc" as const },
    select: { sourceSegmentId: true, order: true },
  },
} as const;

export type RegistryMirrorRow = {
  id: string;
  name: string;
  slug: string | null;
  raceDate: Date;
  companyRaceId: string | null;
  companyRegistrationId: string | null;
  distanceLabel: string | null;
  distanceMeters: number | null;
  registrationUrl: string | null;
  resultsUrl: string | null;
  summaryPhrase: string | null;
  startTime: string | null;
  startLineLabel: string | null;
  finishLineLabel: string | null;
  isLoop: boolean | null;
  packetPickupLocation: string | null;
  packetPickupDate: Date | null;
  packetPickupTime: string | null;
  packetPickupDescription: string | null;
  courseMapUrl: string | null;
  courseSlug: string | null;
  spectatorInfo: string | null;
  logisticsInfo: string | null;
  gearDropInstructions: string | null;
  course_segments: Array<{ sourceSegmentId: string; order: number }>;
};

export function serializeRegistryMirror(row: RegistryMirrorRow) {
  return {
    registryId: row.id,
    companyRaceId: row.companyRaceId,
    companyRegistrationId: row.companyRegistrationId,
    slug: row.slug,
    name: row.name,
    raceDate: row.raceDate?.toISOString() ?? null,
    distanceLabel: row.distanceLabel,
    distanceMeters: row.distanceMeters,
    registrationUrl: row.registrationUrl,
    resultsUrl: row.resultsUrl,
    summaryPhrase: row.summaryPhrase,
    startTime: row.startTime,
    startLineLabel: row.startLineLabel,
    finishLineLabel: row.finishLineLabel,
    isLoop: row.isLoop,
    packetPickupLocation: row.packetPickupLocation,
    packetPickupDate: row.packetPickupDate?.toISOString() ?? null,
    packetPickupTime: row.packetPickupTime,
    packetPickupDescription: row.packetPickupDescription,
    courseMapUrl: row.courseMapUrl,
    courseSlug: row.courseSlug,
    spectatorInfo: row.spectatorInfo,
    logisticsInfo: row.logisticsInfo,
    gearDropInstructions: row.gearDropInstructions,
    segmentCount: row.course_segments.length,
    sourceSegmentIds: row.course_segments.map((s) => s.sourceSegmentId),
  };
}
