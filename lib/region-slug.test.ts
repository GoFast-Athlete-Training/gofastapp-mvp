import test from 'node:test';
import assert from 'node:assert/strict';

import {
  athleteCityToSlug,
  citySlugsForRegion,
  inferRegionSlugFromCitySlug,
} from './region-slug';

test('maps DC metro city slugs to region dc', () => {
  assert.equal(inferRegionSlugFromCitySlug('dc'), 'dc');
  assert.equal(inferRegionSlugFromCitySlug('arlington'), 'dc');
  assert.equal(inferRegionSlugFromCitySlug('manassas'), null);
});

test('normalizes athlete Washington DC variants to dc', () => {
  assert.equal(athleteCityToSlug('Washington', 'DC'), 'dc');
  assert.equal(athleteCityToSlug('Washington DC'), 'dc');
  assert.equal(athleteCityToSlug('Arlington', 'VA'), 'arlington');
});

test('lists city slugs for a region', () => {
  const slugs = citySlugsForRegion('dc');
  for (const expected of ['dc', 'arlington', 'bethesda', 'alexandria']) {
    assert.ok(slugs.includes(expected), `expected ${expected} in ${slugs.join(', ')}`);
  }
});
