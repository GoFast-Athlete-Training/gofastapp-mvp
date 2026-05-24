import assert from "node:assert/strict";
import test from "node:test";
import { buildRaceInfoPackets, raceInfoPhase } from "./race-info-packets";
import type {
  RaceInfoPacketAthleteContext,
  RaceInfoPacketRaceInput,
} from "./race-info-packet-types";

function baseRace(overrides: Partial<RaceInfoPacketRaceInput> = {}): RaceInfoPacketRaceInput {
  const raceDate = new Date();
  raceDate.setDate(raceDate.getDate() + 10);
  return {
    id: "race-1",
    name: "Demo Marathon",
    raceDate,
    distanceLabel: "Marathon",
    ...overrides,
  };
}

function signedUpAthlete(
  overrides: Partial<RaceInfoPacketAthleteContext> = {}
): RaceInfoPacketAthleteContext {
  return {
    isSignedUp: true,
    training: { hasActivePlan: false },
    ...overrides,
  };
}

test("raceInfoPhase buckets days until race", () => {
  assert.equal(raceInfoPhase(-1), "past");
  assert.equal(raceInfoPhase(0), "raceDay");
  assert.equal(raceInfoPhase(3), "raceWeek");
  assert.equal(raceInfoPhase(7), "raceWeek");
  assert.equal(raceInfoPhase(30), "preRace");
});

test("registration packet hidden when athlete is signed up", () => {
  const race = baseRace({ registrationUrl: "https://example.com/register" });
  const signedUp = buildRaceInfoPackets(race, signedUpAthlete());
  assert.ok(!signedUp.packets.some((p) => p.kind === "registration"));

  const unsigned = buildRaceInfoPackets(race, { isSignedUp: false });
  const reg = unsigned.packets.find((p) => p.kind === "registration");
  assert.ok(reg);
  assert.equal(reg!.registrationUrl, "https://example.com/register");
});

test("arrival packet surfaces during race week and emphasizes inside 3 days", () => {
  const raceDate = new Date();
  raceDate.setDate(raceDate.getDate() + 2);
  const race = baseRace({
    raceDate,
    logisticsInfo: "Take the metro to Navy Yard.",
  });

  const result = buildRaceInfoPackets(race, signedUpAthlete());
  const arrival = result.packets.find((p) => p.kind === "arrival");
  assert.ok(arrival);
  assert.equal(arrival!.emphasized, true);
  assert.equal(result.phase, "raceWeek");
});

test("race-week logistics stay hidden before 7 days out", () => {
  const raceDate = new Date();
  raceDate.setDate(raceDate.getDate() + 10);
  const race = baseRace({
    raceDate,
    logisticsInfo: "Parking opens at 6am.",
    packetPickupLocation: "Convention Center",
    packetPickupTime: "Fri 10am–8pm",
  });

  const result = buildRaceInfoPackets(race, signedUpAthlete());
  assert.ok(!result.packets.some((p) => p.kind === "arrival"));
  assert.ok(!result.packets.some((p) => p.kind === "packetPickup"));
  assert.ok(!result.packets.some((p) => p.kind === "raceDayGuide"));
});

test("race day guide is primary during race week for signed-up athletes", () => {
  const raceDate = new Date();
  raceDate.setDate(raceDate.getDate() + 4);
  const race = baseRace({
    raceDate,
    startTime: "7:00 AM",
    packetPickupLocation: "Convention Center",
    packetPickupDate: raceDate,
    packetPickupTime: "Fri 10am–8pm",
    logisticsInfo: "Metro recommended.",
  });

  const result = buildRaceInfoPackets(race, signedUpAthlete());
  assert.equal(result.primaryPacketKind, "raceDayGuide");
  const guide = result.packets.find((p) => p.kind === "raceDayGuide");
  assert.ok(guide);
  assert.ok(guide!.items.some((i) => i.label === "Start time"));
});

test("course packet includes segments with run tips", () => {
  const race = baseRace({
    courseSlug: "demo-marathon",
    courseMapUrl: "https://example.com/map.png",
    courseSegments: [
      { order: 1, name: "Mile 1", mileMarker: "1", runTip: "Stay calm on the downhill." },
    ],
  });

  const result = buildRaceInfoPackets(race, signedUpAthlete());
  const course = result.packets.find((p) => p.kind === "course");
  assert.ok(course);
  assert.equal(course!.courseSlug, "demo-marathon");
  assert.equal(course!.segments?.length, 1);
});

test("training tips packet requires signup and plan or segment tips", () => {
  const race = baseRace({
    courseSegments: [{ order: 1, name: "Mile 20", runTip: "Break up the wall." }],
  });

  const unsigned = buildRaceInfoPackets(race, { isSignedUp: false });
  assert.ok(!unsigned.packets.some((p) => p.kind === "trainingTips"));

  const signed = buildRaceInfoPackets(
    race,
    signedUpAthlete({
      training: { hasActivePlan: true, planName: "Marathon Build", weekNumber: 12, totalWeeks: 16 },
    })
  );
  const tips = signed.packets.find((p) => p.kind === "trainingTips");
  assert.ok(tips);
  assert.ok(tips!.items.some((i) => i.label === "Training plan"));
});

test("training tips are primary before race week even when logistics exist", () => {
  const raceDate = new Date();
  raceDate.setDate(raceDate.getDate() + 10);
  const race = baseRace({
    raceDate,
    logisticsInfo: "Metro recommended.",
    packetPickupLocation: "Convention Center",
    courseSegments: [{ order: 1, name: "Mile 20", runTip: "Fuel before the climb." }],
  });

  const result = buildRaceInfoPackets(
    race,
    signedUpAthlete({
      training: { hasActivePlan: true, planName: "Marathon Build", weekNumber: 10, totalWeeks: 16 },
    })
  );

  assert.equal(result.phase, "preRace");
  assert.equal(result.primaryPacketKind, "trainingTips");
  assert.ok(result.packets.some((p) => p.kind === "trainingTips"));
  assert.ok(!result.packets.some((p) => p.kind === "arrival"));
  assert.ok(!result.packets.some((p) => p.kind === "packetPickup"));
});
