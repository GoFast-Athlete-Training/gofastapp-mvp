import assert from "node:assert/strict";
import { templateKeyToMobileType } from "@/lib/app-notifications/types";
import { renderNotificationTemplate } from "@/lib/app-notifications/templates";

async function run() {
  assert.equal(templateKeyToMobileType("race.prCongrats"), "race_pr_congrats");
  assert.equal(templateKeyToMobileType("race.nextPlanReady"), "race_next_plan_ready");

  const pr = await renderNotificationTemplate("race.prCongrats", {
    raceName: "Marine Corps Marathon",
    finishTime: "3:03:05",
  });
  assert.match(pr.title, /PR/i);
  assert.match(pr.body, /3:03:05/);

  const next = await renderNotificationTemplate("race.nextPlanReady", {
    raceName: "Marine Corps Marathon",
  });
  assert.match(next.title, /next plan/i);
  assert.match(next.body, /Marine Corps Marathon/);

  console.log("post-race-template tests passed");
}

void run();
