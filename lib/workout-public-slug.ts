import { prisma } from "@/lib/prisma";

function handlePrefix(gofastHandle: string | null | undefined): string {
  const h = (gofastHandle || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]/g, "");
  if (h.length > 0) return h.slice(0, 32);
  return "run";
}

function sixDigits(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Assign a unique workouts.slug for public /mytrainingruns/[slug] URLs.
 * Format: [handlePrefix][6digits], e.g. acole842719
 */
export async function assignUniqueWorkoutShareSlug(params: {
  workoutId: string;
  gofastHandle: string | null | undefined;
}): Promise<string> {
  const prefix = handlePrefix(params.gofastHandle);
  for (let attempt = 0; attempt < 80; attempt++) {
    const slug = `${prefix}${sixDigits()}`;
    const clash = await prisma.workouts.findFirst({
      where: {
        slug,
        NOT: { id: params.workoutId },
      },
      select: { id: true },
    });
    if (!clash) {
      await prisma.workouts.update({
        where: { id: params.workoutId },
        data: { slug },
      });
      return slug;
    }
  }
  const fallback = `run${Date.now().toString(36)}${sixDigits()}`;
  await prisma.workouts.update({
    where: { id: params.workoutId },
    data: { slug: fallback },
  });
  return fallback;
}
