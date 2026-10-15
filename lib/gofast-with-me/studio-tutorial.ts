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
    'Build content opens the page where you pick My Story, runner story, routes, reflections, and think pieces. Manage Community opens your follower hub. Plan sharing lives on Training. Host runs from Run; logged work under Activity.',
  steps: [
    {
      id: 'page',
      title: 'My Story — public landing',
      instruction:
        'Photo, welcome, and about — what strangers see before they follow.',
      sortOrder: 0,
    },
    {
      id: 'runnerStory',
      title: 'Runner story',
      instruction: 'Long-form story linked from the short About me on your landing.',
      sortOrder: 1,
    },
    {
      id: 'content-routes',
      title: 'Routes — favorite runs',
      instruction: 'Share routes you love on your public landing.',
      sortOrder: 2,
    },
    {
      id: 'reflections',
      title: 'Training Reflections',
      instruction: 'Write reflections — optionally link a synced activity.',
      sortOrder: 3,
    },
    {
      id: 'content',
      title: 'Think Pieces',
      instruction: 'Essays followers revisit on your public page.',
      sortOrder: 4,
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
