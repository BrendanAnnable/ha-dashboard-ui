import { EntityRow, type SecondaryLine } from '../../core/entity-row';
import type { EntityRowConfig, Hass } from '../../core/hass';
import { textFor } from '../countdown/countdown-row';
import { channelLine, resolveChannel, type ChannelOverrides } from './channel-status';

export interface ChannelRowConfig extends EntityRowConfig, ChannelOverrides {
  countdown_text?: string;
  due_text?: string;
}

/**
 * A row for a light or relay driven by a motion-controlled channel: says
 * Motion, Presence or Fading off, or counts down to the automatic turn-off.
 * The channel's sensors are found on the entity's device unless given.
 */
export class ChannelRow extends EntityRow<ChannelRowConfig> {
  protected readonly ownKeys = [
    'channel_entity',
    'deadline_entity',
    'occupied_entity',
    'status_entity',
    'countdown_text',
    'due_text',
  ] as const;

  protected secondary(hass: Hass, config: ChannelRowConfig, now: number): SecondaryLine {
    return channelLine(hass, config.entity, resolveChannel(hass, config.entity, config), textFor(config), now);
  }

  protected watchedEntities(hass: Hass, config: ChannelRowConfig) {
    const channel = resolveChannel(hass, config.entity, config);
    return [config.entity, channel.deadline, channel.occupied, channel.status].filter(
      (id): id is string => id !== undefined,
    );
  }
}
