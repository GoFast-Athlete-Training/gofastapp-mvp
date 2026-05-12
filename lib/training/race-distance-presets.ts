/** Mirrors GoFastCompany `lib/race-distance-infer.ts` COMMON_RACE_DISTANCE_PRESETS for preset matching. */
const MI_TO_M = 1609.344;
const MARATHON_M = 42195;
const HALF_MARATHON_M = 21098;

export const COMMON_RACE_DISTANCE_PRESETS: ReadonlyArray<{
  label: string;
  meters: number;
}> = [
  { label: "1 Mile", meters: Math.round(MI_TO_M) },
  { label: "5K", meters: 5000 },
  { label: "8K", meters: 8000 },
  { label: "10K", meters: 10000 },
  { label: "12K", meters: 12000 },
  { label: "15K", meters: 15000 },
  { label: "10 Mile", meters: Math.round(10 * MI_TO_M) },
  { label: "Half Marathon", meters: HALF_MARATHON_M },
  { label: "30K", meters: 30000 },
  { label: "Marathon", meters: MARATHON_M },
  { label: "50K", meters: 50000 },
  { label: "50 Mile", meters: Math.round(50 * MI_TO_M) },
  { label: "100K", meters: 100000 },
  { label: "100 Mile", meters: Math.round(100 * MI_TO_M) },
];
