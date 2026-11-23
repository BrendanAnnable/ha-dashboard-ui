import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { fakeHass } from '../../storybook/fixtures';
import { createTile, STORY_NOW, tileCountdownOf, tileSecondaryOf } from '../../storybook/render';
import type { CountdownTile } from './countdown-tile';

/**
 * `custom:dash-countdown-tile` — wraps Home Assistant's built-in tile card and
 * appends a live countdown (or hold label) to its secondary line.
 */
interface Args {
  name: string;
  climateState: string;
  temperature: number;
  source: 'timer' | 'sensor';
  timerState: 'active' | 'idle' | 'paused';
  deadlineIn: number | undefined;
  lightsOn: boolean;
  hideState: boolean;
  countdown_text: string;
  due_text: string;
  hold_text: string;
}

const CLIMATE_FEATURES = [
  { type: 'climate-hvac-modes', hvac_modes: ['off', 'cool', 'heat', 'fan_only'] },
  { type: 'target-temperature' },
];

function buildHass(args: Pick<Args, 'name' | 'climateState' | 'temperature' | 'source' | 'timerState' | 'deadlineIn' | 'lightsOn'>) {
  const iso = args.deadlineIn === undefined ? undefined : new Date(STORY_NOW + args.deadlineIn * 1000).toISOString();
  return fakeHass({
    'climate.office_ac': {
      state: args.climateState,
      name: args.name,
      attributes: {
        temperature: args.temperature,
        hvac_modes: ['off', 'cool', 'heat', 'fan_only'],
      },
    },
    'timer.office_ac_auto_off': {
      state: args.timerState,
      attributes: iso ? { finishes_at: iso } : {},
    },
    'sensor.office_ac_deadline': {
      state: iso ?? 'unknown',
    },
    'binary_sensor.office_lights': {
      state: args.lightsOn ? 'on' : 'off',
    },
  });
}

const meta: Meta<Args> = {
  title: 'Cards/Countdown tile',
  args: {
    name: 'Office AC',
    climateState: 'cool',
    temperature: 22,
    source: 'timer',
    timerState: 'active',
    deadlineIn: 900,
    lightsOn: false,
    hideState: false,
    countdown_text: 'Off in {time}',
    due_text: 'Turning off',
    hold_text: 'Lights on',
  },
  argTypes: {
    climateState: { control: 'select', options: ['cool', 'heat', 'heat_cool', 'fan_only', 'off', 'unavailable'] },
    source: { control: 'inline-radio', options: ['timer', 'sensor'] },
    timerState: { control: 'inline-radio', options: ['active', 'idle', 'paused'] },
    deadlineIn: { control: { type: 'range', min: -90, max: 3600, step: 1 } },
    lightsOn: { control: 'boolean' },
    hideState: { control: 'boolean' },
  },
  render: (args) =>
    createTile({
      config: {
        entity: 'climate.office_ac',
        name: args.name,
        deadline_entity: args.source === 'timer' ? 'timer.office_ac_auto_off' : 'sensor.office_ac_deadline',
        countdown_text: args.countdown_text,
        due_text: args.due_text,
        hold_entity: 'binary_sensor.office_lights',
        hold_text: args.hold_text,
        hide_state: args.hideState,
        features: CLIMATE_FEATURES,
      },
      hass: buildHass(args),
    }),
};
export default meta;

type Story = StoryObj<Args>;

const tileOf = (canvasElement: HTMLElement) => canvasElement.querySelector('dash-countdown-tile') as CountdownTile;

export const CountingDownTimer: Story = {
  name: 'Counting down (timer entity)',
  play: async ({ canvasElement, step }) => {
    const tile = tileOf(canvasElement);
    await expect(await tileCountdownOf(tile)).toBe(' · Off in 15m 00s');
    await expect(await tileSecondaryOf(tile)).toBe('Cool · Off in 15m 00s');
    await expect(tile.getCardSize()).toBe(3);
    await expect(tile.getGridOptions()).toEqual({ columns: 6, min_columns: 3, rows: 3, min_rows: 3 });

    await step('validates required entity and deadline_entity', async () => {
      const probe = document.createElement('dash-countdown-tile') as CountdownTile;
      await expect(() => probe.setConfig({ entity: '', deadline_entity: 'timer.x' })).toThrow(/entity/);
      await expect(() => probe.setConfig({ entity: 'climate.office_ac', deadline_entity: '' })).toThrow(
        /deadline_entity/,
      );
    });

    await step('uses window.loadCardHelpers and ignores superseded setConfig calls', async () => {
      const win = window as {
        loadCardHelpers?: () => Promise<{ createCardElement: (c: Record<string, unknown>) => HTMLElement }>;
      };
      const previous = win.loadCardHelpers;
      const resolvers: Array<() => void> = [];
      const createdConfigs: Record<string, unknown>[] = [];
      win.loadCardHelpers = () =>
        new Promise((resolve) => {
          resolvers.push(() =>
            resolve({
              createCardElement: (config) => {
                createdConfigs.push(config);
                const inner = document.createElement('hui-tile-card') as HTMLElement & {
                  setConfig: (c: Record<string, unknown>) => void;
                };
                inner.setConfig(config);
                return inner;
              },
            }),
          );
        });

      const probe = document.createElement('dash-countdown-tile') as CountdownTile;
      canvasElement.append(probe);
      try {
        probe.now = () => STORY_NOW;
        probe.setConfig({
          type: 'custom:dash-countdown-tile',
          entity: 'climate.office_ac',
          name: 'Stale Name',
          deadline_entity: 'timer.office_ac_auto_off',
          hold_entity: 'binary_sensor.office_lights',
          hold_text: 'Lights on',
        });
        probe.setConfig({
          type: 'custom:dash-countdown-tile',
          entity: 'climate.office_ac',
          name: 'Final Name',
          deadline_entity: 'timer.office_ac_auto_off',
        });
        probe.hass = fakeHass({
          'climate.office_ac': { state: 'cool', name: 'Office AC' },
          'timer.office_ac_auto_off': {
            state: 'active',
            attributes: { finishes_at: new Date(STORY_NOW + 65_000).toISOString() },
          },
        });

        // Resolve the first (superseded) load first, then the second.
        resolvers[0]();
        await Promise.resolve();
        await expect(createdConfigs).toHaveLength(0);

        resolvers[1]();
        await new Promise((r) => setTimeout(r, 0));
        await probe.updateComplete;

        await expect(createdConfigs).toEqual([{ type: 'tile', entity: 'climate.office_ac', name: 'Final Name' }]);
        await expect(await tileCountdownOf(probe)).toBe(' · Off in 1m 05s');
      } finally {
        probe.remove();
        win.loadCardHelpers = previous;
      }
    });
  },
};

export const TurningOff: Story = {
  args: { deadlineIn: -5 },
  play: async ({ canvasElement }) => {
    const tile = tileOf(canvasElement);
    await expect(await tileCountdownOf(tile)).toBe(' · Turning off');
    await expect(await tileSecondaryOf(tile)).toBe('Cool · Turning off');
  },
};

export const HeldByLights: Story = {
  args: { timerState: 'idle', deadlineIn: undefined, lightsOn: true },
  play: async ({ canvasElement }) => {
    const tile = tileOf(canvasElement);
    await expect(await tileCountdownOf(tile)).toBe(' · Lights on');
    await expect(await tileSecondaryOf(tile)).toBe('Cool · Lights on');
  },
};

export const AirconOff: Story = {
  args: { climateState: 'off', timerState: 'active', deadlineIn: 600, lightsOn: true },
  play: async ({ canvasElement }) => {
    const tile = tileOf(canvasElement);
    await expect(await tileCountdownOf(tile)).toBe('');
    await expect(await tileSecondaryOf(tile)).toBe('Off');
  },
};

export const TimestampSensor: Story = {
  name: 'Counting down (timestamp sensor)',
  args: { source: 'sensor', deadlineIn: 185 },
  play: async ({ canvasElement }) => {
    const tile = tileOf(canvasElement);
    await expect(await tileCountdownOf(tile)).toBe(' · Off in 3m 05s');
    await expect(await tileSecondaryOf(tile)).toBe('Cool · Off in 3m 05s');
  },
};

export const HideState: Story = {
  args: { hideState: true, deadlineIn: 95 },
  play: async ({ canvasElement }) => {
    const tile = tileOf(canvasElement);
    await expect(await tileCountdownOf(tile)).toBe('Off in 1m 35s');
    await expect(await tileSecondaryOf(tile)).toBe('Off in 1m 35s');
  },
};

/** Transitions from `<hui-warning>` (missing entity) to `<ha-card>` and re-attaches the countdown span. */
export const RecoversFromWarning: Story = {
  render: () =>
    createTile({
      config: {
        entity: 'climate.office_ac',
        name: 'Office AC',
        deadline_entity: 'timer.office_ac_auto_off',
      },
      hass: fakeHass({
        'timer.office_ac_auto_off': {
          state: 'active',
          attributes: { finishes_at: new Date(STORY_NOW + 300_000).toISOString() },
        },
      }),
    }),
  play: async ({ canvasElement }) => {
    const tile = tileOf(canvasElement);
    await tile.updateComplete;
    const inner = tile.shadowRoot!.querySelector('hui-tile-card')!;
    await expect(inner.shadowRoot!.querySelector('hui-warning')).not.toBeNull();
    await expect(await tileCountdownOf(tile)).toBe('');

    tile.hass = fakeHass({
      'climate.office_ac': { state: 'cool', name: 'Office AC' },
      'timer.office_ac_auto_off': {
        state: 'active',
        attributes: { finishes_at: new Date(STORY_NOW + 300_000).toISOString() },
      },
    });
    await expect(await tileCountdownOf(tile)).toBe(' · Off in 5m 00s');
    await expect(await tileSecondaryOf(tile)).toBe('Cool · Off in 5m 00s');
  },
};

/** Verifies ticks update only the countdown span without re-rendering the inner tile card. */
export const LiveTick: Story = {
  render: () => {
    let clock = STORY_NOW;
    const tile = createTile({
      config: {
        entity: 'climate.office_ac',
        name: 'Office AC',
        deadline_entity: 'timer.office_ac_auto_off',
      },
      hass: fakeHass({
        'climate.office_ac': { state: 'cool', name: 'Office AC' },
        'timer.office_ac_auto_off': {
          state: 'active',
          attributes: { finishes_at: new Date(STORY_NOW + 2000).toISOString() },
        },
      }),
      now: clock,
    });
    tile.now = () => clock;
    (tile as CountdownTile & { _advanceClock?: (ms: number) => void })._advanceClock = (ms: number) => {
      clock += ms;
    };
    return tile;
  },
  play: async ({ canvasElement }) => {
    const tile = tileOf(canvasElement) as CountdownTile & { _advanceClock: (ms: number) => void };
    await expect(await tileCountdownOf(tile)).toBe(' · Off in 2s');

    const inner = tile.shadowRoot!.querySelector('hui-tile-card') as HTMLElement & {
      render: () => unknown;
    };
    let innerRenders = 0;
    const originalRender = inner.render.bind(inner);
    inner.render = () => {
      innerRenders++;
      return originalRender();
    };

    tile._advanceClock(1000);
    await new Promise((resolve) => setTimeout(resolve, 1150));
    await expect(await tileCountdownOf(tile)).toBe(' · Off in 1s');
    await expect(innerRenders).toBe(0);

    tile._advanceClock(1000);
    await new Promise((resolve) => setTimeout(resolve, 1150));
    await expect(await tileCountdownOf(tile)).toBe(' · Turning off');
    await expect(innerRenders).toBe(0);
  },
};
