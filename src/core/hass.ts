/**
 * The parts of Home Assistant's frontend `hass` object these rows read.
 * HA passes the full object; declaring only what we use keeps stories and
 * tests able to build one by hand.
 */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
}

/** HA's `EntityRegistryDisplayEntry`: `name` is the entity's own name, without the device prefix. */
export interface EntityRegistryEntry {
  entity_id: string;
  name?: string;
  device_id?: string;
}

export interface Hass {
  states: Record<string, HassEntity | undefined>;
  entities?: Record<string, EntityRegistryEntry | undefined>;
  formatEntityState?: (stateObj: HassEntity, state?: string) => string;
}

/** Row options HA's own entity rows understand; passed straight through. */
export interface EntityRowConfig {
  entity: string;
  name?: string;
  icon?: string;
  image?: string;
  color?: string;
  state_color?: boolean;
  secondary_info?: string;
  tap_action?: unknown;
  hold_action?: unknown;
  double_tap_action?: unknown;
}

export const objectId = (entityId: string) => entityId.slice(entityId.indexOf('.') + 1);
export const domainOf = (entityId: string) => entityId.slice(0, entityId.indexOf('.'));
