/**
 * Extract GPS route metadata from Garmin ACTIVITY_DETAIL samples.
 */

import { parseDetailData } from "./detail-data-parser";

export type ActivityRouteExtract = {
  startLatitude: number | null;
  startLongitude: number | null;
  endLatitude: number | null;
  endLongitude: number | null;
  summaryPolyline: string | null;
};

type LatLng = { lat: number; lng: number };

function encodeSigned(value: number): string {
  let s = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (s >= 0x20) {
    out += String.fromCharCode((0x20 | (s & 0x1f)) + 63);
    s >>= 5;
  }
  out += String.fromCharCode(s + 63);
  return out;
}

/** Google encoded polyline (precision 1e5). */
export function encodePolyline(points: LatLng[]): string {
  if (points.length === 0) return "";
  let lastLat = 0;
  let lastLng = 0;
  let out = "";
  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);
    out += encodeSigned(lat - lastLat);
    out += encodeSigned(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

function downsamplePoints(points: LatLng[], maxPoints: number): LatLng[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out: LatLng[] = [];
  for (let i = 0; i < points.length; i += step) {
    out.push(points[i]!);
  }
  const last = points[points.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

export function extractActivityRouteFromDetail(blob: unknown): ActivityRouteExtract {
  const { samples } = parseDetailData(blob);
  const points: LatLng[] = [];
  for (const sample of samples) {
    if (sample.latitudeInDegree == null || sample.longitudeInDegree == null) continue;
    if (!Number.isFinite(sample.latitudeInDegree) || !Number.isFinite(sample.longitudeInDegree)) {
      continue;
    }
    points.push({
      lat: sample.latitudeInDegree,
      lng: sample.longitudeInDegree,
    });
  }

  if (points.length === 0) {
    return {
      startLatitude: null,
      startLongitude: null,
      endLatitude: null,
      endLongitude: null,
      summaryPolyline: null,
    };
  }

  const sampled = downsamplePoints(points, 500);
  const first = points[0]!;
  const last = points[points.length - 1]!;

  return {
    startLatitude: first.lat,
    startLongitude: first.lng,
    endLatitude: last.lat,
    endLongitude: last.lng,
    summaryPolyline: encodePolyline(sampled),
  };
}
