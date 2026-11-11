import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { ensureHaRowElements } from './ha-elements';
import type { EntityRowConfig, Hass } from './hass';

/** States HA's own toggle row shows a switch for; anything else shows the state as text. */
const TOGGLE_STATES = ['on', 'off', 'unavailable', 'unknown'];

export interface SecondaryLine {
  text: string;
  /** True while the text depends on the clock, so the row re-renders every second. */
  ticking: boolean;
}

/**
 * An entities-card row drawn by HA's own `hui-generic-entity-row`, with a
 * toggle like HA's toggle row. Subclasses only decide the second line.
 *
 * Inside HA this gives the native look, tap and hold actions and the more-info
 * dialog for free. In Storybook the three HA elements are stand-ins.
 */
export abstract class EntityRow<C extends EntityRowConfig> extends LitElement {
  static properties = {
    hass: { attribute: false },
    now: { attribute: false },
    _config: { state: true },
  };

  declare hass?: Hass;
  /** The clock rows read. Stories and tests pin it; HA uses the real time. */
  declare now: () => number;
  protected declare _config?: C;
  private _timer?: ReturnType<typeof setInterval>;

  /** Ownership of config keys this row adds; they are not passed to HA's row. */
  protected abstract readonly ownKeys: readonly string[];

  constructor() {
    super();
    this.now = () => Date.now();
  }

  setConfig(config: C): void {
    if (!config?.entity) throw new Error(`${this.localName} needs an entity`);
    this.validate(config);
    this._config = config;
  }

  protected validate(_config: C): void {}

  protected abstract secondary(hass: Hass, config: C, now: number): SecondaryLine;

  connectedCallback(): void {
    super.connectedCallback();
    void ensureHaRowElements();
  }

  disconnectedCallback(): void {
    this._stopTicking();
    super.disconnectedCallback();
  }

  protected render() {
    const hass = this.hass;
    const config = this._config;
    if (!hass || !config) return nothing;

    const line = this.secondary(hass, config, this.now());
    this._setTicking(line.ticking);

    const stateObj = hass.states[config.entity];
    const showToggle = !stateObj || TOGGLE_STATES.includes(stateObj.state);
    return html`
      <hui-generic-entity-row
        .hass=${hass}
        .config=${this._rowConfig(config)}
        .secondaryText=${line.text}
        .catchInteraction=${!showToggle}
      >
        ${showToggle
          ? html`<ha-entity-toggle .hass=${hass} .stateObj=${stateObj}></ha-entity-toggle>`
          : html`<div class="text-content">
              ${hass.formatEntityState?.(stateObj) ?? stateObj.state}
            </div>`}
      </hui-generic-entity-row>
    `;
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has('hass') || changed.size > 1 || !this._config) return true;
    const previous = changed.get('hass') as Hass | undefined;
    if (!previous || !this.hass) return true;
    return this.watchedEntities(this.hass, this._config).some(
      (id) => previous.states[id] !== this.hass!.states[id],
    );
  }

  /** Entities whose changes should re-render the row. */
  protected watchedEntities(_hass: Hass, config: C): string[] {
    return [config.entity];
  }

  private _rowConfig(config: C): EntityRowConfig {
    const row: Record<string, unknown> = { ...(config as EntityRowConfig) };
    for (const key of ['type', 'toggle', ...this.ownKeys]) delete row[key];
    return row as unknown as EntityRowConfig;
  }

  private _setTicking(ticking: boolean) {
    if (ticking && !this._timer) {
      this._timer = setInterval(() => this.requestUpdate(), 1000);
    } else if (!ticking) {
      this._stopTicking();
    }
  }

  private _stopTicking() {
    clearInterval(this._timer);
    this._timer = undefined;
  }

  static styles = css`
    :host {
      display: block;
    }
    .text-content {
      text-align: end;
      white-space: nowrap;
    }
  `;
}
