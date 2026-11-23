import { describe, expect, it } from 'vitest';
import { fakeHass } from '../../storybook/fixtures';
import { countdownRowLine } from './countdown-row';

const NOW = Date.parse('2026-01-01T12:00:00Z');
const at = (offsetSeconds: number) => new Date(NOW + offsetSeconds * 1000).toISOString();

describe('countdownRowLine', () => {
  it('counts down an active timer entity', () => {
    const hass = fakeHass({
      'switch.fan': { state: 'on' },
      'timer.fan_auto_off': { state: 'active', attributes: { finishes_at: at(195) } },
    });
    expect(countdownRowLine(hass, { deadline_entity: 'timer.fan_auto_off' }, NOW)).toEqual({
      text: 'Off in 3m 15s',
      ticking: true,
    });
  });

  it('shows due text when an active timer just finished', () => {
    const hass = fakeHass({
      'switch.fan': { state: 'on' },
      'timer.fan_auto_off': { state: 'active', attributes: { finishes_at: at(-3) } },
    });
    expect(countdownRowLine(hass, { deadline_entity: 'timer.fan_auto_off' }, NOW)).toEqual({
      text: 'Turning off',
      ticking: false,
    });
  });

  it.each(['idle', 'paused', 'unavailable'])('is silent for a %s timer entity', (state) => {
    const hass = fakeHass({
      'switch.fan': { state: 'on' },
      'timer.fan_auto_off': { state, attributes: { finishes_at: at(120) } },
    });
    expect(countdownRowLine(hass, { deadline_entity: 'timer.fan_auto_off' }, NOW)).toEqual({
      text: '',
      ticking: false,
    });
  });

  it('continues to support timestamp sensors and custom text', () => {
    const hass = fakeHass({
      'lock.front_door': { state: 'unlocked' },
      'sensor.relock': { state: at(75) },
    });
    expect(
      countdownRowLine(
        hass,
        { deadline_entity: 'sensor.relock', countdown_text: 'Locks in {time}', due_text: 'Locking' },
        NOW,
      ),
    ).toEqual({
      text: 'Locks in 1m 15s',
      ticking: true,
    });
  });
});
