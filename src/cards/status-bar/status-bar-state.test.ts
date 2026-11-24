import { describe, expect, it } from 'vitest';
import { fakeHass } from '../../storybook/fixtures';
import {
  formatClock,
  formatDate,
  statusBarState,
  weatherIcon,
  type StatusBarConfig,
} from './status-bar-state';

const localTime = (year: number, month: number, day: number, hour: number, minute: number) =>
  new Date(year, month - 1, day, hour, minute, 0, 0).getTime();

describe('formatClock', () => {
  it('formats 12h time with AM/PM and no leading zero on hours', () => {
    expect(formatClock(localTime(2026, 1, 1, 0, 0), '12h')).toBe('12:00 AM');
    expect(formatClock(localTime(2026, 1, 1, 9, 5), '12h')).toBe('9:05 AM');
    expect(formatClock(localTime(2026, 1, 1, 12, 30), '12h')).toBe('12:30 PM');
    expect(formatClock(localTime(2026, 1, 1, 14, 5), '12h')).toBe('2:05 PM');
  });

  it('formats 24h time with zero-padded hours and minutes', () => {
    expect(formatClock(localTime(2026, 1, 1, 0, 0), '24h')).toBe('00:00');
    expect(formatClock(localTime(2026, 1, 1, 9, 5), '24h')).toBe('09:05');
    expect(formatClock(localTime(2026, 1, 1, 14, 5), '24h')).toBe('14:05');
  });
});

describe('formatDate', () => {
  it('formats concise weekday, day, and month', () => {
    expect(formatDate(localTime(2026, 1, 1, 14, 5))).toBe('Thu, 1 Jan');
    expect(formatDate(localTime(2026, 11, 24, 16, 0))).toBe('Tue, 24 Nov');
  });
});

describe('weatherIcon', () => {
  it('maps Home Assistant weather conditions to MDI icons', () => {
    expect(weatherIcon('sunny')).toBe('mdi:weather-sunny');
    expect(weatherIcon('partlycloudy')).toBe('mdi:weather-partly-cloudy');
    expect(weatherIcon('rainy')).toBe('mdi:weather-rainy');
    expect(weatherIcon('clear-night')).toBe('mdi:weather-night');
    expect(weatherIcon('exceptional')).toBe('mdi:alert-circle-outline');
    expect(weatherIcon('unknown-condition')).toBe('mdi:weather-partly-cloudy');
  });
});

describe('statusBarState', () => {
  const now = localTime(2026, 1, 1, 14, 5);

  it('formats clock, date, weather, and mixed status/nav chips', () => {
    const hass = fakeHass({
      'weather.home': {
        state: 'partlycloudy',
        attributes: { temperature: 22.4 },
      },
      'sensor.battery_soc': {
        state: '84.4',
        attributes: { unit_of_measurement: '%' },
      },
      'sensor.solar_power': {
        state: '3.26',
        attributes: { unit_of_measurement: 'kW' },
      },
      'lock.front_door': { state: 'locked' },
      'binary_sensor.garage_door': { state: 'open' },
    });

    const config: StatusBarConfig = {
      weather_entity: 'weather.home',
      chips: [
        {
          entity: 'sensor.battery_soc',
          secondary_entity: 'sensor.solar_power',
          icon: 'mdi:battery-80',
          decimals: 0,
          secondary_decimals: 1,
          warn_below: 20,
        },
        {
          label: 'Front Door',
          entity: 'lock.front_door',
          icon: 'mdi:lock',
          ok_state: 'locked',
          warn_state: 'unlocked',
        },
        {
          label: 'Garage',
          entity: 'binary_sensor.garage_door',
          icon: 'mdi:home',
          ok_state: 'closed',
          warn_state: 'open',
        },
        {
          label: 'Cameras',
          icon: 'mdi:cctv',
          navigate_path: '/office-command/cameras',
        },
      ],
    };

    const state = statusBarState(hass, config, now);
    expect(state.clockText).toBe('2:05 PM');
    expect(state.dateText).toBe('Thu, 1 Jan');
    expect(state.weather).toEqual({
      entityId: 'weather.home',
      icon: 'mdi:weather-partly-cloudy',
      temperature: '22.4°',
    });

    expect(state.chips).toEqual([
      {
        label: '',
        value: '84% · 3.3 kW',
        text: '84% · 3.3 kW',
        icon: 'mdi:battery-80',
        tone: 'default',
        action: { kind: 'more-info', entityId: 'sensor.battery_soc' },
      },
      {
        label: 'Front Door',
        value: 'Locked',
        text: 'Front Door · Locked',
        icon: 'mdi:lock',
        tone: 'ok',
        action: { kind: 'more-info', entityId: 'lock.front_door' },
      },
      {
        label: 'Garage',
        value: 'Open',
        text: 'Garage · Open',
        icon: 'mdi:home',
        tone: 'warn',
        action: { kind: 'more-info', entityId: 'binary_sensor.garage_door' },
      },
      {
        label: 'Cameras',
        value: '',
        text: 'Cameras',
        icon: 'mdi:cctv',
        tone: 'default',
        action: { kind: 'navigate', path: '/office-command/cameras' },
      },
    ]);
  });

  it('triggers warn tone for warn_above and warn_below thresholds and respects unit overrides', () => {
    const hass = fakeHass({
      'sensor.battery_soc': { state: '15', attributes: { unit_of_measurement: '%' } },
      'sensor.office_co2': { state: '1250', attributes: { unit_of_measurement: 'ppm' } },
      'sensor.outdoor_temp': { state: '28.6', attributes: { unit_of_measurement: '°C' } },
    });

    const state = statusBarState(
      hass,
      {
        show_clock: false,
        chips: [
          { entity: 'sensor.battery_soc', warn_below: 20, tap_action: 'none' },
          { entity: 'sensor.office_co2', warn_above: 1000, tap_action: 'toggle' },
          { entity: 'sensor.outdoor_temp', unit: '°', decimals: 0 },
        ],
      },
      now,
    );

    expect(state.clockText).toBe('');
    expect(state.chips[0].tone).toBe('warn');
    expect(state.chips[0].action).toEqual({ kind: 'none' });
    expect(state.chips[1].tone).toBe('warn');
    expect(state.chips[1].value).toBe('1250 ppm');
    expect(state.chips[1].action).toEqual({ kind: 'toggle', entityId: 'sensor.office_co2' });
    expect(state.chips[2].tone).toBe('default');
    expect(state.chips[2].value).toBe('29°');
  });

  it('handles missing or unavailable weather and chip entities gracefully', () => {
    const hass = fakeHass({
      'weather.home': { state: 'unavailable' },
      'sensor.battery_soc': { state: 'unavailable' },
      'sensor.solar_power': { state: '2.1', attributes: { unit_of_measurement: 'kW' } },
    });

    const state = statusBarState(
      hass,
      {
        time_format: '24h',
        weather_entity: 'weather.home',
        chips: [{ entity: 'sensor.battery_soc', secondary_entity: 'sensor.solar_power', warn_below: 20 }],
      },
      now,
    );

    expect(state.clockText).toBe('14:05');
    expect(state.weather).toBeUndefined();
    expect(state.chips[0].value).toBe('— · 2.1 kW');
    expect(state.chips[0].tone).toBe('default');
  });
});
