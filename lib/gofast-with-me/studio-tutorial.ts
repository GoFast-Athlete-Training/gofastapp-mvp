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
    'You have a public door (My Page) and a member room (My Community). Set up your page first — when people join, manage them in My Community.',
  steps: [
    {
      id: 'door',
      title: 'My Page — the door',
      instruction: 'Your public landing where strangers understand you and choose to GoFast with you.',
      sortOrder: 0,
    },
    {
      id: 'room',
      title: 'My Community — the room',
      instruction: 'Where your members live — followers, updates, and the relationship after they join.',
      sortOrder: 1,
    },
    {
      id: 'workouts',
      title: 'My Workouts',
      instruction: 'Share your active training plan into the room.',
      sortOrder: 2,
    },
    {
      id: 'content',
      title: 'My Content',
      instruction: 'Posts, tips, and routes that fuel both your door and your room.',
      sortOrder: 3,
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
