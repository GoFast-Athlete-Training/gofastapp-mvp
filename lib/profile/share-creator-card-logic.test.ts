import { describe, expect, it } from "vitest";
import {
  buildShareCreatorCards,
  type ShareHubStatus,
} from "./share-creator-card-logic";

const emptyStatus: ShareHubStatus = {
  profile: {
    hasHandle: false,
    gofastHandle: null,
    isGoFastContainer: false,
    publicPageUrl: null,
    upcomingPublicRuns: 0,
    publishedPlans: 0,
  },
  plan: {
    hasActivePlan: false,
    planId: null,
    planName: null,
    hasSchedule: false,
    isPublished: false,
    publicSlug: null,
  },
  run: { upcomingHostedRuns: 0 },
  runcrew: { membershipCount: 0, adminCount: 0 },
};

describe("buildShareCreatorCards", () => {
  it("returns setup CTAs when nothing is configured", () => {
    const cards = buildShareCreatorCards(emptyStatus);
    expect(cards).toHaveLength(4);
    expect(cards.find((c) => c.id === "profile")?.primaryLabel).toBe("Set up profile");
    expect(cards.find((c) => c.id === "plan")?.primaryLabel).toBe("Build a plan");
    expect(cards.find((c) => c.id === "run")?.primaryLabel).toBe("Host a public run");
    expect(cards.find((c) => c.id === "runcrew")?.primaryLabel).toBe("Start a RunCrew");
  });

  it("promotes share when plan has schedule but is not published", () => {
    const cards = buildShareCreatorCards({
      ...emptyStatus,
      profile: {
        ...emptyStatus.profile,
        hasHandle: true,
        gofastHandle: "adam",
        publicPageUrl: "https://runner.example/adam",
      },
      plan: {
        hasActivePlan: true,
        planId: "plan-1",
        planName: "Boston Build",
        hasSchedule: true,
        isPublished: false,
        publicSlug: null,
      },
    });
    const planCard = cards.find((c) => c.id === "plan");
    expect(planCard?.state).toBe("share");
    expect(planCard?.primaryLabel).toBe("Share this plan");
    expect(planCard?.primaryHref).toBe("/training/lead");
  });

  it("offers preview when plan is published", () => {
    const cards = buildShareCreatorCards({
      ...emptyStatus,
      plan: {
        hasActivePlan: true,
        planId: "plan-1",
        planName: "Boston Build",
        hasSchedule: true,
        isPublished: true,
        publicSlug: "boston-build",
      },
    });
    const planCard = cards.find((c) => c.id === "plan");
    expect(planCard?.state).toBe("manage");
    expect(planCard?.secondaryLabel).toBe("Preview this plan");
    expect(planCard?.secondaryHref).toBe("/plans/boston-build");
  });
});
