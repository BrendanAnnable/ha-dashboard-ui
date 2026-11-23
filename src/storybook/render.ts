import type { CountdownTile, CountdownTileConfig } from '../cards/countdown-tile/countdown-tile';
import type { Hass } from '../core/hass';
import type { EntityRow } from '../core/entity-row';

/** Fixed story time, so screenshots and assertions never depend on the real clock. */
export const STORY_NOW = Date.parse('2026-01-01T12:00:00Z');

export interface RowSpec {
  tag: string;
  config: Record<string, unknown>;
  hass: Hass;
  now?: number;
}

export function createRow({ tag, config, hass, now = STORY_NOW }: RowSpec): EntityRow<never> {
  const row = document.createElement(tag) as EntityRow<never>;
  row.setConfig(config as never);
  row.now = () => now;
  row.hass = hass;
  return row;
}

export interface TileSpec {
  config: CountdownTileConfig;
  hass: Hass;
  now?: number;
}

export function createTile({ config, hass, now = STORY_NOW }: TileSpec): CountdownTile {
  const tile = document.createElement('dash-countdown-tile') as CountdownTile;
  tile.setConfig(config);
  tile.now = () => now;
  tile.hass = hass;
  return tile;
}

/** Rows inside a stand-in entities card, the way they sit on a dashboard. */
export function card(header: string | undefined, rows: HTMLElement[]): HTMLElement {
  const frame = document.createElement('ha-card-frame');
  if (header) frame.setAttribute('header', header);
  frame.append(...rows);
  return frame;
}

/** The text of a row's second line, read through HA's row element. */
export async function secondaryOf(row: Element): Promise<string> {
  const host = row as EntityRow<never>;
  await host.updateComplete;
  const generic = host.shadowRoot?.querySelector('hui-generic-entity-row') as
    | (HTMLElement & { updateComplete?: Promise<unknown> })
    | null;
  await generic?.updateComplete;
  return generic?.shadowRoot?.querySelector('.secondary')?.textContent?.trim() ?? '';
}

/** The countdown span text appended inside `hui-tile-card`'s secondary slot. */
export async function tileCountdownOf(tile: Element): Promise<string> {
  const host = tile as CountdownTile;
  await host.updateComplete;
  const inner = host.shadowRoot?.querySelector('hui-tile-card');
  return inner?.shadowRoot?.querySelector('ha-tile-info [data-dash-countdown]')?.textContent ?? '';
}

/** The full visible secondary line of a `dash-countdown-tile` (`<state-display>` + countdown span). */
export async function tileSecondaryOf(tile: Element): Promise<string> {
  const host = tile as CountdownTile;
  await host.updateComplete;
  const inner = host.shadowRoot?.querySelector('hui-tile-card');
  const secondary = inner?.shadowRoot?.querySelector('ha-tile-info > [slot="secondary"]');
  if (!secondary) return '';
  const stateDisplay = secondary.querySelector('state-display') as
    | (HTMLElement & { updateComplete?: Promise<unknown> })
    | null;
  await stateDisplay?.updateComplete;
  const stateText = stateDisplay?.shadowRoot?.textContent?.trim() ?? '';
  const countdownText = secondary.querySelector('[data-dash-countdown]')?.textContent ?? '';
  return `${stateText}${countdownText}`;
}
