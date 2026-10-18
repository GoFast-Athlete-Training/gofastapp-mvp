import type { RaceHubDoorLink } from "@/components/races/RaceHubDoorNav";
import {
  getRaceGettingToStartUrl,
  getRacePrepCourseUrl,
} from "@/lib/public-race-url";
import { raceHubRunsPath } from "@/lib/race-hub-urls";
import type { ShakeoutRunRow } from "@/components/races/race-hub-types";

function formatShakeoutSummary(shakeouts: ShakeoutRunRow[]): string | null {
  if (shakeouts.length === 0) return "No runs yet";
  const next = shakeouts[0];
  const when = next.date
    ? new Date(next.date).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;
  return [next.title, when].filter(Boolean).join(" · ");
}

export function buildRaceHubDoorLinks(input: {
  raceSlug: string | null;
  courseSlug: string | null;
  shakeouts: ShakeoutRunRow[];
}): RaceHubDoorLink[] {
  const slug = input.raceSlug?.trim();
  if (!slug) return [];

  const links: RaceHubDoorLink[] = [];

  if (input.courseSlug?.trim() || slug) {
    const href = getRacePrepCourseUrl(slug);
    if (href) {
      links.push({
        label: "Course overview",
        href,
        external: true,
      });
    }
  }

  const startHref = getRaceGettingToStartUrl(slug);
  if (startHref) {
    links.push({
      label: "Key info for starting line",
      href: startHref,
      external: true,
    });
  }

  links.push({
    label: "Runs & shakeouts",
    href: raceHubRunsPath(slug),
    detail: formatShakeoutSummary(input.shakeouts),
  });

  return links;
}
