import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { fakeHass } from '../../storybook/fixtures';
import { createClimatePanel, STORY_NOW } from '../../storybook/render';
import type { ClimatePanel } from './climate-panel';

interface Args {
  name: string;
  mode: string;
  temperature: number;
  currentTemp: number;
  powerW: number;
  timerState: 'active' | 'idle';
  deadlineIn: number | undefined;
  lightsOn: boolean;
  hvacModes: string[];
}

function buildHass(args: Args, callService?: (domain: string, service: string, data?: Record<string, unknown>) => void) {
  const iso = args.deadlineIn === undefined ? undefined : new Date(STORY_NOW + args.deadlineIn * 1000).toISOString();
  return fakeHass(
    {
      'climate.office_ac': {
        state: args.mode,
        name: args.name,
        attributes: {
          temperature: args.temperature,
          current_temperature: args.currentTemp,
          min_temp: 18,
          max_temp: 28,
          target_temp_step: 1,
        },
      },
      'sensor.office_ac_power': {
        state: String(args.powerW),
        attributes: { unit_of_measurement: 'W' },
      },
      'timer.office_ac_auto_off': {
        state: args.timerState,
        attributes: iso ? { finishes_at: iso } : {},
      },
      'light.office_lights': {
        state: args.lightsOn ? 'on' : 'off',
      },
    },
    { callService },
  );
}

const meta: Meta<Args> = {
  title: 'Cards/Climate panel',
  args: {
    name: 'Office Aircon',
    mode: 'cool',
    temperature: 25,
    currentTemp: 24.5,
    powerW: 100,
    timerState: 'active',
    deadlineIn: 5058,
    lightsOn: false,
    hvacModes: ['cool', 'heat', 'dry', 'fan_only'],
  },
  argTypes: {
    mode: { control: 'select', options: ['off', 'cool', 'heat', 'dry', 'fan_only', 'auto', 'unavailable'] },
    temperature: { control: { type: 'range', min: 18, max: 28, step: 1 } },
    currentTemp: { control: { type: 'range', min: 16, max: 32, step: 0.5 } },
    powerW: { control: { type: 'range', min: 0, max: 2000, step: 10 } },
    timerState: { control: 'inline-radio', options: ['active', 'idle'] },
    deadlineIn: { control: { type: 'range', min: -90, max: 7200, step: 1 } },
    lightsOn: { control: 'boolean' },
  },
  render: (args) => {
    const wrap = document.createElement('div');
    wrap.style.maxWidth = '420px';
    wrap.append(
      createClimatePanel({
        config: {
          entity: 'climate.office_ac',
          name: args.name,
          hvac_modes: args.hvacModes,
          deadline_entity: 'timer.office_ac_auto_off',
          hold_entity: 'light.office_lights',
          hold_text: 'Held · Lights on',
          power_entity: 'sensor.office_ac_power',
        },
        hass: buildHass(args),
      }),
    );
    return wrap;
  },
};
export default meta;

type Story = StoryObj<Args>;

const panelOf = (canvasElement: HTMLElement) => canvasElement.querySelector('dash-climate-panel') as ClimatePanel;

export const CoolingWithCountdown: Story = {
  play: async ({ canvasElement, step }) => {
    const panel = panelOf(canvasElement);
    await panel.updateComplete;
    const root = panel.shadowRoot!;

    await expect(root.querySelector('.title')?.textContent?.trim()).toBe('Office Aircon');
    await expect(root.querySelector('.pill')?.textContent?.trim()).toBe('Cool · 100 W');
    await expect(root.querySelector('.target')?.textContent?.trim()).toBe('25°');
    await expect(root.querySelector('.room')?.textContent?.trim()).toBe('Room 24.5°');
    await expect(root.querySelector('.status')?.textContent?.trim()).toBe('Off in 84m 18s');

    await step('renders tactile stepper buttons at >= 42px hit target', async () => {
      const buttons = [...root.querySelectorAll<HTMLButtonElement>('.step-btn')];
      await expect(buttons).toHaveLength(2);
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        await expect(rect.width).toBeGreaterThanOrEqual(42);
        await expect(rect.height).toBeGreaterThanOrEqual(42);
      }
    });

    await step('calls climate services on stepper and mode clicks and fires more-info on header click', async () => {
      const calls: Array<{ domain: string; service: string; data?: Record<string, unknown> }> = [];
      panel.hass = {
        ...panel.hass!,
        callService: (domain, service, data) => {
          calls.push({ domain, service, data });
        },
      };
      await panel.updateComplete;

      root.querySelector<HTMLButtonElement>('button[aria-label="Decrease temperature"]')!.click();
      root.querySelector<HTMLButtonElement>('button[aria-label="Increase temperature"]')!.click();
      root.querySelector<HTMLButtonElement>('button[data-mode="heat"]')!.click();

      await expect(calls).toEqual([
        { domain: 'climate', service: 'set_temperature', data: { entity_id: 'climate.office_ac', temperature: 24 } },
        { domain: 'climate', service: 'set_temperature', data: { entity_id: 'climate.office_ac', temperature: 26 } },
        { domain: 'climate', service: 'set_hvac_mode', data: { entity_id: 'climate.office_ac', hvac_mode: 'heat' } },
      ]);

      let moreInfoEntity: string | undefined;
      panel.addEventListener('hass-more-info', ((ev: CustomEvent<{ entityId: string }>) => {
        moreInfoEntity = ev.detail.entityId;
      }) as EventListener);
      root.querySelector<HTMLButtonElement>('.header')!.click();
      await expect(moreInfoEntity).toBe('climate.office_ac');
    });

    await step('validates required entity config', async () => {
      const probe = document.createElement('dash-climate-panel') as ClimatePanel;
      await expect(() => probe.setConfig({ entity: '' })).toThrow(/entity/);
    });
  },
};

export const HeldByLights: Story = {
  args: { timerState: 'idle', deadlineIn: undefined, lightsOn: true, powerW: 420 },
  play: async ({ canvasElement }) => {
    const panel = panelOf(canvasElement);
    await panel.updateComplete;
    const root = panel.shadowRoot!;
    await expect(root.querySelector('.pill')?.textContent?.trim()).toBe('Cool · 420 W');
    await expect(root.querySelector('.status')?.textContent?.trim()).toBe('Held · Lights on');
  },
};

export const Heating: Story = {
  args: { mode: 'heat', temperature: 22, currentTemp: 19.5, powerW: 850, deadlineIn: -5 },
  play: async ({ canvasElement }) => {
    const panel = panelOf(canvasElement);
    await panel.updateComplete;
    const root = panel.shadowRoot!;
    await expect(root.querySelector('.pill')?.textContent?.trim()).toBe('Heat · 850 W');
    await expect(root.querySelector('.status')?.textContent?.trim()).toBe('Turning off');
    await expect(root.querySelector('button[data-mode="heat"]')?.getAttribute('aria-pressed')).toBe('true');
  },
};

export const Off: Story = {
  args: { mode: 'off', powerW: 2, lightsOn: true },
  play: async ({ canvasElement }) => {
    const panel = panelOf(canvasElement);
    await panel.updateComplete;
    const root = panel.shadowRoot!;
    await expect(root.querySelector('.pill')?.textContent?.trim()).toBe('Off');
    await expect(root.querySelector('.target')?.textContent?.trim()).toBe('Off');
    await expect(root.querySelector('.status')).toBeNull();
    await expect(root.querySelector<HTMLButtonElement>('button[aria-label="Decrease temperature"]')?.disabled).toBe(true);
    await expect(root.querySelector<HTMLButtonElement>('button[aria-label="Increase temperature"]')?.disabled).toBe(true);
  },
};

export const LiveTick: Story = {
  render: () => {
    let clock = STORY_NOW;
    const wrap = document.createElement('div');
    wrap.style.maxWidth = '420px';
    const panel = createClimatePanel({
      config: {
        entity: 'climate.office_ac',
        name: 'Office Aircon',
        deadline_entity: 'timer.office_ac_auto_off',
      },
      hass: fakeHass({
        'climate.office_ac': {
          state: 'cool',
          name: 'Office Aircon',
          attributes: { temperature: 24, current_temperature: 24 },
        },
        'timer.office_ac_auto_off': {
          state: 'active',
          attributes: { finishes_at: new Date(STORY_NOW + 2000).toISOString() },
        },
      }),
      now: clock,
    });
    panel.now = () => clock;
    (panel as ClimatePanel & { _advanceClock?: (ms: number) => void })._advanceClock = (ms: number) => {
      clock += ms;
    };
    wrap.append(panel);
    return wrap;
  },
  play: async ({ canvasElement }) => {
    const panel = panelOf(canvasElement) as ClimatePanel & { _advanceClock: (ms: number) => void };
    await panel.updateComplete;
    const root = panel.shadowRoot!;
    await expect(root.querySelector('.status')?.textContent?.trim()).toBe('Off in 2s');

    panel._advanceClock(1000);
    await new Promise((r) => setTimeout(r, 1150));
    await panel.updateComplete;
    await expect(root.querySelector('.status')?.textContent?.trim()).toBe('Off in 1s');

    panel._advanceClock(1000);
    await new Promise((r) => setTimeout(r, 1150));
    await panel.updateComplete;
    await expect(root.querySelector('.status')?.textContent?.trim()).toBe('Turning off');
  },
};
