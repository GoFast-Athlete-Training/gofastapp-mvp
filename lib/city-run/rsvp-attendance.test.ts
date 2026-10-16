import { describe, expect, it } from 'vitest';
import {
  isAthleteOnCityRun,
  isAttendingCityRunRsvp,
  splitCityRunRsvpsByRole,
} from './rsvp-attendance';

describe('rsvp-attendance', () => {
  it('treats host row as attending', () => {
    expect(
      isAttendingCityRunRsvp({ status: 'going', role: 'host' }),
    ).toBe(true);
  });

  it('ignores not-going rows', () => {
    expect(
      isAttendingCityRunRsvp({ status: 'not-going', role: null }),
    ).toBe(false);
  });

  it('splits host and members', () => {
    const { host, members } = splitCityRunRsvpsByRole([
      {
        id: '1',
        athleteId: 'a',
        status: 'going',
        role: 'host',
      },
      {
        id: '2',
        athleteId: 'b',
        status: 'going',
        role: 'going',
      },
    ]);
    expect(host?.id).toBe('1');
    expect(members).toHaveLength(1);
    expect(members[0]?.id).toBe('2');
  });

  it('isAthleteOnCityRun uses role not status alone', () => {
    expect(
      isAthleteOnCityRun({ currentRSVP: 'going', currentRSVPRole: 'host' }),
    ).toBe(true);
    expect(
      isAthleteOnCityRun({ currentRSVP: 'not-going', currentRSVPRole: 'host' }),
    ).toBe(false);
  });
});
