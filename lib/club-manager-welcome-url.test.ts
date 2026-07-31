import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildClubManagerWelcomeUrl } from "./run-club-leader-invite-token";
import { getClubManagerAppUrl } from "./club-manager-public-url";

describe("club-manager welcome urls", () => {
  it("builds welcome and hub urls from club manager app base", () => {
    const welcome = buildClubManagerWelcomeUrl();
    assert.match(welcome, /\/welcome-clubmanager$/);
    assert.ok(welcome.startsWith(getClubManagerAppUrl()));
  });
});
