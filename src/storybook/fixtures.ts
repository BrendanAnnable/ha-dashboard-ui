import type { EntityRegistryEntry, Hass, HassEntity } from '../core/hass';

/**
 * Builds a `hass` object for stories and tests. Entity IDs here are made up;
 * they mirror how a motion-controlled channel exposes itself in HA: one
 * device holding the switched entity and its Status, Occupied and Motion Off
 * Deadline sensors.
 */
export interface FakeEntity {
  state: string;
  name?: string;
  device?: string;
  attributes?: Record<string, unknown>;
}

export function fakeHass(entities: Record<string, FakeEntity>): Hass {
  const states: Record<string, HassEntity> = {};
  const registry: Record<string, EntityRegistryEntry> = {};
  for (const [entity_id, entity] of Object.entries(entities)) {
    states[entity_id] = {
      entity_id,
      state: entity.state,
      attributes: { friendly_name: entity.name, ...entity.attributes },
    };
    registry[entity_id] = { entity_id, name: entity.name, device_id: entity.device };
  }
  return {
    states,
    entities: registry,
    formatEntityState: (stateObj) => stateObj.state.charAt(0).toUpperCase() + stateObj.state.slice(1),
  };
}

export interface ChannelState {
  light: 'on' | 'off' | 'unavailable';
  status?: string;
  occupied?: 'on' | 'off';
  /** Seconds from `now` until the turn-off; negative once passed. */
  deadlineIn?: number;
}

export const CHANNEL = {
  light: 'light.hallway_lights',
  status: 'sensor.hallway_lights_status',
  occupied: 'binary_sensor.hallway_lights_occupied',
  deadline: 'sensor.hallway_lights_motion_off_deadline',
  recoveryStatus: 'sensor.hallway_lights_recovery_status',
} as const;

/** One channel device in a given state, plus an unrelated lamp on another device. */
export function channelHass(state: ChannelState, now: number): Hass {
  const device = 'hallway-channel';
  return fakeHass({
    [CHANNEL.light]: { state: state.light, name: 'Hallway lights', device },
    [CHANNEL.status]: { state: state.status ?? 'unknown', name: 'Status', device },
    [CHANNEL.occupied]: { state: state.occupied ?? 'off', name: 'Occupied', device },
    [CHANNEL.deadline]: {
      state: state.deadlineIn === undefined ? 'unknown' : new Date(now + state.deadlineIn * 1000).toISOString(),
      name: 'Motion Off Deadline',
      device,
    },
    [CHANNEL.recoveryStatus]: { state: 'restored', name: 'Recovery Status', device },
    'light.reading_lamp': { state: state.light, name: 'Reading lamp', device: 'reading-lamp' },
  });
}
