/** Fields Race Manage compares after prod push. */
export const registryMirrorSelect = {
  id: true,
  name: true,
  slug: true,
  raceDate: true,
  companyRaceId: true,
  startTime: true,
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
  startTime: string | null;
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
    startTime: row.startTime,
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
