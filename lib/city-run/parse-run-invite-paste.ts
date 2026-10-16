import type { CityRunIntakePatch } from '@/lib/city-run/apply-intake-patch';

function parseLongDate(text: string): string | undefined {
  const labeled = text.match(
    /(?:date\s*[:\-]\s*)?(?:\w+day,?\s*)?(\w+\s+\d{1,2},?\s*\d{4})/i
  );
  if (labeled?.[1]) {
    const d = new Date(labeled[1].replace(',', ''));
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const slash = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
  if (slash) {
    const d = new Date(slash[0]);
    if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return undefined;
}

function parseTime(text: string): Pick<CityRunIntakePatch, 'startHour' | 'startMinute' | 'startPeriod'> {
  const labeled = text.match(/(?:time\s*[:\-]\s*)?(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!labeled) return {};
  const period =
    labeled[3]?.toUpperCase().startsWith('P') ? 'PM' : labeled[3] ? 'AM' : undefined;
  return {
    startHour: labeled[1],
    startMinute: labeled[2],
    startPeriod: period ?? 'AM',
  };
}

function parseMeetup(text: string): { meetUpPoint?: string; meetUpCity?: string } {
  const meetupLine = text.match(/(?:📍\s*)?meetup\s*[:\-]\s*([^\n]+)/i);
  if (meetupLine?.[1]) {
    const raw = meetupLine[1].trim();
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const state = parts[parts.length - 1];
      const city = parts[parts.length - 2];
      const point = parts.slice(0, -2).join(', ') || parts[0];
      return {
        meetUpPoint: point || raw,
        meetUpCity: city,
      };
    }
    return { meetUpPoint: raw };
  }
  return {};
}

function parseTitle(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (/^(date|time|meetup|location|📅|⏰|📍)/i.test(line)) continue;
    if (line.length > 3) return line;
  }
  return undefined;
}

function parsePace(text: string): string | undefined {
  if (/all\s+paces|conversational\s+pace|easy\s+pace/i.test(text)) return 'Various';
  return undefined;
}

function parseMiles(text: string): string | undefined {
  const m = text.match(/(\d+\.?\d*)\s*(mile|mi|miles)\b/i);
  return m?.[1];
}

/** Client-safe parse for IG-style run invite paste (no API). */
export function parseRunInvitePasteText(text: string): CityRunIntakePatch {
  const trimmed = text.trim();
  if (!trimmed) return {};

  return {
    title: parseTitle(trimmed),
    date: parseLongDate(trimmed),
    ...parseTime(trimmed),
    ...parseMeetup(trimmed),
    totalMiles: parseMiles(trimmed),
    pace: parsePace(trimmed),
  };
}

export function mergeIntakePatches(...patches: CityRunIntakePatch[]): CityRunIntakePatch {
  const out: CityRunIntakePatch = {};
  for (const p of patches) {
    for (const [k, v] of Object.entries(p) as [keyof CityRunIntakePatch, string | undefined][]) {
      if (v != null && String(v).trim() !== '') {
        (out as Record<string, string>)[k] = String(v).trim();
      }
    }
  }
  return out;
}
