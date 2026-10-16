import { athleteRunnerPublicUrl } from "@/lib/athlete-link-tree/athlete-runner-public-links";

export function athletePublicTipUrl(publicSlug: string, tipId: string): string {
  return athleteRunnerPublicUrl(publicSlug, `thoughts/${encodeURIComponent(tipId)}`);
}

export function athletePublicReflectionUrl(publicSlug: string, postId: string): string {
  return athleteRunnerPublicUrl(publicSlug, `reflections/${encodeURIComponent(postId)}`);
}

export function athletePublicStoryUrl(publicSlug: string): string {
  return athleteRunnerPublicUrl(publicSlug, "story");
}
