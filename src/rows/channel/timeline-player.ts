import { LitElement, css, html } from 'lit';
import { channelHass, CHANNEL } from '../../storybook/fixtures';
import { createRow, STORY_NOW } from '../../storybook/render';
import type { EntityRow } from '../../core/entity-row';
import { TIMELINE, TIMELINE_END, eventAt, stateAt } from './timeline';

/**
 * Storybook-only: plays the scripted cycle through a real `dash-channel-row`,
 * feeding it the hass states and clock for each moment. `time` can be set
 * directly, which is how tests step through transitions.
 */
export class ChannelTimelinePlayer extends LitElement {
  static properties = { time: { type: Number }, playing: { state: true }, speed: { state: true } };

  declare time: number;
  declare playing: boolean;
  declare speed: number;
  private _row: EntityRow<never> = createRow({
    tag: 'dash-channel-row',
    config: { entity: CHANNEL.light, name: 'Hallway lights', icon: 'mdi:ceiling-light' },
    hass: channelHass(stateAt(0), STORY_NOW),
  });
  private _frame?: number;
  private _last?: number;

  constructor() {
    super();
    this.time = 0;
    this.playing = false;
    this.speed = 1;
  }

  disconnectedCallback() {
    this._pause();
    super.disconnectedCallback();
  }

  willUpdate() {
    const now = STORY_NOW + this.time * 1000;
    this._row.now = () => now;
    this._row.hass = channelHass(stateAt(Math.floor(this.time)), now);
  }

  render() {
    const event = eventAt(this.time);
    return html`
      <ha-card-frame header="Hallway">${this._row}</ha-card-frame>
      <div class="controls">
        <button @click=${this._togglePlay}>${this.playing ? 'Pause' : 'Play'}</button>
        <select @change=${(e: Event) => (this.speed = Number((e.target as HTMLSelectElement).value))}>
          ${[1, 5, 10].map((s) => html`<option value=${s} ?selected=${s === this.speed}>${s}×</option>`)}
        </select>
        <input
          type="range"
          min="0"
          max=${TIMELINE_END}
          step="1"
          .value=${String(Math.floor(this.time))}
          @input=${(e: Event) => this._seek(Number((e.target as HTMLInputElement).value))}
        />
        <span class="clock">${Math.floor(this.time)}s</span>
      </div>
      <ol class="events">
        ${TIMELINE.map(
          (e) =>
            html`<li class=${e === event ? 'current' : ''}>
              <button @click=${() => this._seek(e.at)}>${e.at}s</button> ${e.label}
            </li>`,
        )}
      </ol>
    `;
  }

  private _seek(t: number) {
    this.time = Math.max(0, Math.min(TIMELINE_END, t));
  }

  private _togglePlay() {
    if (this.playing) return this._pause();
    if (this.time >= TIMELINE_END) this.time = 0;
    this.playing = true;
    this._last = performance.now();
    const step = (ts: number) => {
      this._seek(this.time + ((ts - this._last!) / 1000) * this.speed);
      this._last = ts;
      if (this.time >= TIMELINE_END) return this._pause();
      this._frame = requestAnimationFrame(step);
    };
    this._frame = requestAnimationFrame(step);
  }

  private _pause() {
    this.playing = false;
    if (this._frame) cancelAnimationFrame(this._frame);
  }

  static styles = css`
    :host {
      display: block;
      max-width: 500px;
      font-family: var(--ha-font-family-body);
      color: var(--primary-text-color);
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 16px 0 8px;
    }
    input[type='range'] {
      flex: 1;
    }
    .clock {
      min-width: 3.5em;
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .events {
      margin: 0;
      padding-inline-start: 0;
      list-style: none;
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    .events li {
      padding: 2px 0;
    }
    .events li.current {
      color: var(--primary-text-color);
      font-weight: 500;
    }
    .events button {
      font: inherit;
      min-width: 3.5em;
    }
  `;
}

if (!customElements.get('channel-timeline-player')) {
  customElements.define('channel-timeline-player', ChannelTimelinePlayer);
}
