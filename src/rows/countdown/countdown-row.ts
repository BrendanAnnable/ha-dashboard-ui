import { countdownAt, countdownText, type CountdownText } from '../../core/countdown';
import { EntityRow, type SecondaryLine } from '../../core/entity-row';
import type { EntityRowConfig, Hass } from '../../core/hass';

export interface CountdownRowConfig extends EntityRowConfig {
  /** A timestamp sensor holding when something will next happen. */
  deadline_entity: string;
  /** Second line while counting down; `{time}` becomes `3m 05s`. Default `Off in {time}`. */
  countdown_text?: string;
  /** Second line once the deadline has passed. Default `Turning off`. */
  due_text?: string;
}

export const DEFAULT_TEXT: CountdownText = { running: 'Off in {time}', due: 'Turning off' };

export const textFor = (config: Pick<CountdownRowConfig, 'countdown_text' | 'due_text'>) => ({
  running: config.countdown_text ?? DEFAULT_TEXT.running,
  due: config.due_text ?? DEFAULT_TEXT.due,
});

/**
 * An entity row whose second line counts down to a timestamp sensor:
 * an auto-off light, a door that relocks, a timer anything sets.
 */
export class CountdownRow extends EntityRow<CountdownRowConfig> {
  protected readonly ownKeys = ['deadline_entity', 'countdown_text', 'due_text'] as const;

  protected validate(config: CountdownRowConfig) {
    if (!config.deadline_entity) throw new Error(`${this.localName} needs a deadline_entity`);
  }

  protected secondary(hass: Hass, config: CountdownRowConfig, now: number): SecondaryLine {
    const countdown = countdownAt(hass.states[config.deadline_entity]?.state, now);
    return { text: countdownText(countdown, textFor(config)), ticking: countdown.kind === 'running' };
  }

  protected watchedEntities(_hass: Hass, config: CountdownRowConfig) {
    return [config.entity, config.deadline_entity];
  }
}
