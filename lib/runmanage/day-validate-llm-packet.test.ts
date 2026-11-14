import test from "node:test";
import assert from "node:assert/strict";
import { buildDayValidateLlmPacket, type DayValidateRunRow } from "@/lib/runmanage/day-validate-llm-packet";

const run: DayValidateRunRow = {
  id: "run-1",
  title: "Monday Run",
  dateYmd: "2026-11-09",
  startTimeLabel: "6:30 PM",
  meetUpPoint: "The plaza",
  clubName: "Clarendon Run Club",
  stravaEventUrl: null,
  webUrl: null,
  runClubWebsiteUrl: null,
  runClubStravaUrl: null,
  cityName: "Arlington (arlington)",
};

test("scoped packet omits a city line on each run", () => {
  const packet = buildDayValidateLlmPacket({
    cityLabel: "Arlington (arlington)",
    dayYmd: "2026-11-09",
    runs: [run],
  });
  assert.match(packet, /^City: Arlington \(arlington\)/m);
  assert.equal(packet.includes("City: Arlington (arlington)\nTitle:"), false);
});

test("all-metros packet labels each run with its city", () => {
  const packet = buildDayValidateLlmPacket({
    cityLabel: "All metros",
    dayYmd: "2026-11-09",
    runs: [run],
    scopedToCity: false,
  });
  assert.match(packet, /City: All metros/);
  assert.match(packet, /Run id: run-1\nCity: Arlington \(arlington\)\nTitle: Monday Run/);
});

test("empty all-metros packet does not mention a single city", () => {
  const packet = buildDayValidateLlmPacket({
    cityLabel: "All metros",
    dayYmd: "2026-11-09",
    runs: [],
    scopedToCity: false,
  });
  assert.match(packet, /No runs on file for this date/);
});
