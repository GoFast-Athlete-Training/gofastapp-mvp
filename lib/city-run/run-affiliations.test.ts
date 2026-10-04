import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveCityRunContainer,
  resolveCityRunPartners,
  serializeCityRunAffiliations,
  validateCityRunAffiliationShape,
} from "@/lib/city-run/run-affiliations";
import { resolveCityRunType } from "@/lib/city-run-type";

test("race outranks club and store when no type is stored", () => {
  const refs = {
    raceRegistryId: "race-1",
    runClubId: "club-1",
    runStoreId: "store-1",
    runBrandId: "brand-1",
  };
  assert.deepEqual(resolveCityRunContainer(refs), { kind: "RACE", refId: "race-1" });
  assert.equal(resolveCityRunType(refs), "RACE_SHAKEOUT");
});

test("company shakeout sync claims the race container before the registry is linked", () => {
  const container = resolveCityRunContainer({ shakeoutDedupeKey: "mcm-2026-shakeout-1" });
  assert.deepEqual(container, { kind: "RACE", refId: null });
  assert.equal(resolveCityRunType({ shakeoutDedupeKey: "mcm-2026-shakeout-1" }), "RACE_SHAKEOUT");
});

test("stored cityRunType names the container even when a race tag is also present", () => {
  const refs = { raceRegistryId: "race-1", runClubId: "club-1" };
  assert.deepEqual(resolveCityRunContainer(refs, "CLUB"), { kind: "RUN_CLUB", refId: "club-1" });
});

test("club and store are partners once a race owns the run", () => {
  const partners = resolveCityRunPartners({
    raceRegistryId: "race-1",
    runClubId: "club-1",
    runStoreId: "store-1",
    runBrandId: "brand-1",
  });
  assert.deepEqual(
    partners.map((p) => [p.kind, p.refId, p.slot]),
    [
      ["BRAND", "brand-1", "lead"],
      ["STORE", "store-1", "lead"],
      ["CLUB", "club-1", "lead"],
    ]
  );
});

test("the container is never also listed as a partner", () => {
  const partners = resolveCityRunPartners({ runClubId: "club-1", runBrandId: "brand-1" });
  assert.deepEqual(
    partners.map((p) => p.kind),
    ["BRAND"]
  );
});

test("a brand is a partner even when it is the only affiliation", () => {
  const refs = { runBrandId: "brand-1" };
  assert.equal(resolveCityRunContainer(refs).kind, "NONE");
  assert.deepEqual(
    resolveCityRunPartners(refs).map((p) => [p.kind, p.slot]),
    [["BRAND", "lead"]]
  );
});

test("partnerExtras add partners and never duplicate a lead slot", () => {
  const partners = resolveCityRunPartners({
    runClubId: "club-1",
    runBrandId: "brand-1",
    partnerExtras: [
      { kind: "CLUB", refId: "club-1", nameSnapshot: "Same club" },
      { kind: "CLUB", refId: "club-2", nameSnapshot: "Co-host club" },
      { kind: "BRAND", refId: "brand-1", nameSnapshot: "Same brand" },
    ],
  });
  assert.deepEqual(
    partners.map((p) => [p.kind, p.refId, p.slot]),
    [
      ["BRAND", "brand-1", "lead"],
      ["CLUB", "club-2", "extra"],
    ]
  );
});

test("malformed partnerExtras are dropped rather than failing the read", () => {
  const partners = resolveCityRunPartners({
    partnerExtras: { kind: "CLUB", refId: "club-1", nameSnapshot: "Not an array" },
  });
  assert.deepEqual(partners, []);
});

test("serialize hydrates the race container and keeps the brand as a partner", () => {
  const affiliations = serializeCityRunAffiliations({
    cityRunType: "RACE_SHAKEOUT",
    raceRegistryId: "race-1",
    runBrandId: "brand-1",
    race_registry: {
      id: "race-1",
      name: "Marine Corps Marathon",
      slug: "marine-corps-marathon",
      city: "Arlington",
      state: "VA",
      logoUrl: null,
      raceDate: new Date("2026-10-25T00:00:00.000Z"),
      officialWebsiteUrl: "https://marinemarathon.com",
    },
    runBrand: { id: "brand-1", name: "Tracksmith", logoUrl: "https://cdn/ts.png" },
  });

  assert.equal(affiliations.cityRunType, "RACE_SHAKEOUT");
  assert.equal(affiliations.container?.kind, "RACE");
  assert.equal(affiliations.container?.name, "Marine Corps Marathon");
  assert.equal(affiliations.container?.subtitle, "Arlington, VA");
  assert.equal(affiliations.container?.href, "/race-hub/race-1");
  assert.deepEqual(
    affiliations.partners.map((p) => [p.kind, p.name]),
    [["BRAND", "Tracksmith"]]
  );
});

test("serialize falls back to extras snapshots when nothing is joined", () => {
  const affiliations = serializeCityRunAffiliations({
    partnerExtras: [
      { kind: "CLUB", refId: "club-9", nameSnapshot: "Co-host club", logoUrlSnapshot: "https://cdn/c.png" },
    ],
  });
  assert.equal(affiliations.cityRunType, "OTHER");
  assert.equal(affiliations.container, null);
  assert.deepEqual(affiliations.partners, [
    {
      kind: "CLUB",
      slot: "extra",
      label: "Club",
      id: "club-9",
      name: "Co-host club",
      subtitle: null,
      logoUrl: "https://cdn/c.png",
      websiteUrl: null,
      href: null,
    },
  ]);
});

test("serialize returns ids without names when relations were not selected", () => {
  const affiliations = serializeCityRunAffiliations({
    cityRunType: "CLUB",
    runClubId: "club-1",
  });
  assert.equal(affiliations.container?.id, "club-1");
  assert.equal(affiliations.container?.name, null);
  assert.equal(affiliations.container?.href, null);
});

test("an explicit type without its container id is rejected", () => {
  assert.equal(
    validateCityRunAffiliationShape({ runClubId: "club-1" }, "SPECIAL"),
    "specialEventId is required for SPECIAL runs"
  );
  assert.equal(
    validateCityRunAffiliationShape({ raceRegistryId: "race-1" }, "RACE_SHAKEOUT"),
    null
  );
  assert.equal(validateCityRunAffiliationShape({ runBrandId: "brand-1" }, "OTHER"), null);
  assert.equal(validateCityRunAffiliationShape({}, undefined), null);
  assert.match(
    validateCityRunAffiliationShape({}, "BRAND") ?? "",
    /Unknown cityRunType "BRAND"/
  );
});
