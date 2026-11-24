import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { fireMoreInfo, type Hass } from '../../core/hass';
import { resolveChannel } from '../../rows/channel/channel-status';
import {
  parseServiceAction,
  presetPanelState,
  type PresetOptionView,
  type PresetPanelConfig,
} from './preset-panel-state';

export type { PresetColor, PresetItem, PresetMatch, PresetPanelConfig } from './preset-panel-state';

/**
 * Segmented tactile preset bar card for multi-preset entities such as room
 * lights or ceiling fans, with optional motion-channel / countdown status.
 */
export class PresetPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    now: { attribute: false },
    _config: { state: true },
  };

  declare hass?: Hass;
  /** The clock this card reads. Stories and tests pin it; HA uses the real time. */
  declare now: () => number;
  private declare _config?: PresetPanelConfig;
  private _timer?: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this.now = () => Date.now();
  }

  setConfig(config: PresetPanelConfig): void {
    if (!config?.entity) throw new Error(`${this.localName} needs an entity`);
    if (!Array.isArray(config.presets) || config.presets.length === 0) {
      throw new Error(`${this.localName} needs a non-empty presets list`);
    }
    this._config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): Record<string, unknown> {
    return {
      columns: 6,
      min_columns: 4,
      rows: 2,
      min_rows: 2,
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
    if (!previous || !this.hass || previous.entities !== this.hass.entities) return true;
    const channel = resolveChannel(this.hass, this._config.entity, this._config);
    const watched = [
      this._config.entity,
      channel.deadline,
      channel.occupied,
      channel.status,
    ].filter((id): id is string => Boolean(id));
    return watched.some((id) => previous.states[id] !== this.hass!.states[id]);
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const state = presetPanelState(this.hass, this._config, this.now());
    this._setTicking(state.ticking && this.isConnected);

    return html`<ha-card>
      <div class="panel">
        <button type="button" class="header" @click=${this._openMoreInfo}>
          <span class="title">${state.name}</span>
          <span class="pill" data-color=${state.activeColor}>${state.statusText}</span>
        </button>

        <div class="presets ${state.presets.length >= 5 ? 'compact' : ''}" role="group" aria-label=${state.name}>
          ${state.presets.map((preset) => this._renderPreset(preset, !state.available))}
        </div>
      </div>
    </ha-card>`;
  }

  private _renderPreset(preset: PresetOptionView, disabled: boolean) {
    return html`<button
      type="button"
      class="preset-btn ${preset.active ? 'active' : ''}"
      data-color=${preset.color}
      aria-pressed=${preset.active}
      ?disabled=${disabled}
      @click=${() => this._runPreset(preset)}
    >
      ${preset.icon ? html`<ha-icon .icon=${preset.icon}></ha-icon>` : nothing}
      <span>${preset.label}</span>
    </button>`;
  }

  private _openMoreInfo(): void {
    if (!this._config) return;
    fireMoreInfo(this, this._config.entity);
  }

  private _runPreset(preset: PresetOptionView): void {
    if (!this.hass || !this._config) return;
    const parsed = parseServiceAction(preset.action);
    if (!parsed) return;
    void this.hass.callService?.(parsed.domain, parsed.service, {
      entity_id: this._config.entity,
      ...preset.data,
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
      --tone-amber: #f59e0b;
      --tone-purple: #8b5cf6;
      --tone-cool: #2196f3;
      --tone-green: #2e9e5b;
      --tone-heat: #f4511e;
    }

    .panel {
      container-type: inline-size;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
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
      padding: 4px 10px;
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

    .pill[data-color='amber'] {
      --tone: var(--tone-amber);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
    }
    .pill[data-color='purple'] {
      --tone: var(--tone-purple);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
    }
    .pill[data-color='cool'] {
      --tone: var(--tone-cool);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
    }
    .pill[data-color='green'] {
      --tone: var(--tone-green);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
    }
    .pill[data-color='heat'] {
      --tone: var(--tone-heat);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
    }

    .presets {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
      gap: 6px;
      padding: 4px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
    }

    .preset-btn {
      all: unset;
      box-sizing: border-box;
      min-height: 44px;
      padding: 8px 6px;
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

    .presets.compact .preset-btn {
      flex-direction: column;
      gap: 3px;
      min-height: 50px;
      padding: 6px 4px;
      font-size: 12px;
    }

    @container (max-width: 340px) {
      .preset-btn {
        flex-direction: column;
        gap: 3px;
        min-height: 50px;
        padding: 6px 4px;
        font-size: 12px;
      }
    }

    .preset-btn:hover:not(:disabled):not(.active) {
      background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      color: var(--primary-text-color);
    }

    .preset-btn:active:not(:disabled) {
      transform: scale(0.98);
    }

    .preset-btn:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }

    .preset-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .preset-btn.active[data-color='neutral'] {
      color: var(--primary-text-color);
      background: var(--card-background-color);
      border-color: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    }

    .preset-btn.active[data-color='amber'] {
      --tone: var(--tone-amber);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border-color: color-mix(in srgb, var(--tone) 38%, transparent);
    }
    .preset-btn.active[data-color='purple'] {
      --tone: var(--tone-purple);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border-color: color-mix(in srgb, var(--tone) 38%, transparent);
    }
    .preset-btn.active[data-color='cool'] {
      --tone: var(--tone-cool);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border-color: color-mix(in srgb, var(--tone) 38%, transparent);
    }
    .preset-btn.active[data-color='green'] {
      --tone: var(--tone-green);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border-color: color-mix(in srgb, var(--tone) 38%, transparent);
    }
    .preset-btn.active[data-color='heat'] {
      --tone: var(--tone-heat);
      color: color-mix(in srgb, var(--tone) 82%, var(--primary-text-color));
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      border-color: color-mix(in srgb, var(--tone) 38%, transparent);
    }
  `;
}
