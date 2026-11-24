import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { CHANNEL, channelHass, fakeHass } from '../../storybook/fixtures';
import { createPresetPanel, STORY_NOW } from '../../storybook/render';
import type { PresetItem, PresetPanel } from './preset-panel';

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

interface Args {
  lightState: 'on' | 'off';
  brightness: number;
  channelStatus: 'presence' | 'motion' | 'timer' | 'fading' | 'on';
  deadlineIn: number;
}

const meta: Meta<Args> = {
  title: 'Cards/Preset panel',
  args: {
    lightState: 'on',
    brightness: 255,
    channelStatus: 'presence',
    deadlineIn: 252,
  },
  argTypes: {
    lightState: { control: 'inline-radio', options: ['on', 'off'] },
    brightness: { control: { type: 'range', min: 1, max: 255, step: 1 } },
    channelStatus: { control: 'select', options: ['presence', 'motion', 'timer', 'fading', 'on'] },
    deadlineIn: { control: { type: 'range', min: -30, max: 900, step: 1 } },
  },
  render: (args) => {
    const hass = channelHass(
      {
        light: args.lightState,
        status: args.channelStatus,
        occupied: args.channelStatus === 'presence' || args.channelStatus === 'motion' ? 'on' : 'off',
        deadlineIn: args.deadlineIn,
      },
      STORY_NOW,
    );
    hass.states[CHANNEL.light]!.attributes.brightness = args.brightness;

    const wrap = document.createElement('div');
    wrap.style.maxWidth = '420px';
    wrap.append(
      createPresetPanel({
        config: {
          entity: CHANNEL.light,
          name: 'Office Lights',
          presets: LIGHT_PRESETS,
        },
        hass,
      }),
    );
    return wrap;
  },
};
export default meta;

type Story = StoryObj<Args>;

const panelOf = (canvasElement: HTMLElement) => canvasElement.querySelector('dash-preset-panel') as PresetPanel;

export const LightsPresence: Story = {
  play: async ({ canvasElement, step }) => {
    const panel = panelOf(canvasElement);
    await panel.updateComplete;
    const root = panel.shadowRoot!;

    await expect(root.querySelector('.title')?.textContent?.trim()).toBe('Office Lights');
    await expect(root.querySelector('.pill')?.textContent?.trim()).toBe('Full · Presence');

    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.preset-btn')];
    await expect(buttons).toHaveLength(4);
    await expect(buttons[3].getAttribute('aria-pressed')).toBe('true');

    for (const btn of buttons) {
      await expect(btn.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
    }
    await expect(panel.getBoundingClientRect().height).toBeLessThan(105);

    await step('calls configured service with merged data and opens more-info from header', async () => {
      const calls: Array<{ domain: string; service: string; data?: Record<string, unknown> }> = [];
      panel.hass = {
        ...panel.hass!,
        callService: (domain, service, data) => {
          calls.push({ domain, service, data });
        },
      };
      await panel.updateComplete;

      buttons[1].click();
      buttons[0].click();

      await expect(calls).toEqual([
        {
          domain: 'light',
          service: 'turn_on',
          data: { entity_id: CHANNEL.light, brightness_pct: 15 },
        },
        {
          domain: 'light',
          service: 'turn_off',
          data: { entity_id: CHANNEL.light },
        },
      ]);

      let moreInfoEntity: string | undefined;
      panel.addEventListener('hass-more-info', ((ev: CustomEvent<{ entityId: string }>) => {
        moreInfoEntity = ev.detail.entityId;
      }) as EventListener);
      root.querySelector<HTMLButtonElement>('.header')!.click();
      await expect(moreInfoEntity).toBe(CHANNEL.light);
    });

    await step('validates entity and non-empty presets', async () => {
      const probe = document.createElement('dash-preset-panel') as PresetPanel;
      await expect(() => probe.setConfig({ entity: '', presets: LIGHT_PRESETS })).toThrow(/entity/);
      await expect(() => probe.setConfig({ entity: 'light.a', presets: [] })).toThrow(/presets/);
    });
  },
};

export const LightsCountingDown: Story = {
  args: { brightness: 128, channelStatus: 'timer', deadlineIn: 252 },
  play: async ({ canvasElement }) => {
    const panel = panelOf(canvasElement);
    await panel.updateComplete;
    const root = panel.shadowRoot!;
    await expect(root.querySelector('.pill')?.textContent?.trim()).toBe('Dim · Off in 4m 12s');
  },
};

export const CeilingFan: Story = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.maxWidth = '420px';
    wrap.append(
      createPresetPanel({
        config: {
          entity: 'fan.office_ceiling',
          name: 'Ceiling Fan',
          presets: FAN_PRESETS,
        },
        hass: fakeHass({
          'fan.office_ceiling': {
            state: 'on',
            name: 'Ceiling Fan',
            attributes: { preset_mode: '2' },
          },
        }),
      }),
    );
    return wrap;
  },
  play: async ({ canvasElement }) => {
    const panel = panelOf(canvasElement);
    await panel.updateComplete;
    const root = panel.shadowRoot!;
    await expect(root.querySelector('.pill')?.textContent?.trim()).toBe('2');

    const calls: Array<{ domain: string; service: string; data?: Record<string, unknown> }> = [];
    panel.hass = {
      ...panel.hass!,
      callService: (domain, service, data) => {
        calls.push({ domain, service, data });
      },
    };
    await panel.updateComplete;

    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.preset-btn')];
    await expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
    buttons[3].click();
    await expect(calls).toEqual([
      {
        domain: 'fan',
        service: 'set_preset_mode',
        data: { entity_id: 'fan.office_ceiling', preset_mode: '3' },
      },
    ]);
  },
};

export const LiveCountdownTick: Story = {
  render: () => {
    let clock = STORY_NOW;
    const hass = channelHass({ light: 'on', status: 'timer', deadlineIn: 2 }, STORY_NOW);
    hass.states[CHANNEL.light]!.attributes.brightness = 255;

    const wrap = document.createElement('div');
    wrap.style.maxWidth = '420px';
    const panel = createPresetPanel({
      config: {
        entity: CHANNEL.light,
        name: 'Office Lights',
        presets: LIGHT_PRESETS,
      },
      hass,
      now: clock,
    });
    panel.now = () => clock;
    (panel as PresetPanel & { _advanceClock?: (ms: number) => void })._advanceClock = (ms: number) => {
      clock += ms;
    };
    wrap.append(panel);
    return wrap;
  },
  play: async ({ canvasElement }) => {
    const panel = panelOf(canvasElement) as PresetPanel & { _advanceClock: (ms: number) => void };
    await panel.updateComplete;
    const root = panel.shadowRoot!;
    await expect(root.querySelector('.pill')?.textContent?.trim()).toBe('Full · Off in 2s');

    panel._advanceClock(1000);
    await new Promise((r) => setTimeout(r, 1150));
    await panel.updateComplete;
    await expect(root.querySelector('.pill')?.textContent?.trim()).toBe('Full · Off in 1s');
  },
};
