import { randomBytes } from "node:crypto";

/** Prisma models use string IDs without @default — generate a unique id. */
export function newEntityId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}
