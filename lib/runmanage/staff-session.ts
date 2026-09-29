/** Run Manage staff session (Company `company_staff` row, resolved via prod bootstrap). */
export const STAFF_ID_KEY = "gofast_runmanage_staffId";
export const STAFF_KEY = "gofast_runmanage_staff";
export const FIREBASE_ID_KEY = "gofast_runmanage_firebaseId";

export interface RunManageStaffSession {
  id: string;
  firebaseId: string;
  cockpitRole: string;
  companyId: string;
  name?: string | null;
  email?: string | null;
}

/** Normalize Company find-or-create / staff payload for client storage. */
export function normalizeStaffSession(raw: unknown): RunManageStaffSession | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.firebaseId !== "string") return null;
  if (typeof o.cockpitRole !== "string" || typeof o.companyId !== "string") return null;
  return {
    id: o.id,
    firebaseId: o.firebaseId,
    cockpitRole: o.cockpitRole,
    companyId: o.companyId,
    name: typeof o.name === "string" ? o.name : o.name == null ? null : String(o.name),
    email: typeof o.email === "string" ? o.email : o.email == null ? null : String(o.email),
  };
}

export function readStaffSession(): RunManageStaffSession | null {
  if (typeof window === "undefined") return null;
  const staffId = localStorage.getItem(STAFF_ID_KEY);
  const firebaseId = localStorage.getItem(FIREBASE_ID_KEY);
  const staffRaw = localStorage.getItem(STAFF_KEY);
  if (!staffId || !firebaseId || !staffRaw) return null;
  try {
    const parsed = normalizeStaffSession(JSON.parse(staffRaw));
    if (!parsed || parsed.id !== staffId || parsed.firebaseId !== firebaseId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStaffSession(firebaseUid: string, staff: RunManageStaffSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FIREBASE_ID_KEY, firebaseUid);
  localStorage.setItem(STAFF_ID_KEY, staff.id);
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
}

export function clearStaffSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STAFF_ID_KEY);
  localStorage.removeItem(STAFF_KEY);
  localStorage.removeItem(FIREBASE_ID_KEY);
}
