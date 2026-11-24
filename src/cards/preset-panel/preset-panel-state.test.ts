import { describe, expect, it } from 'vitest';
import { CHANNEL, channelHass, fakeHass } from '../../storybook/fixtures';
import {
  activePresetIndex,
  parseServiceAction,
  presetPanelState,
  type PresetItem,
  type PresetPanelConfig,
} from './preset-panel-state';

const NOW = Date.parse('2026-01-01T12:00:00Z');
const at = (offsetSeconds: number) => new Date(NOW + offsetSeconds * 1000).toISOString();

const LIGHT_PRESETS: PresetItem[] = [
  { label: 'Off', icon: 'mdi:lightbulb-off', color: 'neutral', action: 'light.turn_off', match: { state: 'off' } },
  {
    label: 'Dark',
    icon: 'mdi:brightness-4',
    color: 'purple',
    action: 'light.turn_on',
    data: { brightness_pct: 15 },
    match: { state: 'on', brightness_min: 1, brightness_max: 60 },
  },
  {
    label: 'Dim',
    icon: 'mdi:brightness-6',
    color: 'amber',
    action: 'light.turn_on',
    data: { brightness_pct: 50 },
    match: { state: 'on', brightness_min: 61, brightness_max: 180 },
  },
  {
    label: 'Full',
    icon: 'mdi:brightness-7',
    color: 'amber',
    action: 'light.turn_on',
    data: { brightness_pct: 100 },
    match: { state: 'on', brightness_min: 181, brightness_max: 255 },
  },
];

const FAN_PRESETS: PresetItem[] = [
  { label: 'Off', icon: 'mdi:fan-off', color: 'neutral', action: 'fan.turn_off', match: { state: 'off' } },
  {
    label: '1',
    icon: 'mdi:fan-speed-1',
    color: 'cool',
    action: 'fan.set_preset_mode',
    data: { preset_mode: '1' },
    match: { preset_mode: '1' },
  },
  {
    label: '2',
    icon: 'mdi:fan-speed-2',
    color: 'cool',
    action: 'fan.set_preset_mode',
    data: { preset_mode: '2' },
    match: { preset_mode: '2' },
  },
  {
    label: '3',
    icon: 'mdi:fan-speed-3',
    color: 'cool',
    action: 'fan.set_preset_mode',
    data: { preset_mode: '3' },
    match: { preset_mode: '3' },
  },
];

describe('parseServiceAction', () => {
  it('splits valid domain.service strings', () => {
    expect(parseServiceAction('light.turn_on')).toEqual({ domain: 'light', service: 'turn_on' });
    expect(parseServiceAction('fan.set_preset_mode')).toEqual({ domain: 'fan', service: 'set_preset_mode' });
  });

  it('returns undefined for invalid actions', () => {
    expect(parseServiceAction('')).toBeUndefined();
    expect(parseServiceAction('light')).toBeUndefined();
    expect(parseServiceAction('.turn_on')).toBeUndefined();
    expect(parseServiceAction('light.')).toBeUndefined();
  });
});

describe('activePresetIndex', () => {
  it('matches light presets by state and brightness ranges', () => {
    expect(activePresetIndex({ entity_id: 'light.a', state: 'off', attributes: {} }, LIGHT_PRESETS)).toBe(0);
    expect(activePresetIndex({ entity_id: 'light.a', state: 'on', attributes: { brightness: 30 } }, LIGHT_PRESETS)).toBe(1);
    expect(activePresetIndex({ entity_id: 'light.a', state: 'on', attributes: { brightness: 128 } }, LIGHT_PRESETS)).toBe(2);
    expect(activePresetIndex({ entity_id: 'light.a', state: 'on', attributes: { brightness: 255 } }, LIGHT_PRESETS)).toBe(3);
  });

  it('matches fan presets by preset_mode and ignores stale attributes while off', () => {
    expect(activePresetIndex({ entity_id: 'fan.a', state: 'on', attributes: { preset_mode: '2' } }, FAN_PRESETS)).toBe(2);

    // Even if preset_mode presets appeared before Off, an off fan should not match a preset_mode-only matcher.
    const reordered = [...FAN_PRESETS.slice(1), FAN_PRESETS[0]];
    expect(activePresetIndex({ entity_id: 'fan.a', state: 'off', attributes: { preset_mode: '2' } }, reordered)).toBe(3);
  });

  it('returns -1 when missing, unmatched, or match object is empty', () => {
    expect(activePresetIndex(undefined, LIGHT_PRESETS)).toBe(-1);
    expect(activePresetIndex({ entity_id: 'light.a', state: 'unavailable', attributes: {} }, LIGHT_PRESETS)).toBe(-1);
    expect(
      activePresetIndex({ entity_id: 'light.a', state: 'on', attributes: {} }, [
        { label: 'Empty', action: 'light.turn_on', match: {} },
      ]),
    ).toBe(-1);
  });
});

describe('presetPanelState', () => {
  it('combines active preset label with channel presence and countdown status', () => {
    const presenceHass = channelHass({ light: 'on', status: 'presence', occupied: 'on' }, NOW);
    presenceHass.states[CHANNEL.light]!.attributes.brightness = 255;

    const config: PresetPanelConfig = {
      entity: CHANNEL.light,
      name: 'Office Lights',
      presets: LIGHT_PRESETS,
    };

    const presence = presetPanelState(presenceHass, config, NOW);
    expect(presence.available).toBe(true);
    expect(presence.name).toBe('Office Lights');
    expect(presence.activeIndex).toBe(3);
    expect(presence.activeColor).toBe('amber');
    expect(presence.statusText).toBe('Full · Presence');
    expect(presence.ticking).toBe(false);

    const timerHass = channelHass({ light: 'on', status: 'timer', deadlineIn: 252 }, NOW);
    timerHass.states[CHANNEL.light]!.attributes.brightness = 128;

    const counting = presetPanelState(timerHass, config, NOW);
    expect(counting.activeIndex).toBe(2);
    expect(counting.statusText).toBe('Dim · Off in 4m 12s');
    expect(counting.ticking).toBe(true);
  });

  it('supports explicit timer deadline_entity and custom countdown text', () => {
    const hass = fakeHass({
      'light.office_lights': { state: 'on', name: 'Office Lights', attributes: { brightness: 40 } },
      'timer.office_lights_off': { state: 'active', attributes: { finishes_at: at(90) } },
    });

    const state = presetPanelState(
      hass,
      {
        entity: 'light.office_lights',
        presets: LIGHT_PRESETS,
        deadline_entity: 'timer.office_lights_off',
        countdown_text: 'Dimming in {time}',
      },
      NOW,
    );

    expect(state.activeIndex).toBe(1);
    expect(state.activeColor).toBe('purple');
    expect(state.statusText).toBe('Dark · Dimming in 1m 30s');
    expect(state.ticking).toBe(true);
  });

  it('shows just active preset label for a fan with no channel sensors', () => {
    const hass = fakeHass({
      'fan.office_ceiling': { state: 'on', name: 'Ceiling Fan', attributes: { preset_mode: '2' } },
    });

    const state = presetPanelState(hass, { entity: 'fan.office_ceiling', presets: FAN_PRESETS }, NOW);
    expect(state.name).toBe('Ceiling Fan');
    expect(state.activeIndex).toBe(2);
    expect(state.activeColor).toBe('cool');
    expect(state.statusText).toBe('2');
    expect(state.ticking).toBe(false);
    expect(state.presets.map((p) => p.active)).toEqual([false, false, true, false]);
  });

  it('handles off and unavailable states cleanly', () => {
    const offHass = channelHass({ light: 'off', status: 'timer', deadlineIn: 60 }, NOW);
    const off = presetPanelState(offHass, { entity: CHANNEL.light, presets: LIGHT_PRESETS }, NOW);
    expect(off.activeIndex).toBe(0);
    expect(off.activeColor).toBe('neutral');
    expect(off.statusText).toBe('Off');
    expect(off.ticking).toBe(false);

    const missing = presetPanelState(fakeHass({}), { entity: 'fan.office_ceiling', presets: FAN_PRESETS }, NOW);
    expect(missing.available).toBe(false);
    expect(missing.name).toBe('fan.office_ceiling');
    expect(missing.statusText).toBe('Unavailable');
    expect(missing.activeIndex).toBe(-1);
  });
});
