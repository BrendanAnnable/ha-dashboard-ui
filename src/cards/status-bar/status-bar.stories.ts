import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { fakeHass } from '../../storybook/fixtures';
import { createStatusBar } from '../../storybook/render';
import type { StatusBar, StatusBarChipConfig } from './status-bar';

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

    await step('uses compact tablet spacing and typography', async () => {
      const barEl = root.querySelector<HTMLElement>('.bar')!;
      const clockEl = root.querySelector<HTMLElement>('.clock')!;
      await expect(getComputedStyle(barEl).padding).toBe('8px 14px');
      await expect(getComputedStyle(clockEl).fontSize).toBe('18px');
      for (const chip of chips) {
        await expect(getComputedStyle(chip).fontSize).toBe('12px');
        const rect = chip.getBoundingClientRect();
        await expect(rect.height).toBeGreaterThanOrEqual(30);
        await expect(rect.height).toBeLessThanOrEqual(32);
      }
    });

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

const PRICE_CHIPS: StatusBarChipConfig[] = [
  {
    entity: 'sensor.amber_general_price',
    value_attribute: 'detailedForecast.0.per_kwh',
    icon: 'mdi:arrow-down',
    scale: 100,
    decimals: 0,
    unit: '¢',
    ok_below: 10,
    warn_above: 30,
    danger_above: 45,
    warn_entity: 'binary_sensor.amber_demand_window',
    warn_badge: 'DW',
    badge: {
      attribute: 'estimate',
      equals: false,
      icon: 'mdi:check',
      else_text: 'est',
    },
  },
  {
    entity: 'sensor.amber_feed_in_price',
    value_attribute: 'detailedForecast.0.per_kwh',
    icon: 'mdi:arrow-up',
    scale: 100,
    decimals: 0,
    unit: '¢',
    ok_above: 12,
    danger_below: 0,
    badge: {
      attribute: 'estimate',
      equals: false,
      icon: 'mdi:check',
      else_text: 'est',
    },
  },
];

function buildPriceHass(options: {
  importPerKwh: number;
  importEstimate: boolean;
  exportPerKwh: number;
  exportEstimate: boolean;
  demandWindow: 'on' | 'off';
}) {
  return fakeHass({
    'sensor.amber_general_price': {
      state: String(options.importPerKwh),
      attributes: {
        unit_of_measurement: '$/kWh',
        estimate: options.importEstimate,
        detailedForecast: [{ per_kwh: options.importPerKwh }],
      },
    },
    'sensor.amber_feed_in_price': {
      state: String(options.exportPerKwh),
      attributes: {
        unit_of_measurement: '$/kWh',
        estimate: options.exportEstimate,
        detailedForecast: [{ per_kwh: options.exportPerKwh }],
      },
    },
    'binary_sensor.amber_demand_window': {
      state: options.demandWindow,
    },
  });
}

async function renderedIconPath(iconEl: Element | null): Promise<string> {
  const host = iconEl as (HTMLElement & { updateComplete?: Promise<unknown> }) | null;
  await host?.updateComplete;
  return host?.shadowRoot?.querySelector('svg path')?.getAttribute('d') ?? '';
}

export const EnergyPricesConfirmedAndEstimated: Story = {
  render: () =>
    createStatusBar({
      config: {
        show_clock: true,
        chips: PRICE_CHIPS,
      },
      hass: buildPriceHass({
        importPerKwh: 0.184,
        importEstimate: false,
        exportPerKwh: 0.082,
        exportEstimate: true,
        demandWindow: 'off',
      }),
      now: FIXED_LOCAL_NOW,
    }),
  play: async ({ canvasElement, step }) => {
    const bar = barOf(canvasElement);
    await bar.updateComplete;
    const root = bar.shadowRoot!;
    const chips = [...root.querySelectorAll<HTMLElement>('.chip')];
    await expect(chips).toHaveLength(2);

    await expect(chips[0].getAttribute('data-tone')).toBe('default');
    await expect(chips[0].querySelector('.chip-value')?.textContent?.trim()).toBe('18¢');
    await expect(chips[0].querySelector('.warn-badge')).toBeNull();
    await expect(chips[0].querySelector('.chip-badge')).not.toBeNull();
    await expect(chips[0].querySelector('.chip-badge-muted')).toBeNull();

    await expect(chips[1].getAttribute('data-tone')).toBe('default');
    await expect(chips[1].querySelector('.chip-value')?.textContent?.trim()).toBe('8¢');
    await expect(chips[1].querySelector('.chip-badge')).toBeNull();
    await expect(chips[1].querySelector('.chip-badge-muted')?.textContent?.trim()).toBe('est');

    await step('renders mdi:arrow-down, mdi:arrow-up, and mdi:check stand-in SVG paths', async () => {
      const importIcons = chips[0].querySelectorAll('ha-icon');
      const exportIcons = chips[1].querySelectorAll('ha-icon');
      await expect(importIcons).toHaveLength(2);
      await expect(exportIcons).toHaveLength(1);
      await expect(await renderedIconPath(importIcons[0])).not.toBe('');
      await expect(await renderedIconPath(importIcons[1])).not.toBe('');
      await expect(await renderedIconPath(exportIcons[0])).not.toBe('');
    });
  },
};

export const EnergyPricesCheap: Story = {
  render: () =>
    createStatusBar({
      config: {
        show_clock: true,
        chips: PRICE_CHIPS,
      },
      hass: buildPriceHass({
        importPerKwh: -0.04,
        importEstimate: false,
        exportPerKwh: 0.16,
        exportEstimate: false,
        demandWindow: 'off',
      }),
      now: FIXED_LOCAL_NOW,
    }),
  play: async ({ canvasElement }) => {
    const bar = barOf(canvasElement);
    await bar.updateComplete;
    const chips = [...bar.shadowRoot!.querySelectorAll<HTMLElement>('.chip')];

    await expect(chips[0].getAttribute('data-tone')).toBe('ok');
    await expect(chips[0].querySelector('.chip-value')?.textContent?.trim()).toBe('-4¢');
    await expect(chips[1].getAttribute('data-tone')).toBe('ok');
    await expect(chips[1].querySelector('.chip-value')?.textContent?.trim()).toBe('16¢');
  },
};

export const EnergyPricesDemandWindow: Story = {
  render: () =>
    createStatusBar({
      config: {
        show_clock: true,
        chips: PRICE_CHIPS,
      },
      hass: buildPriceHass({
        importPerKwh: 0.22,
        importEstimate: true,
        exportPerKwh: 0.09,
        exportEstimate: true,
        demandWindow: 'on',
      }),
      now: FIXED_LOCAL_NOW,
    }),
  play: async ({ canvasElement, step }) => {
    const bar = barOf(canvasElement);
    await bar.updateComplete;
    const chips = () => [...bar.shadowRoot!.querySelectorAll<HTMLElement>('.chip')];

    await expect(chips()[0].getAttribute('data-tone')).toBe('warn');
    await expect(chips()[0].querySelector('.chip-value')?.textContent?.trim()).toBe('22¢');
    await expect(chips()[0].querySelector('.warn-badge')?.textContent?.trim()).toBe('DW');
    await expect(chips()[0].querySelector('.chip-badge-muted')?.textContent?.trim()).toBe('est');
    await expect(chips()[1].getAttribute('data-tone')).toBe('default');

    await step('re-renders when only warn_entity changes', async () => {
      bar.hass = {
        ...bar.hass!,
        states: {
          ...bar.hass!.states,
          'binary_sensor.amber_demand_window': {
            ...bar.hass!.states['binary_sensor.amber_demand_window']!,
            state: 'off',
          },
        },
      };
      await bar.updateComplete;
      await expect(chips()[0].getAttribute('data-tone')).toBe('default');
      await expect(chips()[0].querySelector('.warn-badge')).toBeNull();
    });
  },
};

export const EnergyPricesSpike: Story = {
  render: () =>
    createStatusBar({
      config: {
        show_clock: true,
        chips: PRICE_CHIPS,
      },
      hass: buildPriceHass({
        importPerKwh: 0.54,
        importEstimate: false,
        exportPerKwh: -0.03,
        exportEstimate: false,
        demandWindow: 'on',
      }),
      now: FIXED_LOCAL_NOW,
    }),
  play: async ({ canvasElement }) => {
    const bar = barOf(canvasElement);
    await bar.updateComplete;
    const chips = [...bar.shadowRoot!.querySelectorAll<HTMLElement>('.chip')];

    await expect(chips[0].getAttribute('data-tone')).toBe('danger');
    await expect(chips[0].querySelector('.chip-value')?.textContent?.trim()).toBe('54¢');
    await expect(chips[0].querySelector('.warn-badge')?.textContent?.trim()).toBe('DW');
    await expect(chips[0].querySelector('.chip-badge')).not.toBeNull();

    await expect(chips[1].getAttribute('data-tone')).toBe('danger');
    await expect(chips[1].querySelector('.chip-value')?.textContent?.trim()).toBe('-3¢');
  },
};
