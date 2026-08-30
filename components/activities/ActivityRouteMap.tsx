'use client';

import { useMemo } from 'react';
import { boundsForCoordinates, decodePolyline, type LatLng } from '@/lib/polyline';

type Props = {
  summaryPolyline: string | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
};

function fallbackPoints(props: Props): LatLng[] {
  const points: LatLng[] = [];
  if (props.startLatitude != null && props.startLongitude != null) {
    points.push({ latitude: props.startLatitude, longitude: props.startLongitude });
  }
  if (
    props.endLatitude != null &&
    props.endLongitude != null &&
    (props.endLatitude !== props.startLatitude || props.endLongitude !== props.startLongitude)
  ) {
    points.push({ latitude: props.endLatitude, longitude: props.endLongitude });
  }
  return points;
}

export default function ActivityRouteMap(props: Props) {
  const { pathD, start, end, viewBox } = useMemo(() => {
    const decoded = props.summaryPolyline ? decodePolyline(props.summaryPolyline) : [];
    const coordinates = decoded.length > 0 ? decoded : fallbackPoints(props);
    if (coordinates.length === 0) {
      return { pathD: '', start: null, end: null, viewBox: '0 0 100 100' };
    }

    const bounds = boundsForCoordinates(coordinates);
    const padLat = Math.max((bounds.maxLat - bounds.minLat) * 0.08, 0.0005);
    const padLng = Math.max((bounds.maxLng - bounds.minLng) * 0.08, 0.0005);
    const minLat = bounds.minLat - padLat;
    const maxLat = bounds.maxLat + padLat;
    const minLng = bounds.minLng - padLng;
    const maxLng = bounds.maxLng + padLng;
    const latSpan = maxLat - minLat || 0.001;
    const lngSpan = maxLng - minLng || 0.001;
    const width = 320;
    const height = 180;

    const project = (point: LatLng) => {
      const x = ((point.longitude - minLng) / lngSpan) * width;
      const y = height - ((point.latitude - minLat) / latSpan) * height;
      return { x, y };
    };

    const projected = coordinates.map(project);
    const pathD = projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const startPoint = projected[0]!;
    const endPoint = projected[projected.length - 1]!;

    return {
      pathD,
      start: startPoint,
      end: endPoint,
      viewBox: `0 0 ${width} ${height}`,
    };
  }, [
    props.summaryPolyline,
    props.startLatitude,
    props.startLongitude,
    props.endLatitude,
    props.endLongitude,
  ]);

  if (!pathD || !start || !end) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <svg viewBox={viewBox} className="h-[180px] w-full" role="img" aria-label="Activity route">
        <rect x="0" y="0" width="100%" height="100%" fill="#f8fafc" />
        {pathD.includes('L') ? (
          <path d={pathD} fill="none" stroke="#0284c7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        <circle cx={start.x} cy={start.y} r="6" fill="#16a34a" />
        {(end.x !== start.x || end.y !== start.y) ? (
          <circle cx={end.x} cy={end.y} r="6" fill="#dc2626" />
        ) : null}
      </svg>
    </div>
  );
}
