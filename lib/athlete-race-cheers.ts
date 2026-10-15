import { randomUUID } from "crypto";

export type AthleteRaceCheerEntry = {
  id: string;
  name: string;
  message: string;
  createdAt: string;
};

const MAX_NAME = 80;
const MAX_MESSAGE = 500;
const MAX_CHEERS = 200;

export function parseMyCheers(raw: unknown): AthleteRaceCheerEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: AthleteRaceCheerEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const message = typeof o.message === "string" ? o.message.trim() : "";
    const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
    if (!id || !name || !message || !createdAt) continue;
    out.push({ id, name, message, createdAt });
  }
  return out;
}

export function sanitizeCheerInput(name: string, message: string): { name: string; message: string } | null {
  const n = name.trim().slice(0, MAX_NAME);
  const m = message.trim().slice(0, MAX_MESSAGE);
  if (!n || !m) return null;
  return { name: n, message: m };
}

export function appendCheer(
  existing: AthleteRaceCheerEntry[],
  input: { name: string; message: string },
): AthleteRaceCheerEntry[] {
  if (existing.length >= MAX_CHEERS) return existing;
  const entry: AthleteRaceCheerEntry = {
    id: randomUUID(),
    name: input.name,
    message: input.message,
    createdAt: new Date().toISOString(),
  };
  return [...existing, entry];
}

export function removeCheer(existing: AthleteRaceCheerEntry[], cheerId: string): AthleteRaceCheerEntry[] {
  const id = cheerId.trim();
  if (!id) return existing;
  return existing.filter((c) => c.id !== id);
}
