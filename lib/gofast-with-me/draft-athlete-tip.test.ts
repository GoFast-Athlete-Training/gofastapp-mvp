import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDraftAthleteTip } from './draft-athlete-tip';

describe('normalizeDraftAthleteTip', () => {
  it('accepts a minimal rough-idea draft with title and body only', () => {
    const out = normalizeDraftAthleteTip({
      title: 'Sleep on hard weeks',
      body: 'When mileage climbs, protect sleep like a workout.',
      takeaway: null,
      tipSeries: null,
    });

    assert.ok(out);
    assert.equal(out.title, 'Sleep on hard weeks');
    assert.equal(out.body, 'When mileage climbs, protect sleep like a workout.');
    assert.equal(out.takeaway, null);
    assert.equal(out.tipSeries, null);
  });

  it('structures a hills template into takeaway and three series items', () => {
    const out = normalizeDraftAthleteTip({
      title: 'Build Hills Into Your Training',
      body:
        'Hills are one of the best ways to build strength, power, and running efficiency without just adding more miles. But running hills doesn’t mean attacking every climb as hard as you can. Different hill workouts have different purposes — and where you put them in your training matters.',
      takeaway: 'Don’t just run hills harder. Use hills with a purpose.',
      tipSeries: {
        title: '3 Ways to Use Hills in Your Training',
        tips: [
          {
            title: 'Short Hills for Power',
            body: 'Run short, hard uphill efforts of about 20–60 seconds. Focus on strong form, quick turnover, and driving up the hill rather than chasing pace.',
          },
          {
            title: 'Longer Hills for Strength',
            body: 'Use longer climbs at a controlled effort to build the strength to hold your form when running gets hard. Think sustained effort, not an all-out sprint to the top.',
          },
          {
            title: 'Build Hills Into Your Long Run',
            body: "Don't always avoid elevation on long-run day. A rolling route can build strength and teach you to manage effort as the terrain changes — especially if your goal race isn't flat.",
          },
        ],
      },
    });

    assert.ok(out);
    assert.equal(out.title, 'Build Hills Into Your Training');
    assert.match(out.body, /Hills are one of the best ways/);
    assert.equal(out.takeaway, 'Don’t just run hills harder. Use hills with a purpose.');
    assert.equal(out.tipSeries?.title, '3 Ways to Use Hills in Your Training');
    assert.equal(out.tipSeries?.tips.length, 3);
    assert.equal(out.tipSeries?.tips[0]?.title, 'Short Hills for Power');
    assert.equal(out.tipSeries?.tips[2]?.title, 'Build Hills Into Your Long Run');
  });

  it('rejects drafts missing title or body', () => {
    assert.equal(normalizeDraftAthleteTip({ title: '', body: 'Only body' }), null);
    assert.equal(normalizeDraftAthleteTip({ title: 'Only title', body: '' }), null);
  });

  it('drops empty series while keeping core fields', () => {
    const out = normalizeDraftAthleteTip({
      title: 'Fuel early',
      body: 'Eat within 30 minutes after long runs.',
      takeaway: 'Refuel before you feel hungry.',
      tipSeries: { title: '', tips: [{ title: '', body: '' }] },
    });

    assert.ok(out);
    assert.equal(out.tipSeries, null);
    assert.equal(out.takeaway, 'Refuel before you feel hungry.');
  });
});
