import { describe, expect, it } from 'vitest';
import { fakeHass } from '../../storybook/fixtures';
import { tileConfigFor, tileStatus, type CountdownTileStatusConfig } from './tile-status';

const NOW = Date.parse('2026-01-01T12:00:00Z');
const at = (offsetSeconds: number) => new Date(NOW + offsetSeconds * 1000).toISOString();

const baseConfig: CountdownTileStatusConfig = {
  entity: 'climate.office_ac',
  deadline_entity: 'timer.office_ac_auto_off',
  hold_entity: 'binary_sensor.office_lights',
  hold_text: 'Lights on',
};

describe('tileStatus', () => {
  it.each(['off', 'unavailable', 'unknown'])(
    'is silent when the entity is %s, even with an active timer or hold',
    (state) => {
      const hass = fakeHass({
        'climate.office_ac': { state },
        'timer.office_ac_auto_off': { state: 'active', attributes: { finishes_at: at(120) } },
        'binary_sensor.office_lights': { state: 'on' },
      });
      expect(tileStatus(hass, baseConfig, NOW)).toEqual({ text: '', ticking: false });
    },
  );

  it('is silent when the entity is missing from hass', () => {
    const hass = fakeHass({
      'timer.office_ac_auto_off': { state: 'active', attributes: { finishes_at: at(120) } },
      'binary_sensor.office_lights': { state: 'on' },
    });
    expect(tileStatus(hass, baseConfig, NOW)).toEqual({ text: '', ticking: false });
  });

  it('counts down while active with a running timer entity', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'cool' },
      'timer.office_ac_auto_off': { state: 'active', attributes: { finishes_at: at(900) } },
      'binary_sensor.office_lights': { state: 'off' },
    });
    expect(tileStatus(hass, baseConfig, NOW)).toEqual({ text: 'Off in 15m 00s', ticking: true });
  });

  it('shows due text once the timer reaches zero and stops ticking', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'heat' },
      'timer.office_ac_auto_off': { state: 'active', attributes: { finishes_at: at(-5) } },
      'binary_sensor.office_lights': { state: 'off' },
    });
    expect(tileStatus(hass, baseConfig, NOW)).toEqual({ text: 'Turning off', ticking: false });
  });

  it('shows hold_text when there is no countdown and hold_entity is on', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'cool' },
      'timer.office_ac_auto_off': { state: 'idle' },
      'binary_sensor.office_lights': { state: 'on' },
    });
    expect(tileStatus(hass, baseConfig, NOW)).toEqual({ text: 'Lights on', ticking: false });
  });

  it('shows hold_text when the timer is paused and hold_entity is on', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'cool' },
      'timer.office_ac_auto_off': { state: 'paused', attributes: { finishes_at: at(120) } },
      'binary_sensor.office_lights': { state: 'on' },
    });
    expect(tileStatus(hass, baseConfig, NOW)).toEqual({ text: 'Lights on', ticking: false });
  });

  it('prefers an active countdown over hold_text if both are active', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'cool' },
      'timer.office_ac_auto_off': { state: 'active', attributes: { finishes_at: at(45) } },
      'binary_sensor.office_lights': { state: 'on' },
    });
    expect(tileStatus(hass, baseConfig, NOW)).toEqual({ text: 'Off in 45s', ticking: true });
  });

  it('is silent when no countdown is running and hold_entity is off', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'cool' },
      'timer.office_ac_auto_off': { state: 'idle' },
      'binary_sensor.office_lights': { state: 'off' },
    });
    expect(tileStatus(hass, baseConfig, NOW)).toEqual({ text: '', ticking: false });
  });

  it('is silent when hold_entity is on but hold_text is not configured', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'cool' },
      'timer.office_ac_auto_off': { state: 'idle' },
      'binary_sensor.office_lights': { state: 'on' },
    });
    expect(tileStatus(hass, { entity: 'climate.office_ac', deadline_entity: 'timer.office_ac_auto_off', hold_entity: 'binary_sensor.office_lights' }, NOW)).toEqual({
      text: '',
      ticking: false,
    });
  });

  it('works with a timestamp sensor as deadline_entity', () => {
    const hass = fakeHass({
      'climate.office_ac': { state: 'heat_cool' },
      'sensor.office_ac_deadline': { state: at(185) },
    });
    expect(
      tileStatus(hass, { entity: 'climate.office_ac', deadline_entity: 'sensor.office_ac_deadline' }, NOW),
    ).toEqual({ text: 'Off in 3m 05s', ticking: true });
  });

  it('uses custom countdown_text and due_text when configured', () => {
    const config: CountdownTileStatusConfig = {
      entity: 'switch.heater',
      deadline_entity: 'sensor.heater_deadline',
      countdown_text: 'Stops in {time}',
      due_text: 'Stopping',
    };
    const running = fakeHass({
      'switch.heater': { state: 'on' },
      'sensor.heater_deadline': { state: at(30) },
    });
    const due = fakeHass({
      'switch.heater': { state: 'on' },
      'sensor.heater_deadline': { state: at(-1) },
    });
    expect(tileStatus(running, config, NOW)).toEqual({ text: 'Stops in 30s', ticking: true });
    expect(tileStatus(due, config, NOW)).toEqual({ text: 'Stopping', ticking: false });
  });
});

describe('tileConfigFor', () => {
  it('strips only countdown-tile keys, forces type: tile, and keeps all tile options intact', () => {
    const config = {
      type: 'custom:dash-countdown-tile',
      entity: 'climate.office_ac',
      name: 'Office AC',
      icon: 'mdi:air-conditioner',
      color: 'blue',
      vertical: false,
      hide_state: false,
      features_position: 'bottom' as const,
      features: [{ type: 'climate-hvac-modes', hvac_modes: ['off', 'cool', 'heat'] }, { type: 'target-temperature' }],
      tap_action: { action: 'more-info' },
      deadline_entity: 'timer.office_ac_auto_off',
      countdown_text: 'Off in {time}',
      due_text: 'Turning off',
      hold_entity: 'binary_sensor.office_lights',
      hold_text: 'Lights on',
    };

    expect(tileConfigFor(config)).toEqual({
      type: 'tile',
      entity: 'climate.office_ac',
      name: 'Office AC',
      icon: 'mdi:air-conditioner',
      color: 'blue',
      vertical: false,
      hide_state: false,
      features_position: 'bottom',
      features: [{ type: 'climate-hvac-modes', hvac_modes: ['off', 'cool', 'heat'] }, { type: 'target-temperature' }],
      tap_action: { action: 'more-info' },
    });
  });
});
