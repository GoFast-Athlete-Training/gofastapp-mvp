import assert from "node:assert/strict";
import test from "node:test";
import { resolveSeriesOccurrenceFields } from "./resolve-series-occurrence-fields";

const EASTERN = "Eastern Senior High School";
const GALLERY = "National Gallery of Art Steps";

test("occurrence meetup wins over series default", () => {
  const resolved = resolveSeriesOccurrenceFields({
    seriesMeetUpPoint: EASTERN,
    occurrenceMeetUpPoint: GALLERY,
  });
  assert.equal(resolved.meetUpPoint, GALLERY);
  assert.equal(resolved.meetUpPointSource, "occurrence");
});

test("empty occurrence meetup falls back to series", () => {
  const resolved = resolveSeriesOccurrenceFields({
    seriesMeetUpPoint: EASTERN,
    occurrenceMeetUpPoint: "  ",
  });
  assert.equal(resolved.meetUpPoint, EASTERN);
  assert.equal(resolved.meetUpPointSource, "series");
});

test("occurrence time wins over series time", () => {
  const resolved = resolveSeriesOccurrenceFields({
    seriesStartTimeHour: 18,
    seriesStartTimeMinute: 30,
    seriesStartTimePeriod: "PM",
    occurrenceStartTimeHour: 19,
    occurrenceStartTimeMinute: 0,
    occurrenceStartTimePeriod: "PM",
  });
  assert.equal(resolved.startTimeHour, 19);
  assert.equal(resolved.scheduleSource, "occurrence");
});
