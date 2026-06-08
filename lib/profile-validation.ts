const GENDER_VALUES = ['male', 'female'] as const;
export type ProfileGender = (typeof GENDER_VALUES)[number];

const MIN_PROFILE_AGE = 13;
const MAX_PROFILE_AGE = 100;

export function normalizeProfileGender(value: unknown): ProfileGender | null {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'male' || v === 'female') return v;
  return null;
}

function parseBirthdayIso(iso: string): Date | null {
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function getBirthdayBounds(): { minDate: Date; maxDate: Date } {
  const today = new Date();
  const maxDate = new Date(today.getFullYear() - MIN_PROFILE_AGE, today.getMonth(), today.getDate());
  const minDate = new Date(today.getFullYear() - MAX_PROFILE_AGE, 0, 1);
  return { minDate, maxDate };
}

export function parseProfileBirthday(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const iso = String(value).trim();
  const date = parseBirthdayIso(iso);
  if (!date) return null;
  const { minDate, maxDate } = getBirthdayBounds();
  if (date > maxDate || date < minDate) return null;
  return date;
}
