import { describe, expect, it } from 'vitest';
import { fakeHass } from '../../storybook/fixtures';
import {
  clampTemperature,
  climatePanelState,
  type ClimatePanelConfig,
} from './climate-panel-state';

const NOW = Date.parse('2026-01-01T12:00:00Z');
const at = (offsetSeconds: number) => new Date(NOW + offsetSeconds * 1000).toISOString();

const baseConfig: ClimatePanelConfig = {
  entity: 'climate.office_ac',
  deadline_entity: 'timer.office_ac_auto_off',
  hold_entity: 'light.office_lights',
  hold_text: 'Held · Lights on',
  power_entity: 'sensor.office_ac_power',
};

describe('clampTemperature', () => {
  it('steps within bounds and avoids floating point drift', () => {
    expect(clampTemperature(24.5, 0.5, 16, 30)).toBe(25);
    expect(clampTemperature(24.5, -0.5, 16, 30)).toBe(24);
    expect(clampTemperature(22.1, 0.2, 16, 30)).toBe(22.3);
  });

  it('clamps to min and max bounds', () => {
    expect(clampTemperature(16, -1, 16, 30)).toBe(16);
    expect(clampTemperature(16.5, -1, 16, 30)).toBe(16);
    expect(clampTemperature(30, 1, 16, 30)).toBe(30);
    expect(clampTemperature(29.5, 1, 16, 30)).toBe(30);
  });
});

describe('climatePanelState', () => {
  it('computes active cooling state with power, room temp, countdown, and step targets', () => {
    const hass = fakeHass({
      'climate.office_ac': {
        state: 'cool',
        name: 'Office Aircon',
        attributes: {
          temperature: 25,
          current_temperature: 24.5,
          min_temp: 18,
          max_temp: 28,
        },
      },
      'sensor.office_ac_power': {
        state: '100.4',
        attributes: { unit_of_measurement: 'W' },
      },
      'timer.office_ac_auto_off': {
        state: 'active',
        attributes: { finishes_at: at(5058) },
      },
      'light.office_lights': { state: 'off' },
    });

    const state = climatePanelState(hass, baseConfig, NOW);
    expect(state.available).toBe(true);
    expect(state.isOff).toBe(false);
    expect(state.name).toBe('Office Aircon');
    expect(state.mode).toBe('cool');
    expect(state.modeLabel).toBe('Cool');
    expect(state.modeTone).toBe('cool');
    expect(state.pillText).toBe('Cool · 100 W');
    expect(state.targetTemp).toBe(25);
    expect(state.targetTempDisplay).toBe('25°');
    expect(state.currentTemp).toBe(24.5);
    expect(state.roomTempDisplay).toBe('Room 24.5°');
    expect(state.step).toBe(1);
    expect(state.nextTempDown).toBe(24);
    expect(state.nextTempUp).toBe(26);
    expect(state.canStepDown).toBe(true);
    expect(state.canStepUp).toBe(true);
    expect(state.statusLine).toEqual({ text: 'Off in 84m 18s', ticking: true });
  });

  it('shows due text once countdown reaches zero and stops ticking', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'cool', attributes: { temperature: 24 } },
      'timer.office_ac_auto_off': { state: 'active', attributes: { finishes_at: at(-5) } },
    });

    const state = climatePanelState(hass, baseConfig, NOW);
    expect(state.statusLine).toEqual({ text: 'Turning off', ticking: false });
  });

  it('shows hold_text when timer is idle and hold_entity is on', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'cool', attributes: { temperature: 24 } },
      'timer.office_ac_auto_off': { state: 'idle' },
      'light.office_lights': { state: 'on' },
    });

    const state = climatePanelState(hass, baseConfig, NOW);
    expect(state.statusLine).toEqual({ text: 'Held · Lights on', ticking: false });
  });

  it('supports hold_entity even when deadline_entity is omitted', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'heat', attributes: { temperature: 21 } },
      'light.office_lights': { state: 'on' },
    });

    const state = climatePanelState(
      hass,
      { entity: 'climate.office_ac', hold_entity: 'light.office_lights', hold_text: 'Held · Lights on' },
      NOW,
    );
    expect(state.statusLine).toEqual({ text: 'Held · Lights on', ticking: false });
  });

  it('supports custom countdown_text and due_text with a timestamp sensor', () => {
    const config: ClimatePanelConfig = {
      entity: 'climate.office_ac',
      deadline_entity: 'sensor.office_ac_deadline',
      countdown_text: 'Stops in {time}',
      due_text: 'Stopping',
    };
    const running = fakeHass({
      'climate.office_ac': { state: 'heat', attributes: { temperature: 21 } },
      'sensor.office_ac_deadline': { state: at(45) },
    });
    const due = fakeHass({
      'climate.office_ac': { state: 'heat', attributes: { temperature: 21 } },
      'sensor.office_ac_deadline': { state: at(-2) },
    });

    expect(climatePanelState(running, config, NOW).statusLine).toEqual({ text: 'Stops in 45s', ticking: true });
    expect(climatePanelState(due, config, NOW).statusLine).toEqual({ text: 'Stopping', ticking: false });
  });

  it('renders muted Off hero, hides power/status, and disables temp stepping when off', () => {
    const hass = fakeHass({
      'climate.office_ac': {
        state: 'off',
        name: 'Office Aircon',
        attributes: { temperature: 25, current_temperature: 23 },
      },
      'sensor.office_ac_power': { state: '2', attributes: { unit_of_measurement: 'W' } },
      'timer.office_ac_auto_off': { state: 'active', attributes: { finishes_at: at(300) } },
      'light.office_lights': { state: 'on' },
    });

    const state = climatePanelState(hass, baseConfig, NOW);
    expect(state.available).toBe(true);
    expect(state.isOff).toBe(true);
    expect(state.targetTempDisplay).toBe('Off');
    expect(state.roomTempDisplay).toBe('Room 23°');
    expect(state.pillText).toBe('Off');
    expect(state.statusLine).toEqual({ text: '', ticking: false });
    expect(state.canStepDown).toBe(false);
    expect(state.canStepUp).toBe(false);
  });

  it('handles missing or unavailable climate entity safely', () => {
    const missing = climatePanelState(fakeHass({}), baseConfig, NOW);
    expect(missing.available).toBe(false);
    expect(missing.isOff).toBe(true);
    expect(missing.name).toBe('climate.office_ac');
    expect(missing.modeLabel).toBe('Unavailable');
    expect(missing.pillText).toBe('Unavailable');
    expect(missing.targetTempDisplay).toBe('—');
    expect(missing.canStepDown).toBe(false);
    expect(missing.canStepUp).toBe(false);

    const unavailable = climatePanelState(
      fakeHass({ 'climate.office_ac': { state: 'unavailable', name: 'Office Aircon' } }),
      baseConfig,
      NOW,
    );
    expect(unavailable.available).toBe(false);
    expect(unavailable.name).toBe('Office Aircon');
    expect(unavailable.pillText).toBe('Unavailable');
  });

  it('uses config.step, then attributes.target_temp_step, then 1, and respects min/max bounds', () => {
    const hassAtMin = fakeHass({
      'climate.office_ac': {
        state: 'cool',
        attributes: { temperature: 16, target_temp_step: 0.5 },
      },
    });
    const atMin = climatePanelState(hassAtMin, { entity: 'climate.office_ac' }, NOW);
    expect(atMin.step).toBe(0.5);
    expect(atMin.canStepDown).toBe(false);
    expect(atMin.canStepUp).toBe(true);
    expect(atMin.nextTempUp).toBe(16.5);

    const hassAtMax = fakeHass({
      'climate.office_ac': {
        state: 'heat',
        attributes: { temperature: 30, target_temp_step: 0.5 },
      },
    });
    const atMax = climatePanelState(hassAtMax, { entity: 'climate.office_ac', step: 2 }, NOW);
    expect(atMax.step).toBe(2);
    expect(atMax.canStepUp).toBe(false);
    expect(atMax.canStepDown).toBe(true);
    expect(atMax.nextTempDown).toBe(28);
  });

  it('formats kW power with 1 decimal and ignores unavailable power sensors', () => {
    const kwHass = fakeHass({
      'climate.office_ac': { state: 'heat', attributes: { temperature: 22 } },
      'sensor.office_ac_power': { state: '1.26', attributes: { unit_of_measurement: 'kW' } },
    });
    expect(climatePanelState(kwHass, baseConfig, NOW).pillText).toBe('Heat · 1.3 kW');

    const unavailPower = fakeHass({
      'climate.office_ac': { state: 'heat', attributes: { temperature: 22 } },
      'sensor.office_ac_power': { state: 'unavailable', attributes: { unit_of_measurement: 'W' } },
    });
    expect(climatePanelState(unavailPower, baseConfig, NOW).pillText).toBe('Heat');
  });

  it('builds Off + configured hvac_modes without duplicating Off', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'dry', attributes: { temperature: 24 } },
    });

    const defaults = climatePanelState(hass, { entity: 'climate.office_ac' }, NOW);
    expect(defaults.modes.map((m) => [m.mode, m.label, m.icon, m.active])).toEqual([
      ['off', 'Off', 'mdi:power', false],
      ['cool', 'Cool', 'mdi:snowflake', false],
      ['heat', 'Heat', 'mdi:fire', false],
    ]);

    const custom = climatePanelState(
      hass,
      {
        entity: 'climate.office_ac',
        name: 'Studio AC',
        hvac_modes: ['off', 'cool', 'heat', 'dry', 'fan_only', 'auto'],
      },
      NOW,
    );
    expect(custom.name).toBe('Studio AC');
    expect(custom.modes.map((m) => [m.mode, m.label, m.icon, m.active])).toEqual([
      ['off', 'Off', 'mdi:power', false],
      ['cool', 'Cool', 'mdi:snowflake', false],
      ['heat', 'Heat', 'mdi:fire', false],
      ['dry', 'Dry', 'mdi:water-percent', true],
      ['fan_only', 'Fan', 'mdi:fan', false],
      ['auto', 'Auto', 'mdi:thermostat-auto', false],
    ]);
  });
});
