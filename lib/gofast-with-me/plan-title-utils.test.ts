import { describe, expect, it } from 'vitest';
import { normalizePlanTitleInput, planTitleFallback } from './plan-title-utils';

describe('planTitleFallback', () => {
  it('uses first name when present', () => {
    expect(planTitleFallback('Adam')).toBe("Adam's plan");
  });

  it('falls back when first name is blank', () => {
    expect(planTitleFallback('')).toBe('My training plan');
    expect(planTitleFallback(null)).toBe('My training plan');
  });
});

describe('normalizePlanTitleInput', () => {
  it('trims whitespace', () => {
    expect(normalizePlanTitleInput('  Marathon block  ', 'Adam')).toBe('Marathon block');
  });

  it('uses athlete fallback when input is empty', () => {
    expect(normalizePlanTitleInput('', 'Adam')).toBe("Adam's plan");
    expect(normalizePlanTitleInput('   ', null)).toBe('My training plan');
  });
});
