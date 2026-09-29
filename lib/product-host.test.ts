import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLUB_MANAGER_FRONT_DOOR,
  isClubManageHostname,
  isCoachHostname,
  isLeaderHostname,
  isRunManageHostname,
  RUN_MANAGER_FRONT_DOOR,
  resolveRootEntryPath,
  resolveRootHostIntent,
} from './product-host';

describe('product-host', () => {
  it('detects product subdomains', () => {
    assert.equal(isClubManageHostname('clubmanage.gofastcrushgoals.com'), true);
    assert.equal(isClubManageHostname('CLUBMANAGE.gofastcrushgoals.com'), true);
    assert.equal(isClubManageHostname('gofastcrushgoals.com'), false);
    assert.equal(isCoachHostname('coach.gofastcrushgoals.com'), true);
    assert.equal(isLeaderHostname('leader.gofastcrushgoals.com'), true);
    assert.equal(isRunManageHostname('runmanage.gofastcrushgoals.com'), true);
  });

  it('resolves clubmanage ahead of default athlete intent', () => {
    assert.equal(resolveRootHostIntent('clubmanage.gofastcrushgoals.com'), 'club-manager');
    assert.equal(resolveRootHostIntent('app.gofastcrushgoals.com'), 'default');
  });

  it('always sends clubmanage root to the club-manager front door', () => {
    assert.equal(CLUB_MANAGER_FRONT_DOOR, '/welcome-clubmanager');
    assert.equal(
      resolveRootEntryPath({
        hostname: 'clubmanage.gofastcrushgoals.com',
        isAuthenticated: false,
      }),
      '/welcome-clubmanager'
    );
    assert.equal(
      resolveRootEntryPath({
        hostname: 'clubmanage.gofastcrushgoals.com',
        isAuthenticated: true,
      }),
      '/welcome-clubmanager'
    );
  });

  it('sends runmanage root to sign-in or runs queue', () => {
    assert.equal(RUN_MANAGER_FRONT_DOOR, '/runmanage');
    assert.equal(
      resolveRootEntryPath({
        hostname: 'runmanage.gofastcrushgoals.com',
        isAuthenticated: false,
      }),
      '/runmanage/signin'
    );
    assert.equal(
      resolveRootEntryPath({
        hostname: 'runmanage.gofastcrushgoals.com',
        isAuthenticated: true,
      }),
      '/runmanage/runs'
    );
  });

  it('keeps athlete root on explainer / welcome', () => {
    assert.equal(
      resolveRootEntryPath({
        hostname: 'gofastcrushgoals.com',
        isAuthenticated: false,
      }),
      '/explainer'
    );
    assert.equal(
      resolveRootEntryPath({
        hostname: 'gofastcrushgoals.com',
        isAuthenticated: true,
      }),
      '/welcome'
    );
  });

  it('keeps coach and legacy leader host routing', () => {
    assert.equal(
      resolveRootEntryPath({
        hostname: 'coach.gofastcrushgoals.com',
        isAuthenticated: false,
      }),
      '/coach-signup'
    );
    assert.equal(
      resolveRootEntryPath({
        hostname: 'leader.gofastcrushgoals.com',
        isAuthenticated: false,
      }),
      '/signup?intent=club-leader'
    );
  });
});
