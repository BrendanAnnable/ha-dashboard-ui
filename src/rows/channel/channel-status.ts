import { countdownAt, countdownText, type CountdownText } from '../../core/countdown';
import { findSibling, type SiblingRole } from '../../core/discover';
import type { Hass } from '../../core/hass';

export const ROLES = {
  deadline: { name: 'Motion Off Deadline', suffix: 'motion_off_deadline', domains: ['sensor'] },
  occupied: { name: 'Occupied', suffix: 'occupied', domains: ['binary_sensor'] },
  status: { name: 'Status', suffix: 'status', domains: ['sensor'] },
} satisfies Record<string, SiblingRole>;

export interface ChannelEntities {
  deadline?: string;
  occupied?: string;
  status?: string;
}

export interface ChannelOverrides {
  /** The entity whose device carries the channel's sensors. Defaults to the row's entity. */
  channel_entity?: string;
  deadline_entity?: string;
  occupied_entity?: string;
  status_entity?: string;
}

/** Explicit keys win; anything left out is found on the channel's device. */
export function resolveChannel(hass: Hass, entity: string, overrides: ChannelOverrides): ChannelEntities {
  const source = overrides.channel_entity ?? entity;
  return {
    deadline: overrides.deadline_entity ?? findSibling(hass, source, ROLES.deadline),
    occupied: overrides.occupied_entity ?? findSibling(hass, source, ROLES.occupied),
    status: overrides.status_entity ?? findSibling(hass, source, ROLES.status),
  };
}

/** What the channel firmware reports in its Status sensor. */
export type ChannelStatus = 'off' | 'on' | 'motion' | 'presence' | 'timer' | 'fading';

const STATUS_TEXT: Partial<Record<ChannelStatus, string>> = {
  motion: 'Motion',
  presence: 'Presence',
  fading: 'Fading off',
};

const KNOWN = new Set<string>(['off', 'on', 'motion', 'presence', 'timer', 'fading']);

/**
 * The second line for a motion-controlled channel.
 *
 * Only an entity that is on says anything. The channel's Status sensor decides
 * between Motion, Presence, Fading off and the countdown. Without a usable
 * status, occupancy stands in for Motion and the deadline for the rest.
 */
export function channelLine(
  hass: Hass,
  entity: string,
  channel: ChannelEntities,
  text: CountdownText,
  now: number,
): { text: string; ticking: boolean } {
  const silent = { text: '', ticking: false };
  if (hass.states[entity]?.state !== 'on') return silent;

  const status = channel.status ? hass.states[channel.status]?.state : undefined;
  const known = status !== undefined && KNOWN.has(status);

  const fixed = known ? STATUS_TEXT[status as ChannelStatus] : undefined;
  if (fixed) return { text: fixed, ticking: false };
  if (!known && channel.occupied && hass.states[channel.occupied]?.state === 'on') {
    return { text: STATUS_TEXT.motion!, ticking: false };
  }

  const countdown = countdownAt(channel.deadline ? hass.states[channel.deadline]?.state : undefined, now);
  return { text: countdownText(countdown, text), ticking: countdown.kind === 'running' };
}
