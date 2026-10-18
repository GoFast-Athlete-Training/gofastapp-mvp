import test from 'node:test';
import assert from 'node:assert/strict';
import { associatedRunClubIdFromBody, mapClubAssociationRow } from './club-association';

test('associatedRunClubIdFromBody treats empty string as null', () => {
  assert.equal(associatedRunClubIdFromBody({ associatedRunClubId: '' }), null);
  assert.equal(associatedRunClubIdFromBody({ associatedRunClubId: '  club-1  ' }), 'club-1');
  assert.equal(associatedRunClubIdFromBody({}), undefined);
});

test('mapClubAssociationRow passes through snapshot fields', () => {
  assert.deepEqual(
    mapClubAssociationRow({
      runClubId: 'c1',
      nameSnapshot: 'DCCR',
      logoUrlSnapshot: 'https://example.com/logo.png',
    }),
    {
      runClubId: 'c1',
      nameSnapshot: 'DCCR',
      logoUrlSnapshot: 'https://example.com/logo.png',
    }
  );
});
