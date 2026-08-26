/** Prisma models use string IDs without @default — generate a unique id. */
export function newEntityId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}
