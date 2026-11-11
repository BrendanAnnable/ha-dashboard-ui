import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { CHANNEL, channelHass, type ChannelState } from '../../storybook/fixtures';
import { card, createRow, secondaryOf, STORY_NOW } from '../../storybook/render';
import './timeline-player';

/**
 * `custom:dash-channel-row` — a light or relay run by a motion-controlled
 * channel. Each story pins one state; **Timeline** plays them in order.
 */
interface Args extends ChannelState {
  name: string;
  icon: string;
  countdown_text: string;
  due_text: string;
}

const meta: Meta<Args> = {
  title: 'Rows/Channel row',
  args: {
    name: 'Hallway lights',
    icon: '',
    light: 'on',
    status: 'timer',
    occupied: 'off',
    deadlineIn: 192,
    countdown_text: 'Off in {time}',
    due_text: 'Turning off',
  },
  argTypes: {
    light: { control: 'inline-radio', options: ['on', 'off', 'unavailable'] },
    status: {
      control: 'select',
      options: ['off', 'on', 'motion', 'presence', 'timer', 'fading', 'unknown', 'unavailable'],
      description: 'The channel’s Status sensor',
    },
    occupied: { control: 'inline-radio', options: ['on', 'off'] },
    deadlineIn: {
      control: { type: 'range', min: -90, max: 600, step: 1 },
      description: 'Seconds until the Motion Off Deadline (negative once passed)',
    },
    icon: { control: 'text', description: 'e.g. mdi:ceiling-light' },
  },
  render: ({ name, icon, countdown_text, due_text, ...state }) =>
    card(undefined, [
      createRow({
        tag: 'dash-channel-row',
        config: { entity: CHANNEL.light, name, icon: icon || undefined, countdown_text, due_text },
        hass: channelHass(state, STORY_NOW),
      }),
    ]),
};
export default meta;

type Story = StoryObj<Args>;

const says = (text: string): Story['play'] => async ({ canvasElement }) => {
  const row = canvasElement.querySelector('dash-channel-row')!;
  await expect(await secondaryOf(row)).toBe(text);
};

export const Off: Story = { args: { light: 'off', status: 'off', deadlineIn: undefined }, play: says('') };

export const OnByHand: Story = {
  name: 'On by hand (no timer)',
  args: { status: 'on', deadlineIn: undefined },
  play: says(''),
};

export const Motion: Story = { args: { status: 'motion', occupied: 'on', deadlineIn: undefined }, play: says('Motion') };

export const Presence: Story = {
  args: { status: 'presence', occupied: 'on', deadlineIn: undefined },
  play: says('Presence'),
};

export const CountingDown: Story = { args: { status: 'timer', deadlineIn: 192 }, play: says('Off in 3m 12s') };

export const LastSeconds: Story = { args: { status: 'timer', deadlineIn: 9 }, play: says('Off in 9s') };

export const TurningOff: Story = { args: { status: 'timer', deadlineIn: -2 }, play: says('Turning off') };

export const FadingOff: Story = { args: { status: 'fading', deadlineIn: -1 }, play: says('Fading off') };

export const Unavailable: Story = {
  args: { light: 'unavailable', status: 'unavailable', deadlineIn: undefined },
  play: says(''),
};

export const NoStatusSensor: Story = {
  name: 'No usable status (occupancy fallback)',
  args: { status: 'unavailable', occupied: 'on', deadlineIn: 120 },
  play: says('Motion'),
};

export const CustomText: Story = {
  args: { countdown_text: 'Auto-off in {time}', deadlineIn: 45 },
  play: says('Auto-off in 45s'),
};

/** A light on another device that follows a channel, like a Zigbee strip on a relay's channel. */
export const FollowsAnotherChannel: Story = {
  render: () =>
    card(undefined, [
      createRow({
        tag: 'dash-channel-row',
        config: { entity: 'light.reading_lamp', channel_entity: CHANNEL.light, icon: 'mdi:led-strip-variant' },
        hass: channelHass({ light: 'on', status: 'timer', deadlineIn: 75 }, STORY_NOW),
      }),
    ]),
  play: async ({ canvasElement }) => {
    await expect(await secondaryOf(canvasElement.querySelector('dash-channel-row')!)).toBe('Off in 1m 15s');
  },
};

/** Every state at once, as a room card would show several channels. */
export const AllStates: Story = {
  render: () => {
    const rows: [string, string, ChannelState][] = [
      ['Off', 'mdi:ceiling-light', { light: 'off', status: 'off' }],
      ['On by hand', 'mdi:ceiling-light', { light: 'on', status: 'on' }],
      ['Motion', 'mdi:ceiling-light', { light: 'on', status: 'motion', occupied: 'on' }],
      ['Presence', 'mdi:ceiling-light', { light: 'on', status: 'presence', occupied: 'on' }],
      ['Counting down', 'mdi:ceiling-light', { light: 'on', status: 'timer', deadlineIn: 192 }],
      ['Last seconds', 'mdi:ceiling-light', { light: 'on', status: 'timer', deadlineIn: 9 }],
      ['Turning off', 'mdi:ceiling-light', { light: 'on', status: 'timer', deadlineIn: -2 }],
      ['Fading off', 'mdi:ceiling-light', { light: 'on', status: 'fading' }],
      ['Unavailable', 'mdi:ceiling-light', { light: 'unavailable', status: 'unavailable' }],
    ];
    return card(
      'Hallway',
      rows.map(([name, icon, state]) =>
        createRow({
          tag: 'dash-channel-row',
          config: { entity: CHANNEL.light, name, icon },
          hass: channelHass(state, STORY_NOW),
        }),
      ),
    );
  },
};

/**
 * A motion light's whole cycle: off, motion, presence, a countdown that motion
 * interrupts, a second countdown, the fade, and off again. Drag the slider or
 * press play.
 */
export const Timeline: Story = {
  render: () => document.createElement('channel-timeline-player'),
  play: async ({ canvasElement, step }) => {
    const player = canvasElement.querySelector('channel-timeline-player') as HTMLElement & {
      time: number;
      updateComplete: Promise<unknown>;
    };
    const row = () => player.shadowRoot!.querySelector('dash-channel-row')!;
    const expected: [number, string][] = [
      [0, ''],
      [10, 'Motion'],
      [20, 'Presence'],
      [41, 'Off in 59s'],
      [69, 'Off in 31s'],
      [75, 'Motion'],
      [80, 'Off in 1m 00s'],
      [139, 'Off in 1s'],
      [142, 'Fading off'],
      [150, ''],
    ];
    for (const [t, text] of expected) {
      await step(`${t}s: ${text || '(nothing)'}`, async () => {
        player.time = t;
        await player.updateComplete;
        await expect(await secondaryOf(row())).toBe(text);
      });
    }
    player.time = 0;
  },
};
