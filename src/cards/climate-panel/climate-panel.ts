import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { fireMoreInfo, type Hass } from '../../core/hass';
import {
  climatePanelState,
  type ClimateModeOption,
  type ClimatePanelConfig,
} from './climate-panel-state';

export type { ClimatePanelConfig } from './climate-panel-state';

/**
 * Tactile hero climate control card for wall and desk tablets.
 * Shows target & room temperatures, optional power & countdown/hold status,
 * large −/+ steppers, and a segmented HVAC mode bar.
 */
export class ClimatePanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    now: { attribute: false },
    _config: { state: true },
  };

  declare hass?: Hass;
  /** The clock this card reads. Stories and tests pin it; HA uses the real time. */
  declare now: () => number;
  private declare _config?: ClimatePanelConfig;
  private _timer?: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this.now = () => Date.now();
  }

  setConfig(config: ClimatePanelConfig): void {
    if (!config?.entity) throw new Error(`${this.localName} needs an entity`);
    this._config = config;
  }

  getCardSize(): number {
    return 3;
  }

  getGridOptions(): Record<string, unknown> {
    return {
      columns: 6,
      min_columns: 4,
      rows: 3,
      min_rows: 3,
    };
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hass && this._config) this.requestUpdate();
  }

  disconnectedCallback(): void {
    this._stopTicking();
    super.disconnectedCallback();
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1 || !this._config) return true;
    const previous = changed.get('hass') as Hass | undefined;
    if (!previous || !this.hass) return true;
    const watched = [
      this._config.entity,
      this._config.deadline_entity,
      this._config.hold_entity,
      this._config.power_entity,
    ].filter((id): id is string => Boolean(id));
    return watched.some((id) => previous.states[id] !== this.hass!.states[id]);
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const state = climatePanelState(this.hass, this._config, this.now());
    this._setTicking(state.statusLine.ticking && this.isConnected);

    return html`<ha-card>
      <div class="panel">
        <button type="button" class="header" @click=${this._openMoreInfo}>
          <span class="title">${state.name}</span>
          <span class="pill" data-tone=${state.modeTone}>${state.pillText}</span>
        </button>

        <div class="hero">
          <div class="readout">
            <div class="target ${state.isOff ? 'muted' : ''}">${state.targetTempDisplay}</div>
            <div class="meta">
              ${state.roomTempDisplay ? html`<span class="room">${state.roomTempDisplay}</span>` : nothing}
              ${state.statusLine.text
                ? html`<span class="status" data-tone=${state.modeTone}>${state.statusLine.text}</span>`
                : nothing}
            </div>
          </div>

          <div class="stepper" role="group" aria-label="Target temperature">
            <button
              type="button"
              class="step-btn"
              aria-label="Decrease temperature"
              ?disabled=${!state.canStepDown}
              @click=${() => this._setTemperature(state.nextTempDown)}
            >
              <ha-icon icon="mdi:minus"></ha-icon>
            </button>
            <button
              type="button"
              class="step-btn"
              aria-label="Increase temperature"
              ?disabled=${!state.canStepUp}
              @click=${() => this._setTemperature(state.nextTempUp)}
            >
              <ha-icon icon="mdi:plus"></ha-icon>
            </button>
          </div>
        </div>

        <div class="modes ${state.modes.length >= 5 ? 'compact' : ''}" role="group" aria-label="HVAC mode">
          ${state.modes.map((option) => this._renderMode(option, !state.available))}
        </div>
      </div>
    </ha-card>`;
  }

  private _renderMode(option: ClimateModeOption, disabled: boolean) {
    return html`<button
      type="button"
      class="mode-btn ${option.active ? 'active' : ''}"
      data-mode=${option.mode}
      data-tone=${option.tone}
      aria-pressed=${option.active}
      ?disabled=${disabled}
      @click=${() => this._setHvacMode(option.mode)}
    >
      <ha-icon .icon=${option.icon}></ha-icon>
      <span>${option.label}</span>
    </button>`;
  }

  private _openMoreInfo(): void {
    if (!this._config) return;
    fireMoreInfo(this, this._config.entity);
  }

  private _setTemperature(temperature: number | undefined): void {
    if (!this.hass || !this._config || temperature === undefined) return;
    void this.hass.callService?.('climate', 'set_temperature', {
      entity_id: this._config.entity,
      temperature,
    });
  }

  private _setHvacMode(hvacMode: string): void {
    if (!this.hass || !this._config) return;
    void this.hass.callService?.('climate', 'set_hvac_mode', {
      entity_id: this._config.entity,
      hvac_mode: hvacMode,
    });
  }

  private _setTicking(ticking: boolean): void {
    if (ticking && !this._timer) {
      this._timer = setInterval(() => this.requestUpdate(), 1000);
    } else if (!ticking) {
      this._stopTicking();
    }
  }

  private _stopTicking(): void {
    clearInterval(this._timer);
    this._timer = undefined;
  }

  static styles = css`
    :host {
      display: block;
      --tone-cool: #2196f3;
      --tone-heat: #f4511e;
      --tone-dry: #f59e0b;
      --tone-fan: #00acc1;
      --tone-auto: #2e9e5b;
      --tone-neutral: var(--secondary-text-color);
    }

    .panel {
      container-type: inline-size;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 14px;
      box-sizing: border-box;
    }

    .header {
      all: unset;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      border-radius: 8px;
      min-width: 0;
    }

    .header:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 4px;
    }

    .title {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--secondary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
      flex: 0 0 auto;
      font-variant-numeric: tabular-nums;
      color: var(--secondary-text-color);
      background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
    }

    .pill[data-tone='cool'] {
      --tone: var(--tone-cool);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
    }
    .pill[data-tone='heat'] {
      --tone: var(--tone-heat);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
    }
    .pill[data-tone='dry'] {
      --tone: var(--tone-dry);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
    }
    .pill[data-tone='fan'] {
      --tone: var(--tone-fan);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
    }
    .pill[data-tone='auto'] {
      --tone: var(--tone-auto);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
    }

    .hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .readout {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .target {
      font-size: 36px;
      font-weight: 600;
      line-height: 1;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      color: var(--primary-text-color);
    }

    .target.muted {
      color: var(--secondary-text-color);
      font-weight: 500;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 10px;
      min-height: 16px;
      font-size: 12px;
      line-height: 1.25;
      color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums;
    }

    .status {
      font-weight: 500;
      color: var(--primary-text-color);
    }

    .stepper {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }

    .step-btn {
      all: unset;
      box-sizing: border-box;
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--primary-text-color);
      background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
      transition: background-color 120ms, transform 80ms, opacity 120ms;
      --mdc-icon-size: 20px;
    }

    .step-btn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--primary-text-color) 11%, transparent);
    }

    .step-btn:active:not(:disabled) {
      transform: scale(0.96);
    }

    .step-btn:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }

    .step-btn:disabled {
      opacity: 0.32;
      cursor: default;
    }

    .modes {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
      gap: 6px;
      padding: 3px;
      border-radius: 11px;
      background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
    }

    .mode-btn {
      all: unset;
      box-sizing: border-box;
      min-height: 40px;
      padding: 8px 10px;
      border-radius: 9px;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      color: var(--secondary-text-color);
      transition: background-color 120ms, border-color 120ms, color 120ms, transform 80ms;
      --mdc-icon-size: 18px;
    }

    .modes.compact .mode-btn {
      flex-direction: column;
      gap: 2px;
      min-height: 42px;
      padding: 4px 4px;
      font-size: 12px;
      --mdc-icon-size: 16px;
    }

    @container (max-width: 340px) {
      .mode-btn {
        flex-direction: column;
        gap: 2px;
        min-height: 42px;
        padding: 4px 4px;
        font-size: 12px;
        --mdc-icon-size: 16px;
      }
    }

    .mode-btn:hover:not(:disabled):not(.active) {
      background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      color: var(--primary-text-color);
    }

    .mode-btn:active:not(:disabled) {
      transform: scale(0.98);
    }

    .mode-btn:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }

    .mode-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .mode-btn.active[data-tone='neutral'] {
      color: var(--primary-text-color);
      background: var(--card-background-color);
      border-color: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    }

    .mode-btn.active[data-tone='cool'] {
      --tone: var(--tone-cool);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border-color: color-mix(in srgb, var(--tone) 38%, transparent);
    }
    .mode-btn.active[data-tone='heat'] {
      --tone: var(--tone-heat);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border-color: color-mix(in srgb, var(--tone) 38%, transparent);
    }
    .mode-btn.active[data-tone='dry'] {
      --tone: var(--tone-dry);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border-color: color-mix(in srgb, var(--tone) 38%, transparent);
    }
    .mode-btn.active[data-tone='fan'] {
      --tone: var(--tone-fan);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border-color: color-mix(in srgb, var(--tone) 38%, transparent);
    }
    .mode-btn.active[data-tone='auto'] {
      --tone: var(--tone-auto);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border-color: color-mix(in srgb, var(--tone) 38%, transparent);
    }
  `;
}
