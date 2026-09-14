import { describe, expect, it } from 'vitest';
import {
  discoverCatalogWhere,
  userScopedRegistryWhere,
} from './race-catalog-discoverability';

describe('discoverCatalogWhere', () => {
  it('requires active staff-promoted rows', () => {
    expect(discoverCatalogWhere()).toEqual({
      isActive: true,
      isCancelled: false,
      companyRaceId: { not: null },
    });
  });

  it('merges extra filters', () => {
    expect(discoverCatalogWhere({ city: { contains: 'Boston' } })).toMatchObject({
      city: { contains: 'Boston' },
      companyRaceId: { not: null },
    });
  });
});

describe('userScopedRegistryWhere', () => {
  it('marks personal rows as non-catalog', () => {
    expect(userScopedRegistryWhere()).toEqual({
      companyRaceId: null,
      isActive: false,
    });
  });
});
