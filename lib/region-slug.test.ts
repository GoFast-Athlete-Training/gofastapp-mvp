import test from 'node:test';
import assert from 'node:assert/strict';

import {
  athleteCityToSlug,
  citySlugsForRegion,
  DMV_REGION_SLUG,
  inferRegionSlugFromCitySlug,
} from './region-slug';

test('maps DC metro city slugs to region dmv', () => {
  assert.equal(inferRegionSlugFromCitySlug('dc'), DMV_REGION_SLUG);
  assert.equal(inferRegionSlugFromCitySlug('arlington'), DMV_REGION_SLUG);
  assert.equal(inferRegionSlugFromCitySlug('manassas'), null);
});

test('normalizes athlete Washington DC variants to dc', () => {
  assert.equal(athleteCityToSlug('Washington', 'DC'), 'dc');
  assert.equal(athleteCityToSlug('Washington DC'), 'dc');
  assert.equal(athleteCityToSlug('Arlington', 'VA'), 'arlington');
});

test('lists city slugs for DMV region', () => {
  const slugs = citySlugsForRegion(DMV_REGION_SLUG);
  for (const expected of ['dc', 'arlington', 'bethesda', 'alexandria']) {
    assert.ok(slugs.includes(expected), `expected ${expected} in ${slugs.join(', ')}`);
  }
});
