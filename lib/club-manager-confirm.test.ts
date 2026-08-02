import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LocalStorageAPI, CLUB_MANAGER_CONFIRMED_CLUBS_KEY } from './localstorage';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

describe('club manager first-time confirm storage', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage() as Storage;
    (globalThis as { window?: unknown }).window = globalThis;
    localStorage.removeItem(CLUB_MANAGER_CONFIRMED_CLUBS_KEY);
  });

  it('marks a club confirmed once', () => {
    assert.equal(LocalStorageAPI.isClubManagerClubConfirmed('ballston-runaways'), false);
    LocalStorageAPI.markClubManagerClubConfirmed('ballston-runaways');
    assert.equal(LocalStorageAPI.isClubManagerClubConfirmed('ballston-runaways'), true);
    LocalStorageAPI.markClubManagerClubConfirmed('ballston-runaways');
    assert.deepEqual(LocalStorageAPI.getClubManagerConfirmedClubs(), ['ballston-runaways']);
  });
});
