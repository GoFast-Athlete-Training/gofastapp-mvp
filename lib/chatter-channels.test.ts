import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countLastMessageUnionBranches,
  rowsToLastMessageMap,
  type ChatterChannelType,
} from './chatter-channels';

type LastMessageRow = {
  channel_type: ChatterChannelType;
  channel_id: string;
  content: string;
  created_at: Date;
  first_name: string | null;
  last_name: string | null;
};

test('countLastMessageUnionBranches returns zero when all lists are empty', () => {
  assert.equal(countLastMessageUnionBranches([], [], []), 0);
});

test('countLastMessageUnionBranches returns one for a single channel type', () => {
  assert.equal(countLastMessageUnionBranches(['club-1'], [], []), 1);
  assert.equal(countLastMessageUnionBranches([], ['crew-1'], []), 1);
  assert.equal(countLastMessageUnionBranches([], [], ['race-1']), 1);
});

test('countLastMessageUnionBranches returns three for all channel types', () => {
  assert.equal(countLastMessageUnionBranches(['club-1'], ['crew-1'], ['race-1']), 3);
});

test('rowsToLastMessageMap keys rows by channel type and id', () => {
  const older: LastMessageRow = {
    channel_type: 'run_club',
    channel_id: 'club-1',
    content: 'older',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    first_name: 'Ada',
    last_name: 'Lovelace',
  };
  const newer: LastMessageRow = {
    channel_type: 'run_crew',
    channel_id: 'crew-2',
    content: 'newer',
    created_at: new Date('2026-02-01T00:00:00.000Z'),
    first_name: 'Alan',
    last_name: 'Turing',
  };

  const map = rowsToLastMessageMap([older, newer]);

  assert.deepEqual(map.get('run_club:club-1'), older);
  assert.deepEqual(map.get('run_crew:crew-2'), newer);
  assert.equal(map.size, 2);
});
