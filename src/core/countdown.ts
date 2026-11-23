import { domainOf, type HassEntity } from './hass';

/** How long after a deadline passes we keep saying it is due, before treating it as stale. */
export const DUE_GRACE_MS = 60_000;

export type Countdown =
  | { kind: 'none' }
  | { kind: 'running'; seconds: number }
  | { kind: 'due' };

/**
 * Reads a timestamp sensor's state as a countdown at `now`.
 * Missing, unknown or long-past deadlines read as `none`, so a stale sensor
 * never leaves a row saying "Turning off" forever.
 */
export function countdownAt(deadlineState: string | undefined, now: number): Countdown {
  if (!deadlineState) return { kind: 'none' };
  const deadline = Date.parse(deadlineState);
  if (!Number.isFinite(deadline)) return { kind: 'none' };
  const remaining = deadline - now;
  if (remaining > 0) return { kind: 'running', seconds: Math.ceil(remaining / 1000) };
  if (remaining > -DUE_GRACE_MS) return { kind: 'due' };
  return { kind: 'none' };
}

/**
 * Reads a countdown from either a `timer.*` entity (using `attributes.finishes_at`
 * while `active`) or a timestamp entity (using `state`).
 */
export function countdownForEntity(stateObj: HassEntity | undefined, now: number): Countdown {
  if (!stateObj) return { kind: 'none' };
  if (domainOf(stateObj.entity_id) === 'timer') {
    if (stateObj.state !== 'active') return { kind: 'none' };
    const finishesAt = stateObj.attributes.finishes_at;
    return countdownAt(typeof finishesAt === 'string' ? finishesAt : undefined, now);
  }
  return countdownAt(stateObj.state, now);
}

/** `3m 05s` above a minute, `42s` below; hours fold into minutes (`72m 00s`). */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${String(rest).padStart(2, '0')}s` : `${rest}s`;
}

export interface CountdownText {
  /** Shown while counting down; `{time}` is replaced by the remaining time. */
  running: string;
  /** Shown once the deadline has passed but the entity has not caught up yet. */
  due: string;
}

export const DEFAULT_TEXT: CountdownText = { running: 'Off in {time}', due: 'Turning off' };

export const textFor = (config: { countdown_text?: string; due_text?: string }): CountdownText => ({
  running: config.countdown_text ?? DEFAULT_TEXT.running,
  due: config.due_text ?? DEFAULT_TEXT.due,
});

export function countdownText(countdown: Countdown, text: CountdownText): string {
  switch (countdown.kind) {
    case 'running':
      return text.running.replace('{time}', formatDuration(countdown.seconds));
    case 'due':
      return text.due;
    default:
      return '';
  }
}
