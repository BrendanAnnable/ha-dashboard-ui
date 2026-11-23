import { countdownForEntity, countdownText, textFor } from '../../core/countdown';
import type { SecondaryLine } from '../../core/entity-row';
import type { Hass } from '../../core/hass';

export interface CountdownTileStatusConfig {
  entity: string;
  /** A timestamp sensor or `timer.*` entity holding when the entity will next change. */
  deadline_entity: string;
  /** Shown while counting down; `{time}` becomes `3m 05s`. Default `Off in {time}`. */
  countdown_text?: string;
  /** Shown once the deadline has passed. Default `Turning off`. */
  due_text?: string;
  /** Optional entity that suppresses the countdown when `on` (e.g. a room lights group). */
  hold_entity?: string;
  /** Shown when no countdown is active and `hold_entity` is `on`. */
  hold_text?: string;
}

const INACTIVE_STATES = new Set(['off', 'unavailable', 'unknown']);

/**
 * Secondary status suffix for `custom:dash-countdown-tile`.
 *
 * Silent when the entity is missing or inactive (`off`, `unavailable`, `unknown`).
 * Otherwise shows the active countdown (or due text), falling back to `hold_text`
 * while `hold_entity` is `on`.
 */
export function tileStatus(hass: Hass, config: CountdownTileStatusConfig, now: number): SecondaryLine {
  const silent: SecondaryLine = { text: '', ticking: false };
  const stateObj = hass.states[config.entity];
  if (!stateObj || INACTIVE_STATES.has(stateObj.state)) return silent;

  const countdown = countdownForEntity(hass.states[config.deadline_entity], now);
  if (countdown.kind === 'running') {
    return { text: countdownText(countdown, textFor(config)), ticking: true };
  }
  if (countdown.kind === 'due') {
    return { text: countdownText(countdown, textFor(config)), ticking: false };
  }

  if (config.hold_entity && config.hold_text && hass.states[config.hold_entity]?.state === 'on') {
    return { text: config.hold_text, ticking: false };
  }

  return silent;
}

const OWN_KEYS = ['deadline_entity', 'countdown_text', 'due_text', 'hold_entity', 'hold_text'] as const;

/** Strips countdown-tile keys and forces `type: 'tile'` for the inner `hui-tile-card`. */
export function tileConfigFor(config: CountdownTileStatusConfig & Record<string, unknown>): Record<string, unknown> {
  const tile: Record<string, unknown> = { ...config };
  for (const key of OWN_KEYS) delete tile[key];
  tile.type = 'tile';
  return tile;
}
