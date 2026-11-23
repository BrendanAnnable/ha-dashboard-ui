import { describe, expect, it } from 'vitest';
import { countdownAt, countdownForEntity, countdownText, formatDuration } from './countdown';
import type { HassEntity } from './hass';

const NOW = Date.parse('2026-01-01T12:00:00Z');
const at = (offsetSeconds: number) => new Date(NOW + offsetSeconds * 1000).toISOString();

const entity = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({
  entity_id,
  state,
  attributes,
});

describe('countdownAt', () => {
  it('counts whole seconds up to the deadline, rounding up', () => {
    expect(countdownAt(at(90), NOW)).toEqual({ kind: 'running', seconds: 90 });
    expect(countdownAt(new Date(NOW + 400).toISOString(), NOW)).toEqual({ kind: 'running', seconds: 1 });
  });

  it('is due from the deadline until a minute after it', () => {
    expect(countdownAt(at(0), NOW)).toEqual({ kind: 'due' });
    expect(countdownAt(at(-59), NOW)).toEqual({ kind: 'due' });
  });

  it('ignores deadlines more than a minute old, so a stale sensor goes quiet', () => {
    expect(countdownAt(at(-60), NOW)).toEqual({ kind: 'none' });
  });

  it.each([undefined, '', 'unknown', 'unavailable', 'not a date'])('has no countdown for %j', (state) => {
    expect(countdownAt(state, NOW)).toEqual({ kind: 'none' });
  });
});

describe('formatDuration', () => {
  it.each([
    [1, '1s'],
    [59, '59s'],
    [60, '1m 00s'],
    [65, '1m 05s'],
    [600, '10m 00s'],
    [4320, '72m 00s'],
  ])('%i seconds reads %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});

describe('countdownText', () => {
  const text = { running: 'Locks in {time}', due: 'Locking' };
  it('fills the running template, uses the due text, and says nothing otherwise', () => {
    expect(countdownText({ kind: 'running', seconds: 125 }, text)).toBe('Locks in 2m 05s');
    expect(countdownText({ kind: 'due' }, text)).toBe('Locking');
    expect(countdownText({ kind: 'none' }, text)).toBe('');
  });
});

describe('countdownForEntity', () => {
  it('reads finishes_at from an active timer entity', () => {
    const timer = entity('timer.office_ac', 'active', { finishes_at: at(125) });
    expect(countdownForEntity(timer, NOW)).toEqual({ kind: 'running', seconds: 125 });
  });

  it('reports due for an active timer whose finishes_at just passed', () => {
    const timer = entity('timer.office_ac', 'active', { finishes_at: at(-5) });
    expect(countdownForEntity(timer, NOW)).toEqual({ kind: 'due' });
  });

  it('ignores an active timer whose finishes_at is stale or missing', () => {
    expect(countdownForEntity(entity('timer.office_ac', 'active', { finishes_at: at(-60) }), NOW)).toEqual({
      kind: 'none',
    });
    expect(countdownForEntity(entity('timer.office_ac', 'active', {}), NOW)).toEqual({ kind: 'none' });
    expect(countdownForEntity(entity('timer.office_ac', 'active', { finishes_at: 12345 }), NOW)).toEqual({
      kind: 'none',
    });
  });

  it.each(['paused', 'idle', 'unavailable', 'unknown'])(
    'returns none for a %s timer even if finishes_at is still set',
    (state) => {
      const timer = entity('timer.office_ac', state, { finishes_at: at(120) });
      expect(countdownForEntity(timer, NOW)).toEqual({ kind: 'none' });
    },
  );

  it('reads state directly for timestamp sensors and other entities', () => {
    expect(countdownForEntity(entity('sensor.deadline', at(45)), NOW)).toEqual({ kind: 'running', seconds: 45 });
    expect(countdownForEntity(entity('sensor.deadline', at(-2)), NOW)).toEqual({ kind: 'due' });
    expect(countdownForEntity(entity('sensor.deadline', 'unknown'), NOW)).toEqual({ kind: 'none' });
  });

  it('returns none when the entity is missing', () => {
    expect(countdownForEntity(undefined, NOW)).toEqual({ kind: 'none' });
  });
});
