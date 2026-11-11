import { domainOf, objectId, type Hass } from './hass';

export interface SiblingRole {
  /** The entity's own name as the integration reports it, e.g. `Motion Off Deadline`. */
  name: string;
  /** The entity ID ending used when the name has been changed, e.g. `motion_off_deadline`. */
  suffix: string;
  domains: string[];
}

/**
 * Finds the entity on the same device as `source` that plays `role`.
 *
 * Matches on the entity's own name first (what the integration called it),
 * then on the entity ID ending. Among ID matches the shortest wins, so
 * `..._status` beats `..._recovery_status`.
 */
export function findSibling(hass: Hass, source: string, role: SiblingRole): string | undefined {
  const deviceId = hass.entities?.[source]?.device_id;
  if (!deviceId) return undefined;

  const siblings = Object.values(hass.entities ?? {}).filter(
    (entry) =>
      entry !== undefined &&
      entry.entity_id !== source &&
      entry.device_id === deviceId &&
      role.domains.includes(domainOf(entry.entity_id)),
  );

  const wanted = role.name.toLowerCase();
  const byName = siblings.find((entry) => entry!.name?.toLowerCase() === wanted);
  if (byName) return byName.entity_id;

  const bySuffix = siblings
    .map((entry) => entry!.entity_id)
    .filter((id) => objectId(id) === role.suffix || objectId(id).endsWith(`_${role.suffix}`))
    .sort((a, b) => a.length - b.length);
  return bySuffix[0];
}
