import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { fireMoreInfo, navigateTo, type Hass } from '../../core/hass';
import {
  statusBarState,
  type ChipAction,
  type StatusBarChipView,
  type StatusBarConfig,
} from './status-bar-state';

export type {
  ChipAction,
  ChipTapActionKind,
  ChipTone,
  StatusBarChipConfig,
  StatusBarConfig,
  TimeFormat,
} from './status-bar-state';

const CLOCK_TICK_MS = 15_000;

/**
 * Slim top status bar for wall and desk tablets: clock, date, weather, and
 * glanceable status or navigation chips.
 */
export class StatusBar extends LitElement {
  static properties = {
    hass: { attribute: false },
    now: { attribute: false },
    _config: { state: true },
  };

  declare hass?: Hass;
  /** The clock this card reads. Stories and tests pin it; HA uses the real time. */
  declare now: () => number;
  private declare _config?: StatusBarConfig;
  private _timer?: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this.now = () => Date.now();
  }

  setConfig(config: StatusBarConfig): void {
    this._config = config ?? {};
  }

  getCardSize(): number {
    return 1;
  }

  getGridOptions(): Record<string, unknown> {
    return {
      columns: 12,
      min_columns: 6,
      rows: 1,
      min_rows: 1,
    };
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this._config) this._syncClockTimer();
  }

  disconnectedCallback(): void {
    this._stopClockTimer();
    super.disconnectedCallback();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1 || !this._config) return true;
    const previous = changed.get('hass') as Hass | undefined;
    if (!previous || !this.hass) return true;
    const watched: string[] = [];
    if (this._config.weather_entity) watched.push(this._config.weather_entity);
    for (const chip of this._config.chips ?? []) {
      if (chip.entity) watched.push(chip.entity);
      if (chip.secondary_entity) watched.push(chip.secondary_entity);
    }
    return watched.some((id) => previous.states[id] !== this.hass!.states[id]);
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    this._syncClockTimer();
    const state = statusBarState(this.hass, this._config, this.now());
    const hasLeft = Boolean(state.clockText || state.dateText || state.weather);

    return html`<ha-card>
      <div class="bar">
        ${hasLeft
          ? html`<div class="left">
              ${state.clockText ? html`<span class="clock">${state.clockText}</span>` : nothing}
              ${state.dateText ? html`<span class="date">${state.dateText}</span>` : nothing}
              ${state.weather
                ? html`<button
                    type="button"
                    class="weather"
                    @click=${() => fireMoreInfo(this, state.weather!.entityId)}
                  >
                    <ha-icon .icon=${state.weather.icon}></ha-icon>
                    ${state.weather.temperature
                      ? html`<span class="weather-temp">${state.weather.temperature}</span>`
                      : nothing}
                  </button>`
                : nothing}
            </div>`
          : nothing}
        ${state.chips.length
          ? html`<div class="chips">${state.chips.map((chip) => this._renderChip(chip))}</div>`
          : nothing}
      </div>
    </ha-card>`;
  }

  private _renderChip(chip: StatusBarChipView) {
    const content = html`
      ${chip.icon ? html`<ha-icon .icon=${chip.icon}></ha-icon>` : nothing}
      ${chip.label ? html`<span class="chip-label">${chip.label}</span>` : nothing}
      ${chip.label && chip.value ? html`<span class="chip-sep" aria-hidden="true">·</span>` : nothing}
      ${chip.value ? html`<span class="chip-value">${chip.value}</span>` : nothing}
    `;

    if (chip.action.kind === 'none') {
      return html`<div class="chip" data-tone=${chip.tone}>${content}</div>`;
    }

    return html`<button
      type="button"
      class="chip interactive"
      data-tone=${chip.tone}
      @click=${() => this._runAction(chip.action)}
    >
      ${content}
    </button>`;
  }

  private _runAction(action: ChipAction): void {
    switch (action.kind) {
      case 'navigate':
        navigateTo(action.path);
        return;
      case 'more-info':
        fireMoreInfo(this, action.entityId);
        return;
      case 'toggle':
        void this.hass?.callService?.('homeassistant', 'toggle', { entity_id: action.entityId });
        return;
      case 'none':
        return;
    }
  }

  private _syncClockTimer(): void {
    const needsClock = this._config?.show_clock !== false && this.isConnected;
    if (needsClock && !this._timer) {
      this._timer = setInterval(() => this.requestUpdate(), CLOCK_TICK_MS);
    } else if (!needsClock) {
      this._stopClockTimer();
    }
  }

  private _stopClockTimer(): void {
    clearInterval(this._timer);
    this._timer = undefined;
  }

  static styles = css`
    :host {
      display: block;
      --tone-ok: #2e9e5b;
      --tone-warn: #f59e0b;
    }

    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px 16px;
      padding: 10px 16px;
      box-sizing: border-box;
    }

    .left {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 12px;
      min-width: 0;
    }

    .clock {
      font-size: 20px;
      font-weight: 600;
      line-height: 1.1;
      letter-spacing: -0.01em;
      font-variant-numeric: tabular-nums;
      color: var(--primary-text-color);
      white-space: nowrap;
    }

    .date {
      font-size: 13px;
      font-weight: 500;
      color: var(--secondary-text-color);
      white-space: nowrap;
    }

    .weather {
      all: unset;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: 999px;
      cursor: pointer;
      color: var(--primary-text-color);
      font-size: 13px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      --mdc-icon-size: 18px;
      transition: background-color 120ms;
    }

    .weather:hover {
      background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
    }

    .weather:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }

    .chips {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 34px;
      padding: 6px 11px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
      background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
      color: var(--primary-text-color);
      font-size: 13px;
      font-weight: 500;
      line-height: 1.2;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      --mdc-icon-size: 16px;
    }

    .chip.interactive {
      cursor: pointer;
      transition: background-color 120ms, border-color 120ms, transform 80ms;
    }

    .chip.interactive:hover {
      background: color-mix(in srgb, var(--primary-text-color) 10%, transparent);
    }

    .chip.interactive:active {
      transform: scale(0.97);
    }

    .chip.interactive:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }

    .chip[data-tone='ok'] {
      --tone: var(--tone-ok);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 15%, transparent);
      border-color: color-mix(in srgb, var(--tone) 34%, transparent);
    }

    .chip[data-tone='warn'] {
      --tone: var(--tone-warn);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border-color: color-mix(in srgb, var(--tone) 38%, transparent);
    }

    .chip-label {
      font-weight: 600;
    }

    .chip-sep {
      opacity: 0.5;
    }

    .chip-value {
      font-variant-numeric: tabular-nums;
    }
  `;
}
