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
