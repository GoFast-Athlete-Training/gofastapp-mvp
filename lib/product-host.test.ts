import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isClubManageHostname,
  isCoachHostname,
  isLeaderHostname,
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
  });

  it('resolves clubmanage ahead of default athlete intent', () => {
    assert.equal(resolveRootHostIntent('clubmanage.gofastcrushgoals.com'), 'club-manager');
    assert.equal(resolveRootHostIntent('app.gofastcrushgoals.com'), 'default');
  });

  it('routes clubmanage root away from /explainer', () => {
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
      '/club-manager'
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
