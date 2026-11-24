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

  it('reads value_attribute via dot-separated nested array paths and falls back to state', () => {
    const hass = fakeHass({
      'sensor.amber_import': {
        state: '0.25',
        attributes: {
          unit_of_measurement: '$/kWh',
          detailedForecast: [{ per_kwh: 0.184 }, { per_kwh: 0 }],
        },
      },
      'sensor.amber_null_attr': {
        state: '0.31',
        attributes: {
          detailedForecast: [{ per_kwh: null }],
        },
      },
      'sensor.amber_missing_attr': {
        state: '0.19',
        attributes: {},
      },
    });

    const state = statusBarState(
      hass,
      {
        show_clock: false,
        chips: [
          {
            entity: 'sensor.amber_import',
            value_attribute: 'detailedForecast.0.per_kwh',
            scale: 100,
            decimals: 0,
            unit: '¢',
          },
          {
            entity: 'sensor.amber_import',
            value_attribute: 'detailedForecast.1.per_kwh',
            scale: 100,
            decimals: 0,
            unit: '¢',
          },
          {
            entity: 'sensor.amber_null_attr',
            value_attribute: 'detailedForecast.0.per_kwh',
            scale: 100,
            decimals: 0,
            unit: '¢',
          },
          {
            entity: 'sensor.amber_missing_attr',
            value_attribute: 'detailedForecast.0.per_kwh',
            scale: 100,
            decimals: 0,
            unit: '¢',
          },
        ],
      },
      now,
    );

    expect(state.chips.map((c) => c.value)).toEqual(['18¢', '0¢', '31¢', '19¢']);
  });

  it('scales numeric values before rounding and attaches ¢ without a space', () => {
    const hass = fakeHass({
      'sensor.import_normal': { state: '0.184' },
      'sensor.import_negative': { state: '-0.042' },
      'sensor.import_tiny_negative': { state: '-0.002' },
      'sensor.import_unrounded': { state: '0.29' },
    });

    const state = statusBarState(
      hass,
      {
        show_clock: false,
        chips: [
          { entity: 'sensor.import_normal', scale: 100, decimals: 0, unit: '¢' },
          { entity: 'sensor.import_negative', scale: 100, decimals: 0, unit: '¢' },
          { entity: 'sensor.import_tiny_negative', scale: 100, decimals: 0, unit: '¢' },
          { entity: 'sensor.import_unrounded', scale: 100, unit: '¢' },
        ],
      },
      now,
    );

    expect(state.chips.map((c) => c.value)).toEqual(['18¢', '-4¢', '0¢', '29¢']);
  });

  it('evaluates ok, warn, danger thresholds, warn_entity, and danger > warn > ok > default precedence', () => {
    const hass = fakeHass({
      'sensor.import_cheap': { state: '0.07' },
      'sensor.import_normal': { state: '0.22' },
      'sensor.import_high': { state: '0.35' },
      'sensor.import_spike': { state: '0.52' },
      'sensor.export_good': { state: '0.18' },
      'sensor.export_negative': { state: '-0.04' },
      'sensor.system_mode': { state: 'fault' },
      'binary_sensor.demand_window_on': { state: 'on' },
      'binary_sensor.demand_window_off': { state: 'off' },
    });

    const state = statusBarState(
      hass,
      {
        show_clock: false,
        chips: [
          // ok_below after scale (7 < 10) -> ok
          {
            entity: 'sensor.import_cheap',
            scale: 100,
            decimals: 0,
            unit: '¢',
            ok_below: 10,
            warn_above: 30,
            danger_above: 45,
            warn_entity: 'binary_sensor.demand_window_off',
            warn_badge: 'DW',
          },
          // warn_entity beats ok_below (7 < 10, but DW on) -> warn + DW
          {
            entity: 'sensor.import_cheap',
            scale: 100,
            decimals: 0,
            unit: '¢',
            ok_below: 10,
            warn_above: 30,
            danger_above: 45,
            warn_entity: 'binary_sensor.demand_window_on',
            warn_badge: 'DW',
          },
          // normal -> default, no DW
          {
            entity: 'sensor.import_normal',
            scale: 100,
            decimals: 0,
            unit: '¢',
            ok_below: 10,
            warn_above: 30,
            danger_above: 45,
            warn_entity: 'binary_sensor.demand_window_off',
            warn_badge: 'DW',
          },
          // warn_above (35 > 30) -> warn
          {
            entity: 'sensor.import_high',
            scale: 100,
            decimals: 0,
            unit: '¢',
            warn_above: 30,
            danger_above: 45,
          },
          // danger_above beats warn_entity & warn_above (52 > 45, DW on) -> danger + DW
          {
            entity: 'sensor.import_spike',
            scale: 100,
            decimals: 0,
            unit: '¢',
            warn_above: 30,
            danger_above: 45,
            warn_entity: 'binary_sensor.demand_window_on',
            warn_badge: 'DW',
          },
          // ok_above (18 > 10) -> ok
          {
            entity: 'sensor.export_good',
            scale: 100,
            decimals: 0,
            unit: '¢',
            ok_above: 10,
            danger_below: 0,
          },
          // danger_below (-4 < 0) -> danger
          {
            entity: 'sensor.export_negative',
            scale: 100,
            decimals: 0,
            unit: '¢',
            ok_above: 10,
            warn_below: 5,
            danger_below: 0,
          },
          // danger_state beats warn_state and ok_state
          {
            entity: 'sensor.system_mode',
            ok_state: 'fault',
            warn_state: 'fault',
            danger_state: 'fault',
          },
        ],
      },
      now,
    );

    expect(state.chips.map((c) => ({ tone: c.tone, warnBadge: c.warnBadge }))).toEqual([
      { tone: 'ok', warnBadge: undefined },
      { tone: 'warn', warnBadge: 'DW' },
      { tone: 'default', warnBadge: undefined },
      { tone: 'warn', warnBadge: undefined },
      { tone: 'danger', warnBadge: 'DW' },
      { tone: 'ok', warnBadge: undefined },
      { tone: 'danger', warnBadge: undefined },
      { tone: 'danger', warnBadge: undefined },
    ]);
  });

  it('resolves attribute-driven trailing badges for confirmed, estimated, and missing states', () => {
    const hass = fakeHass({
      'sensor.amber_confirmed': {
        state: '0.18',
        attributes: { estimate: false },
      },
      'sensor.amber_estimated': {
        state: '0.24',
        attributes: { estimate: true },
      },
      'sensor.amber_no_attr': {
        state: '0.20',
        attributes: {},
      },
    });

    const badge = {
      attribute: 'estimate',
      equals: false,
      icon: 'mdi:check',
      else_text: 'est',
    };

    const state = statusBarState(
      hass,
      {
        show_clock: false,
        chips: [
          { entity: 'sensor.amber_confirmed', scale: 100, decimals: 0, unit: '¢', badge },
          { entity: 'sensor.amber_estimated', scale: 100, decimals: 0, unit: '¢', badge },
          { entity: 'sensor.amber_no_attr', scale: 100, decimals: 0, unit: '¢', badge },
          { entity: 'sensor.missing_entity', scale: 100, decimals: 0, unit: '¢', badge },
        ],
      },
      now,
    );

    expect(state.chips.map((c) => c.badge)).toEqual([
      { kind: 'icon', icon: 'mdi:check' },
      { kind: 'text', text: 'est' },
      undefined,
      undefined,
    ]);
  });

  it('uses value_attribute for threshold tones and keeps warn_entity active when primary is unavailable', () => {
    const hass = fakeHass({
      'sensor.amber_import': {
        state: '0.08',
        attributes: {
          detailedForecast: [{ per_kwh: 0.52 }],
        },
      },
      'sensor.offline_price': {
        state: 'unavailable',
      },
      'binary_sensor.demand_window': {
        state: 'on',
      },
    });

    const state = statusBarState(
      hass,
      {
        show_clock: false,
        chips: [
          {
            entity: 'sensor.amber_import',
            value_attribute: 'detailedForecast.0.per_kwh',
            scale: 100,
            decimals: 0,
            unit: '¢',
            ok_below: 10,
            danger_above: 45,
          },
          {
            entity: 'sensor.offline_price',
            warn_entity: 'binary_sensor.demand_window',
            warn_badge: 'DW',
          },
        ],
      },
      now,
    );

    expect(state.chips[0].value).toBe('52¢');
    expect(state.chips[0].tone).toBe('danger');
    expect(state.chips[1].value).toBe('—');
    expect(state.chips[1].tone).toBe('warn');
    expect(state.chips[1].warnBadge).toBe('DW');
  });
});
