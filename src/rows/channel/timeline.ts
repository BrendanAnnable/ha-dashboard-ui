import type { ChannelState } from '../../storybook/fixtures';

/**
 * A scripted motion-light cycle, in seconds from the start. Each event is what
 * the channel firmware reports at that moment; the state holds until the next.
 * Deadlines are absolute (`deadlineAt`), as the firmware publishes them.
 */
export interface TimelineEvent {
  at: number;
  label: string;
  light: ChannelState['light'];
  status: string;
  occupied: 'on' | 'off';
  deadlineAt?: number;
}

export const MOTION_TIMEOUT = 60;
export const FADE = 5;

export const TIMELINE: TimelineEvent[] = [
  { at: 0, label: 'Off', light: 'off', status: 'off', occupied: 'off' },
  { at: 5, label: 'Motion turns the light on', light: 'on', status: 'motion', occupied: 'on' },
  { at: 15, label: 'Still there: presence holds it', light: 'on', status: 'presence', occupied: 'on' },
  {
    at: 40,
    label: 'Room empties: countdown starts',
    light: 'on',
    status: 'timer',
    occupied: 'off',
    deadlineAt: 40 + MOTION_TIMEOUT,
  },
  { at: 70, label: 'Motion again: countdown cancelled', light: 'on', status: 'motion', occupied: 'on' },
  {
    at: 80,
    label: 'Room empties again',
    light: 'on',
    status: 'timer',
    occupied: 'off',
    deadlineAt: 80 + MOTION_TIMEOUT,
  },
  { at: 80 + MOTION_TIMEOUT, label: 'Deadline: fading off', light: 'on', status: 'fading', occupied: 'off' },
  { at: 80 + MOTION_TIMEOUT + FADE, label: 'Off', light: 'off', status: 'off', occupied: 'off' },
];

export const TIMELINE_END = TIMELINE[TIMELINE.length - 1].at + 10;

export function eventAt(t: number): TimelineEvent {
  let current = TIMELINE[0];
  for (const event of TIMELINE) if (event.at <= t) current = event;
  return current;
}

/** The channel's state `t` seconds in, with the deadline relative to that moment. */
export function stateAt(t: number): ChannelState {
  const event = eventAt(t);
  return {
    light: event.light,
    status: event.status,
    occupied: event.occupied,
    deadlineIn: event.deadlineAt === undefined ? undefined : event.deadlineAt - t,
  };
}
