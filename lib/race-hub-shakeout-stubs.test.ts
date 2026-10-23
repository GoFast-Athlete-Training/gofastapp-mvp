import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRunType } from "@/lib/runTypes";
import { serializeHubShakeout } from "@/lib/race-hub-shakeout-utils";

test("shakeout default runType when omitted is neighborhood (urban)", () => {
  assert.equal(normalizeRunType("urban"), "neighborhood");
  const fallback = normalizeRunType("") || normalizeRunType("urban");
  assert.equal(fallback, "neighborhood");
});

test("serializeHubShakeout includes import stub fields", () => {
  const run = {
    id: "c1",
    title: "Shakeout",
    date: new Date("2026-10-24T12:00:00.000Z"),
    runDay: "2026-10-24",
    meetUpPoint: "Start",
    timezone: "America/New_York",
    startsAt: null,
    meetUpLat: null,
    meetUpLng: null,
    totalMiles: 3,
    pace: null,
    description: null,
    postRunActivity: null,
    startTimeHour: 8,
    startTimeMinute: 30,
    startTimePeriod: "AM",
    checkInTimeHour: null,
    checkInTimeMinute: null,
    checkInTimePeriod: null,
    workflowStatus: "DEVELOP",
    published: false,
    staffGeneratedId: "staff-1",
    cityRunType: "RACE_SHAKEOUT",
    organizerName: null,
    organizerType: null,
    shakeoutClubName: "Northeast Track Club",
    shakeoutSponsorName: "lululemon",
    webUrl: "https://www.eventbrite.com/e/example",
    stravaEventUrl: null,
    instagramPostUrl: null,
    staffNotes: null,
    runBrandId: null,
    runBrandName: null,
    runStoreId: null,
    slug: null,
  } as Parameters<typeof serializeHubShakeout>[0];

  const hub = serializeHubShakeout(run);
  assert.equal(hub.shakeoutClubName, "Northeast Track Club");
  assert.equal(hub.shakeoutSponsorName, "lululemon");
  assert.equal(hub.webUrl, "https://www.eventbrite.com/e/example");
  assert.equal(hub.runDay, "2026-10-24");
});
