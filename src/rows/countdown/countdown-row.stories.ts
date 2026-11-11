import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { fakeHass } from '../../storybook/fixtures';
import { card, createRow, secondaryOf, STORY_NOW } from '../../storybook/render';

/**
 * `custom:dash-countdown-row` — any entity with a timestamp sensor saying when
 * something next happens. The second line counts down to it.
 */
interface Args {
  entity: string;
  state: string;
  name: string;
  deadlineIn: number | undefined;
  countdown_text: string;
  due_text: string;
}

const meta: Meta<Args> = {
  title: 'Rows/Countdown row',
  args: {
    entity: 'switch.towel_rail',
    state: 'on',
    name: 'Towel rail',
    deadlineIn: 1500,
    countdown_text: 'Off in {time}',
    due_text: 'Turning off',
  },
  argTypes: {
    deadlineIn: { control: { type: 'range', min: -90, max: 3600, step: 1 } },
  },
  render: ({ entity, state, name, deadlineIn, countdown_text, due_text }) =>
    card(undefined, [
      createRow({
        tag: 'dash-countdown-row',
        config: { entity, name, deadline_entity: 'sensor.deadline', countdown_text, due_text },
        hass: fakeHass({
          [entity]: { state, name },
          'sensor.deadline': {
            state: deadlineIn === undefined ? 'unknown' : new Date(STORY_NOW + deadlineIn * 1000).toISOString(),
          },
        }),
      }),
    ]),
};
export default meta;

type Story = StoryObj<Args>;

const says = (text: string): Story['play'] => async ({ canvasElement }) => {
  await expect(await secondaryOf(canvasElement.querySelector('dash-countdown-row')!)).toBe(text);
};

export const CountingDown: Story = { play: says('Off in 25m 00s') };

export const NoDeadline: Story = { args: { deadlineIn: undefined }, play: says('') };

export const Due: Story = { args: { deadlineIn: -5 }, play: says('Turning off') };

/** A lock that relocks itself: the entity has no on/off, so its state shows instead of a toggle. */
export const DoorRelock: Story = {
  args: {
    entity: 'lock.front_door',
    state: 'unlocked',
    name: 'Front door',
    deadlineIn: 95,
    countdown_text: 'Locks in {time}',
    due_text: 'Locking',
  },
  play: async (context) => {
    await says('Locks in 1m 35s')!(context);
    const row = context.canvasElement.querySelector('dash-countdown-row')!;
    await expect(row.shadowRoot!.querySelector('ha-entity-toggle')).toBeNull();
    await expect(row.shadowRoot!.querySelector('.text-content')?.textContent?.trim()).toBe('Unlocked');
  },
};
