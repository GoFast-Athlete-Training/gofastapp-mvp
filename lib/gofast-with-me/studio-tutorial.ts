import { GOFAST_WITH_ME_STUDIO_TUTORIAL_SLUG } from '@/lib/gofast-with-me/program-config';

export type StudioTutorialStep = {
  id: string;
  title: string;
  instruction: string;
  sortOrder: number;
};

export type StudioTutorialPayload = {
  slug: string;
  name: string;
  summary: string | null;
  steps: StudioTutorialStep[];
};

export const STUDIO_TUTORIAL_FALLBACK: StudioTutorialPayload = {
  slug: GOFAST_WITH_ME_STUDIO_TUTORIAL_SLUG,
  name: 'GoFast With Me Studio',
  summary:
    'My Community is your studio. Use the header to see your landing page, preview the member hub, and share your invite link. Runs and Training come first — then build content (story, daily log, tips). Manage announcements, chatter, and members from the left nav.',
  steps: [
    {
      id: 'page',
      title: 'My Story — public landing',
      instruction:
        'Photo, welcome, and about — what strangers see before they follow.',
      sortOrder: 0,
    },
    {
      id: 'workouts-runs',
      title: 'Runs — join-me runs',
      instruction:
        'Pick a plan day and invite followers to a hosted GoRun.',
      sortOrder: 1,
    },
    {
      id: 'workouts-training',
      title: 'Training — publish your plan',
      instruction:
        'Share your active plan so followers can train week-by-week with you.',
      sortOrder: 2,
    },
    {
      id: 'content-routes',
      title: 'Routes — favorite runs',
      instruction:
        'Routes followers browse alongside your hosted runs.',
      sortOrder: 3,
    },
    {
      id: 'community',
      title: 'Daily log — member feed',
      instruction:
        'Post how you feel today — updates spill into the member feed.',
      sortOrder: 4,
    },
    {
      id: 'content',
      title: 'Tips — durable content',
      instruction:
        'Nutrition and training thoughts followers revisit on the tips rail.',
      sortOrder: 5,
    },
  ],
};

export async function fetchStudioTutorial(
  slug = GOFAST_WITH_ME_STUDIO_TUTORIAL_SLUG
): Promise<StudioTutorialPayload | null> {
  try {
    const res = await fetch(`/api/user-tutorial-public/by-slug/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success || !data?.tutorial) return null;
    const t = data.tutorial;
    return {
      slug: t.slug,
      name: t.name,
      summary: t.summary ?? null,
      steps: (t.steps ?? []).map(
        (s: { id: string; title: string; instruction: string; sortOrder: number }) => ({
          id: s.id,
          title: s.title,
          instruction: s.instruction,
          sortOrder: s.sortOrder,
        })
      ),
    };
  } catch {
    return null;
  }
}
