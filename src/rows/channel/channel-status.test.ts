import { describe, expect, it } from 'vitest';
import { CHANNEL, channelHass, fakeHass, type ChannelState } from '../../storybook/fixtures';
import { DEFAULT_TEXT } from '../countdown/countdown-row';
import { channelLine, resolveChannel } from './channel-status';

const NOW = Date.parse('2026-01-01T12:00:00Z');

function line(state: ChannelState, overrides = {}) {
  const hass = channelHass(state, NOW);
  return channelLine(hass, CHANNEL.light, resolveChannel(hass, CHANNEL.light, overrides), DEFAULT_TEXT, NOW);
}

describe('resolveChannel', () => {
  it('finds all three sensors on the light’s device', () => {
    const hass = channelHass({ light: 'on' }, NOW);
    expect(resolveChannel(hass, CHANNEL.light, {})).toEqual({
      deadline: CHANNEL.deadline,
      occupied: CHANNEL.occupied,
      status: CHANNEL.status,
    });
  });

  it('reads the sensors from channel_entity’s device for a light on another device', () => {
    const hass = channelHass({ light: 'on' }, NOW);
    expect(resolveChannel(hass, 'light.reading_lamp', { channel_entity: CHANNEL.light }).status).toBe(CHANNEL.status);
  });

  it('lets explicit keys win', () => {
    const hass = channelHass({ light: 'on' }, NOW);
    expect(resolveChannel(hass, CHANNEL.light, { status_entity: 'sensor.other' }).status).toBe('sensor.other');
  });
});

describe('channelLine', () => {
  it.each<[string, ChannelState, string, boolean]>([
    ['off', { light: 'off', status: 'off', deadlineIn: 90 }, '', false],
    ['unavailable', { light: 'unavailable', status: 'timer', deadlineIn: 90 }, '', false],
    ['on by hand, no timer', { light: 'on', status: 'on' }, '', false],
    ['motion', { light: 'on', status: 'motion', occupied: 'on' }, 'Motion', false],
    ['presence while occupied', { light: 'on', status: 'presence', occupied: 'on' }, 'Presence', false],
    ['fading', { light: 'on', status: 'fading', deadlineIn: -2 }, 'Fading off', false],
    ['counting down minutes', { light: 'on', status: 'timer', deadlineIn: 192 }, 'Off in 3m 12s', true],
    ['counting down seconds', { light: 'on', status: 'timer', deadlineIn: 9 }, 'Off in 9s', true],
    ['past the deadline', { light: 'on', status: 'timer', deadlineIn: -3 }, 'Turning off', false],
    ['stale deadline', { light: 'on', status: 'timer', deadlineIn: -600 }, '', false],
  ])('%s', (_name, state, text, ticking) => {
    expect(line(state)).toEqual({ text, ticking });
  });

  describe('without a usable status sensor', () => {
    it('treats occupancy as motion', () => {
      expect(line({ light: 'on', status: 'unavailable', occupied: 'on', deadlineIn: 90 }).text).toBe('Motion');
    });

    it('counts down when unoccupied', () => {
      expect(line({ light: 'on', status: 'unknown', occupied: 'off', deadlineIn: 90 }).text).toBe('Off in 1m 30s');
    });

    it('works with no status entity at all', () => {
      const hass = fakeHass({
        'switch.fan': { state: 'on' },
        'binary_sensor.fan_occupied': { state: 'off' },
        'sensor.fan_deadline': { state: new Date(NOW + 30_000).toISOString() },
      });
      const channel = { occupied: 'binary_sensor.fan_occupied', deadline: 'sensor.fan_deadline' };
      expect(channelLine(hass, 'switch.fan', channel, DEFAULT_TEXT, NOW).text).toBe('Off in 30s');
    });
  });
});
