export type ShareCardState = "setup" | "share" | "manage" | "view";

export type ShareCreatorCardModel = {
  id: "profile" | "plan" | "run" | "runcrew";
  title: string;
  description: string;
  state: ShareCardState;
  statusLine: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export type ShareHubProfileStatus = {
  hasHandle: boolean;
  gofastHandle: string | null;
  isGoFastContainer: boolean;
  publicPageUrl: string | null;
  upcomingPublicRuns: number;
  publishedPlans: number;
};

export type ShareHubPlanStatus = {
  hasActivePlan: boolean;
  planId: string | null;
  planName: string | null;
  hasSchedule: boolean;
  isPublished: boolean;
  publicSlug: string | null;
  publicVisibility: "DRAFT" | "PUBLIC" | "UNLISTED" | "ARCHIVED" | null;
  publicDescription: string | null;
  raceName: string | null;
  raceDistanceLabel: string | null;
  goalRaceTime: string | null;
};

export type ShareHubRunStatus = {
  upcomingHostedRuns: number;
};

export type ShareHubRunCrewStatus = {
  membershipCount: number;
  adminCount: number;
};

export type ShareHubStatus = {
  profile: ShareHubProfileStatus;
  plan: ShareHubPlanStatus;
  run: ShareHubRunStatus;
  runcrew: ShareHubRunCrewStatus;
};

export function buildShareCreatorCards(status: ShareHubStatus): ShareCreatorCardModel[] {
  return [
    buildProfileCard(status.profile),
    buildPlanCard(status.plan),
    buildRunCard(status.run),
    buildRunCrewCard(status.runcrew),
  ];
}

function buildProfileCard(profile: ShareHubProfileStatus): ShareCreatorCardModel {
  if (!profile.hasHandle) {
    return {
      id: "profile",
      title: "Public profile",
      description: "Set your handle, then manage GoFastWithMe so others can find and join you.",
      state: "setup",
      statusLine: "Handle not set yet",
      primaryLabel: "Set up profile",
      primaryHref: "/athlete-edit-profile?tab=profile-info",
    };
  }

  const modules: string[] = [];
  if (profile.isGoFastContainer) modules.push("follower community on");
  if (profile.upcomingPublicRuns > 0) {
    modules.push(
      `${profile.upcomingPublicRuns} upcoming public run${profile.upcomingPublicRuns === 1 ? "" : "s"}`
    );
  }
  if (profile.publishedPlans > 0) {
    modules.push(
      `${profile.publishedPlans} published plan${profile.publishedPlans === 1 ? "" : "s"}`
    );
  }
  const statusLine =
    modules.length > 0
      ? `@${profile.gofastHandle} · ${modules.join(" · ")}`
      : `@${profile.gofastHandle} · storefront ready`;

  return {
    id: "profile",
    title: "GoFastWithMe",
    description: "How others find and join you — landing, runs, plans, and community.",
    state: "manage",
    statusLine,
    primaryLabel: "GoFast with Others",
    primaryHref: "/gofast-with-others",
    secondaryLabel: profile.publicPageUrl ? "View public page" : undefined,
    secondaryHref: profile.publicPageUrl ?? undefined,
  };
}

function buildPlanCard(plan: ShareHubPlanStatus): ShareCreatorCardModel {
  if (!plan.hasActivePlan) {
    return {
      id: "plan",
      title: "Training plan",
      description: "Build a generated plan, then share a week-by-week preview link.",
      state: "setup",
      statusLine: "No active plan",
      primaryLabel: "Build a plan",
      primaryHref: "/training-setup",
    };
  }

  if (!plan.hasSchedule) {
    return {
      id: "plan",
      title: "Training plan",
      description: "Finish generating your schedule before sharing it publicly.",
      state: "setup",
      statusLine: plan.planName ? `${plan.planName} · schedule not generated` : "Schedule not generated",
      primaryLabel: "Continue plan setup",
      primaryHref: plan.planId ? `/training-setup/${plan.planId}` : "/training-setup",
    };
  }

  if (!plan.isPublished) {
    return {
      id: "plan",
      title: "Training plan",
      description: "Publish your active plan so others can preview your build.",
      state: "share",
      statusLine: plan.planName ? `${plan.planName} · ready to share` : "Ready to share",
      primaryLabel: "Share this plan",
      primaryHref: "/training/lead",
    };
  }

  return {
    id: "plan",
    title: "Training plan",
    description: "Update visibility or share your public plan preview link.",
    state: "manage",
    statusLine: plan.planName ? `${plan.planName} · live` : "Published",
    primaryLabel: "Manage shared plan",
    primaryHref: "/training/lead",
    secondaryLabel: plan.publicSlug ? "Preview this plan" : undefined,
    secondaryHref: plan.publicSlug ? `/plans/${encodeURIComponent(plan.publicSlug)}` : undefined,
  };
}

function buildRunCard(run: ShareHubRunStatus): ShareCreatorCardModel {
  if (run.upcomingHostedRuns === 0) {
    return {
      id: "run",
      title: "Public run",
      description: "Host a one-off run others can RSVP to from your public page.",
      state: "share",
      statusLine: "No upcoming hosted runs",
      primaryLabel: "Host a public run",
      primaryHref: "/host-a-run",
    };
  }

  return {
    id: "run",
    title: "Public run",
    description: "Your hosted runs appear on your GoFastWithMe page for others to join.",
    state: "manage",
    statusLine: `${run.upcomingHostedRuns} upcoming hosted run${run.upcomingHostedRuns === 1 ? "" : "s"}`,
    primaryLabel: "Host a public run",
    primaryHref: "/host-a-run",
    secondaryLabel: "View on GoRun",
    secondaryHref: "/gorun",
  };
}

function buildRunCrewCard(runcrew: ShareHubRunCrewStatus): ShareCreatorCardModel {
  if (runcrew.membershipCount === 0) {
    return {
      id: "runcrew",
      title: "RunCrew",
      description: "Start a persistent group for accountability, chatter, and crew runs.",
      state: "setup",
      statusLine: "No RunCrews yet",
      primaryLabel: "Start a RunCrew",
      primaryHref: "/runcrew/create",
    };
  }

  const adminLine =
    runcrew.adminCount > 0
      ? `${runcrew.adminCount} crew${runcrew.adminCount === 1 ? "" : "s"} you admin`
      : `${runcrew.membershipCount} crew membership${runcrew.membershipCount === 1 ? "" : "s"}`;

  return {
    id: "runcrew",
    title: "RunCrew",
    description: "Manage the groups you train with and invite new members.",
    state: "manage",
    statusLine: adminLine,
    primaryLabel: "Manage RunCrews",
    primaryHref: "/my-runcrews",
    secondaryLabel: "Start a RunCrew",
    secondaryHref: "/runcrew/create",
  };
}
