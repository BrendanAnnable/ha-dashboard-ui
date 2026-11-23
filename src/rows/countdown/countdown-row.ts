import { countdownForEntity, countdownText, DEFAULT_TEXT, textFor } from '../../core/countdown';
import { EntityRow, type SecondaryLine } from '../../core/entity-row';
import type { EntityRowConfig, Hass } from '../../core/hass';

export { DEFAULT_TEXT, textFor };

export interface CountdownRowConfig extends EntityRowConfig {
  /** A timestamp sensor or `timer.*` entity holding when something will next happen. */
  deadline_entity: string;
  /** Second line while counting down; `{time}` becomes `3m 05s`. Default `Off in {time}`. */
  countdown_text?: string;
  /** Second line once the deadline has passed. Default `Turning off`. */
  due_text?: string;
}

export function countdownRowLine(
  hass: Hass,
  config: Pick<CountdownRowConfig, 'deadline_entity' | 'countdown_text' | 'due_text'>,
  now: number,
): SecondaryLine {
  const countdown = countdownForEntity(hass.states[config.deadline_entity], now);
  return { text: countdownText(countdown, textFor(config)), ticking: countdown.kind === 'running' };
}

/**
 * An entity row whose second line counts down to a timestamp sensor or timer:
 * an auto-off light, a door that relocks, a timer anything sets.
 */
export class CountdownRow extends EntityRow<CountdownRowConfig> {
  protected readonly ownKeys = ['deadline_entity', 'countdown_text', 'due_text'] as const;

  protected validate(config: CountdownRowConfig) {
    if (!config.deadline_entity) throw new Error(`${this.localName} needs a deadline_entity`);
  }

  protected secondary(hass: Hass, config: CountdownRowConfig, now: number): SecondaryLine {
    return countdownRowLine(hass, config, now);
  }

  protected watchedEntities(_hass: Hass, config: CountdownRowConfig) {
    return [config.entity, config.deadline_entity];
  }
}
