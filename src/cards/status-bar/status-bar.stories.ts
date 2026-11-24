import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { fakeHass } from '../../storybook/fixtures';
import { createStatusBar } from '../../storybook/render';
import type { StatusBar } from './status-bar';

const FIXED_LOCAL_NOW = new Date(2026, 0, 1, 14, 5, 0, 0).getTime();

interface Args {
  showClock: boolean;
  timeFormat: '12h' | '24h';
  weatherCondition: string;
  outdoorTemp: number;
  batterySoc: number;
  solarKw: number;
  frontDoorState: 'locked' | 'unlocked';
  co2Ppm: number;
}

function buildHass(args: Args) {
  return fakeHass({
    'weather.home': {
      state: args.weatherCondition,
      attributes: { temperature: args.outdoorTemp },
    },
    'sensor.battery_soc': {
      state: String(args.batterySoc),
      attributes: { unit_of_measurement: '%' },
    },
    'sensor.solar_power': {
      state: String(args.solarKw),
      attributes: { unit_of_measurement: 'kW' },
    },
    'lock.front_door': {
      state: args.frontDoorState,
    },
    'sensor.office_co2': {
      state: String(args.co2Ppm),
      attributes: { unit_of_measurement: 'ppm' },
    },
  });
}

const meta: Meta<Args> = {
  title: 'Cards/Status bar',
  args: {
    showClock: true,
    timeFormat: '12h',
    weatherCondition: 'partlycloudy',
    outdoorTemp: 22.5,
    batterySoc: 84,
    solarKw: 3.4,
    frontDoorState: 'locked',
    co2Ppm: 620,
  },
  argTypes: {
    showClock: { control: 'boolean' },
    timeFormat: { control: 'inline-radio', options: ['12h', '24h'] },
    weatherCondition: {
      control: 'select',
      options: ['sunny', 'partlycloudy', 'cloudy', 'rainy', 'pouring', 'clear-night', 'windy'],
    },
    frontDoorState: { control: 'inline-radio', options: ['locked', 'unlocked'] },
  },
  render: (args) =>
    createStatusBar({
      config: {
        show_clock: args.showClock,
        time_format: args.timeFormat,
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
            label: 'CO₂',
            entity: 'sensor.office_co2',
            warn_above: 1000,
          },
          {
            label: 'Cameras',
            icon: 'mdi:cctv',
            navigate_path: '/office-command/cameras',
          },
        ],
      },
      hass: buildHass(args),
      now: FIXED_LOCAL_NOW,
    }),
};
export default meta;

type Story = StoryObj<Args>;

const barOf = (canvasElement: HTMLElement) => canvasElement.querySelector('dash-status-bar') as StatusBar;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const bar = barOf(canvasElement);
    await bar.updateComplete;
    const root = bar.shadowRoot!;

    await expect(root.querySelector('.clock')?.textContent?.trim()).toBe('2:05 PM');
    await expect(root.querySelector('.date')?.textContent?.trim()).toBe('Thu, 1 Jan');
    await expect(root.querySelector('.weather-temp')?.textContent?.trim()).toBe('22.5°');

    const chips = [...root.querySelectorAll<HTMLElement>('.chip')];
    await expect(chips).toHaveLength(4);
    await expect(chips[0].getAttribute('data-tone')).toBe('default');
    await expect(chips[0].textContent?.replace(/\s+/g, ' ').trim()).toBe('84% · 3.4 kW');
    await expect(chips[1].getAttribute('data-tone')).toBe('ok');
    await expect(chips[1].textContent?.replace(/\s+/g, ' ').trim()).toBe('Front Door · Locked');
    await expect(chips[3].textContent?.replace(/\s+/g, ' ').trim()).toBe('Cameras');

    await step('fires more-info on weather and entity chips and navigates on nav chips', async () => {
      const moreInfoEntities: string[] = [];
      bar.addEventListener('hass-more-info', ((ev: CustomEvent<{ entityId: string }>) => {
        moreInfoEntities.push(ev.detail.entityId);
      }) as EventListener);

      root.querySelector<HTMLButtonElement>('.weather')!.click();
      chips[1].click();
      await expect(moreInfoEntities).toEqual(['weather.home', 'lock.front_door']);

      const previousUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      let locationChanged = false;
      const onLocationChanged = () => {
        locationChanged = true;
      };
      window.addEventListener('location-changed', onLocationChanged);
      try {
        chips[3].click();
        await expect(locationChanged).toBe(true);
        await expect(window.location.pathname).toBe('/office-command/cameras');
      } finally {
        window.removeEventListener('location-changed', onLocationChanged);
        history.replaceState(null, '', previousUrl);
      }
    });
  },
};

export const WarningsActive: Story = {
  args: {
    timeFormat: '24h',
    batterySoc: 14,
    solarKw: 0,
    frontDoorState: 'unlocked',
    co2Ppm: 1280,
  },
  play: async ({ canvasElement }) => {
    const bar = barOf(canvasElement);
    await bar.updateComplete;
    const root = bar.shadowRoot!;

    await expect(root.querySelector('.clock')?.textContent?.trim()).toBe('14:05');
    const chips = [...root.querySelectorAll<HTMLElement>('.chip')];
    await expect(chips[0].getAttribute('data-tone')).toBe('warn');
    await expect(chips[1].getAttribute('data-tone')).toBe('warn');
    await expect(chips[2].getAttribute('data-tone')).toBe('warn');
  },
};

export const ToggleAndStaticChips: Story = {
  render: () =>
    createStatusBar({
      config: {
        show_clock: false,
        chips: [
          {
            label: 'Desk Lamp',
            entity: 'light.desk_lamp',
            icon: 'mdi:lightbulb',
            tap_action: 'toggle',
            ok_state: 'on',
          },
          {
            label: 'Battery',
            entity: 'sensor.battery_soc',
            icon: 'mdi:battery-80',
            tap_action: 'none',
          },
        ],
      },
      hass: fakeHass({
        'light.desk_lamp': { state: 'on' },
        'sensor.battery_soc': { state: '92', attributes: { unit_of_measurement: '%' } },
      }),
      now: FIXED_LOCAL_NOW,
    }),
  play: async ({ canvasElement }) => {
    const bar = barOf(canvasElement);
    await bar.updateComplete;
    const root = bar.shadowRoot!;
    await expect(root.querySelector('.clock')).toBeNull();

    const calls: Array<{ domain: string; service: string; data?: Record<string, unknown> }> = [];
    bar.hass = {
      ...bar.hass!,
      callService: (domain, service, data) => {
        calls.push({ domain, service, data });
      },
    };
    await bar.updateComplete;

    const chips = [...root.querySelectorAll<HTMLElement>('.chip')];
    await expect(chips[0].tagName).toBe('BUTTON');
    await expect(chips[1].tagName).toBe('DIV');
    chips[0].click();
    await expect(calls).toEqual([
      { domain: 'homeassistant', service: 'toggle', data: { entity_id: 'light.desk_lamp' } },
    ]);
  },
};
