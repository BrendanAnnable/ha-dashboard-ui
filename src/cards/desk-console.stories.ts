import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { CHANNEL, channelHass } from '../storybook/fixtures';
import { createClimatePanel, createPresetPanel, createStatusBar, STORY_NOW } from '../storybook/render';
import type { ClimatePanel } from './climate-panel/climate-panel';
import type { PresetItem, PresetPanel } from './preset-panel/preset-panel';
import type { StatusBar } from './status-bar/status-bar';

const FIXED_LOCAL_NOW = new Date(2026, 0, 1, 14, 5, 0, 0).getTime();

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

function buildConsole() {
  const hass = channelHass({ light: 'on', status: 'presence', occupied: 'on' }, STORY_NOW);
  hass.states[CHANNEL.light]!.attributes.brightness = 255;

  Object.assign(hass.states, {
    'weather.home': {
      entity_id: 'weather.home',
      state: 'partlycloudy',
      attributes: { temperature: 23.5 },
    },
    'sensor.battery_soc': {
      entity_id: 'sensor.battery_soc',
      state: '86',
      attributes: { unit_of_measurement: '%' },
    },
    'sensor.solar_power': {
      entity_id: 'sensor.solar_power',
      state: '4.1',
      attributes: { unit_of_measurement: 'kW' },
    },
    'lock.front_door': {
      entity_id: 'lock.front_door',
      state: 'locked',
      attributes: { friendly_name: 'Front Door' },
    },
    'climate.office_ac': {
      entity_id: 'climate.office_ac',
      state: 'cool',
      attributes: {
        friendly_name: 'Office Aircon',
        temperature: 25,
        current_temperature: 24.5,
        min_temp: 18,
        max_temp: 28,
      },
    },
    'sensor.office_ac_power': {
      entity_id: 'sensor.office_ac_power',
      state: '100',
      attributes: { unit_of_measurement: 'W' },
    },
    'timer.office_ac_auto_off': {
      entity_id: 'timer.office_ac_auto_off',
      state: 'active',
      attributes: { finishes_at: new Date(STORY_NOW + 5058_000).toISOString() },
    },
    'fan.office_ceiling': {
      entity_id: 'fan.office_ceiling',
      state: 'on',
      attributes: { friendly_name: 'Ceiling Fan', preset_mode: '2' },
    },
  });

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gap = '12px';
  grid.style.maxWidth = '860px';

  const bar = createStatusBar({
    config: {
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
          label: 'Cameras',
          icon: 'mdi:cctv',
          navigate_path: '/office-command/cameras',
        },
      ],
    },
    hass,
    now: FIXED_LOCAL_NOW,
  });

  const body = document.createElement('div');
  body.style.display = 'grid';
  body.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';
  body.style.gap = '12px';
  body.style.alignItems = 'start';

  const climate = createClimatePanel({
    config: {
      entity: 'climate.office_ac',
      name: 'Office Aircon',
      hvac_modes: ['cool', 'heat', 'fan_only'],
      deadline_entity: 'timer.office_ac_auto_off',
      hold_entity: CHANNEL.light,
      hold_text: 'Held · Lights on',
      power_entity: 'sensor.office_ac_power',
    },
    hass,
  });

  const rightCol = document.createElement('div');
  rightCol.style.display = 'grid';
  rightCol.style.gap = '12px';

  const lights = createPresetPanel({
    config: {
      entity: CHANNEL.light,
      name: 'Office Lights',
      presets: LIGHT_PRESETS,
    },
    hass,
  });

  const fan = createPresetPanel({
    config: {
      entity: 'fan.office_ceiling',
      name: 'Ceiling Fan',
      presets: FAN_PRESETS,
    },
    hass,
  });

  rightCol.append(lights, fan);
  body.append(climate, rightCol);
  grid.append(bar, body);
  return grid;
}

const meta: Meta = {
  title: 'Cards/Desk console',
  render: () => buildConsole(),
};
export default meta;

type Story = StoryObj;

async function assertConsole(canvasElement: HTMLElement) {
  const bar = canvasElement.querySelector('dash-status-bar') as StatusBar;
  const climate = canvasElement.querySelector('dash-climate-panel') as ClimatePanel;
  const presets = [...canvasElement.querySelectorAll('dash-preset-panel')] as PresetPanel[];

  await Promise.all([bar.updateComplete, climate.updateComplete, ...presets.map((p) => p.updateComplete)]);

  await expect(bar.shadowRoot?.querySelector('.clock')?.textContent?.trim()).toBe('2:05 PM');
  await expect(climate.shadowRoot?.querySelector('.pill')?.textContent?.trim()).toBe('Cool · 100 W');
  await expect(presets).toHaveLength(2);
  await expect(presets[0].shadowRoot?.querySelector('.pill')?.textContent?.trim()).toBe('Full · Presence');
  await expect(presets[1].shadowRoot?.querySelector('.pill')?.textContent?.trim()).toBe('2');

  // Verify icons rendered via <ha-icon> stand-in and no segmented button labels are clipped.
  for (const card of [climate, ...presets]) {
    const buttons = [...card.shadowRoot!.querySelectorAll<HTMLButtonElement>('.mode-btn, .preset-btn')];
    for (const btn of buttons) {
      await expect(btn.scrollWidth).toBeLessThanOrEqual(btn.clientWidth + 1);
      await expect(btn.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
      const icon = btn.querySelector('ha-icon') as (HTMLElement & { updateComplete?: Promise<unknown> }) | null;
      if (icon) {
        await icon.updateComplete;
        await expect(icon.shadowRoot?.querySelector('svg path')).not.toBeNull();
      }
    }
  }

  await expect(climate.getBoundingClientRect().height).toBeLessThan(175);
  for (const preset of presets) {
    await expect(preset.getBoundingClientRect().height).toBeLessThan(105);
  }
}

export const LightTheme: Story = {
  globals: { theme: 'light' },
  play: async ({ canvasElement }) => {
    await expect(document.documentElement.classList.contains('dark')).toBe(false);
    await assertConsole(canvasElement);
  },
};

export const DarkTheme: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await expect(document.documentElement.classList.contains('dark')).toBe(true);
    await assertConsole(canvasElement);
  },
};
