import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapAthleteTip, normalizeTipInput } from './athlete-tips';

describe('normalizeTipInput', () => {
  it('accepts image media', () => {
    const out = normalizeTipInput({
      title: 'Fuel',
      body: 'Eat early',
      mediaUrl: 'https://example.com/a.jpg',
      mediaType: 'image',
      isPublished: true,
    });
    assert.equal(out.mediaUrl, 'https://example.com/a.jpg');
    assert.equal(out.mediaType, 'image');
  });

  it('clears media when url is empty', () => {
    const out = normalizeTipInput({
      title: 'Fuel',
      body: 'Eat early',
      mediaUrl: null,
      mediaType: 'video',
    });
    assert.equal(out.mediaUrl, null);
    assert.equal(out.mediaType, null);
  });

  it('defaults mediaType to image when url present without type', () => {
    const out = normalizeTipInput({
      title: 'Fuel',
      body: 'Eat early',
      mediaUrl: 'https://example.com/a.jpg',
    });
    assert.equal(out.mediaType, 'image');
  });
});

describe('mapAthleteTip', () => {
  it('maps media fields', () => {
    const out = mapAthleteTip({
      id: 't1',
      title: 'Tip',
      body: 'Body',
      mediaUrl: 'https://example.com/v.mp4',
      mediaType: 'video',
      sortOrder: 0,
      isPublished: true,
      showOnLanding: true,
      showOnFeed: true,
      publishedAt: new Date('2026-08-01T00:00:00.000Z'),
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    assert.equal(out.mediaUrl, 'https://example.com/v.mp4');
    assert.equal(out.mediaType, 'video');
  });

  it('drops mediaType when mediaUrl is empty', () => {
    const out = mapAthleteTip({
      id: 't1',
      title: 'Tip',
      body: 'Body',
      mediaUrl: '   ',
      mediaType: 'video',
      sortOrder: 0,
      isPublished: false,
      showOnLanding: false,
      showOnFeed: false,
      publishedAt: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    assert.equal(out.mediaUrl, null);
    assert.equal(out.mediaType, null);
  });
});
