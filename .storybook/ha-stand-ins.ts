/**
 * Stand-ins for Home Assistant elements our rows and cards render inside HA:
 * `hui-generic-entity-row`, `state-badge`, `ha-entity-toggle`, and
 * `hui-tile-card` (with `ha-card`, `ha-tile-info`, `state-display` and
 * `hui-warning`). Layout and colours follow HA's frontend (Apache-2.0,
 * github.com/home-assistant/frontend); behaviour is reduced to what a story
 * needs. They are never bundled: inside HA the real elements are used.
 *
 * `ha-card-frame` stands in for an entities card, so rows sit with HA's
 * spacing and padding.
 */
import * as mdi from '@mdi/js';
import { LitElement, css, html, nothing, svg } from 'lit';
import type { EntityRowConfig, Hass, HassEntity } from '../src/core/hass';

const domainOf = (id: string) => id.split('.')[0];

function mdiPath(icon?: string): string | undefined {
  if (!icon?.startsWith('mdi:')) return undefined;
  const key = `mdi${icon
    .slice(4)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}`;
  return (mdi as Record<string, string>)[key];
}

function iconPath(stateObj: HassEntity | undefined, override?: string): string {
  const custom = mdiPath(override);
  if (custom) return custom;
  const on = stateObj?.state === 'on';
  switch (stateObj && domainOf(stateObj.entity_id)) {
    case 'light':
      return on ? mdi.mdiLightbulb : mdi.mdiLightbulbOff;
    case 'switch':
      return on ? mdi.mdiToggleSwitchVariant : mdi.mdiToggleSwitchVariantOff;
    case 'fan':
      return on ? mdi.mdiFan : mdi.mdiFanOff;
    case 'lock':
      return stateObj?.state === 'unlocked' ? mdi.mdiLockOpenVariant : mdi.mdiLock;
    case 'climate':
      switch (stateObj?.state) {
        case 'cool':
          return mdi.mdiSnowflake;
        case 'heat':
          return mdi.mdiFire;
        case 'dry':
          return mdi.mdiWaterPercent;
        case 'fan_only':
          return mdi.mdiFan;
        default:
          return mdi.mdiThermostat;
      }
    default:
      return mdi.mdiEye;
  }
}

class StateBadge extends LitElement {
  static properties = { stateObj: { attribute: false }, overrideIcon: { attribute: false } };
  declare stateObj?: HassEntity;
  declare overrideIcon?: string;

  render() {
    const stateObj = this.stateObj;
    const active = stateObj?.state === 'on' && domainOf(stateObj.entity_id) === 'light';
    const unavailable = stateObj?.state === 'unavailable';
    return html`<svg
      viewBox="0 0 24 24"
      class=${active ? 'active' : unavailable ? 'unavailable' : ''}
      aria-hidden="true"
    >
      ${svg`<path d=${iconPath(stateObj, this.overrideIcon)}></path>`}
    </svg>`;
  }

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      border-radius: 50%;
      color: var(--state-icon-color);
    }
    svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }
    .active {
      color: var(--state-light-active-color);
    }
    .unavailable {
      color: var(--state-unavailable-color, #bdbdbd);
    }
  `;
}

class EntityToggle extends LitElement {
  static properties = { stateObj: { attribute: false }, hass: { attribute: false } };
  declare stateObj?: HassEntity;
  declare hass?: Hass;

  render() {
    const checked = this.stateObj?.state === 'on';
    const disabled = !this.stateObj || this.stateObj.state === 'unavailable';
    return html`<button
      role="switch"
      aria-checked=${checked}
      ?disabled=${disabled}
      class=${checked ? 'checked' : ''}
      @click=${this._toggle}
    >
      <span></span>
    </button>`;
  }

  private _toggle(ev: Event) {
    ev.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('story-toggle', {
        detail: { entityId: this.stateObj?.entity_id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  static styles = css`
    :host {
      display: flex;
      align-items: center;
    }
    /* Measured from HA 2026.11's ha-switch: outlined track, dark thumb off; tinted track, primary thumb on. */
    button {
      all: unset;
      box-sizing: border-box;
      position: relative;
      width: 38px;
      height: 20px;
      border-radius: 20px;
      border: 1px solid var(--switch-unchecked-border-color);
      background: var(--switch-unchecked-track-color);
      cursor: pointer;
      transition: background-color 120ms, border-color 120ms;
    }
    button span {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      box-sizing: border-box;
      border-radius: 50%;
      background: var(--switch-unchecked-button-color);
      transition: transform 120ms, background-color 120ms;
    }
    button.checked {
      border-color: var(--switch-checked-color);
      background: var(--switch-checked-track-color);
    }
    button.checked span {
      transform: translateX(18px);
      background: var(--switch-checked-color);
    }
    button:disabled {
      opacity: 0.38;
      cursor: default;
    }
  `;
}

class GenericEntityRow extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false },
    secondaryText: { attribute: false },
    catchInteraction: { attribute: false },
  };
  declare hass?: Hass;
  declare config?: EntityRowConfig;
  declare secondaryText?: string;
  declare catchInteraction?: boolean;

  render() {
    if (!this.hass || !this.config) return nothing;
    const stateObj = this.hass.states[this.config.entity];
    if (!stateObj) {
      return html`<div class="warning">Entity not available: ${this.config.entity}</div>`;
    }
    const name = this.config.name ?? (stateObj.attributes.friendly_name as string) ?? this.config.entity;
    const secondary = this.secondaryText;
    return html`<div class="row pointer" tabindex="0">
      <state-badge .stateObj=${stateObj} .overrideIcon=${this.config.icon}></state-badge>
      <div class="info" title=${name}>
        ${name} ${secondary ? html`<div class="secondary">${secondary}</div>` : nothing}
      </div>
      <slot></slot>
    </div>`;
  }

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      flex-direction: row;
    }
    .row {
      display: flex;
      align-items: center;
      flex-direction: row;
      width: 100%;
      outline: none;
    }
    .row:focus-visible {
      background-color: var(--primary-background-color);
    }
    .info {
      padding-inline-start: 16px;
      padding-inline-end: 8px;
      flex: 1 1 30%;
    }
    .info,
    .info > * {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .secondary {
      color: var(--secondary-text-color);
    }
    .pointer {
      cursor: pointer;
    }
    .warning {
      padding: 8px;
      color: #fff;
      background: var(--warning-color, #ff9800);
      border-radius: 4px;
    }
  `;
}

/** An entities card: a title and rows spaced as HA spaces them. */
class CardFrame extends LitElement {
  static properties = { header: {} };
  declare header?: string;

  render() {
    return html`<div class="card">
      ${this.header ? html`<h1>${this.header}</h1>` : nothing}
      <div class="states"><slot></slot></div>
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
      max-width: 500px;
    }
    .card {
      background: var(--card-background-color);
      border: 1px solid var(--ha-card-border-color);
      border-radius: var(--ha-card-border-radius);
      color: var(--primary-text-color);
    }
    h1 {
      margin: 0;
      padding: 12px 16px 16px;
      font-size: 24px;
      font-weight: 400;
      line-height: 40px;
    }
    .states {
      padding: 0 16px 16px;
    }
    .card:not(:has(h1)) .states {
      padding-top: 16px;
    }
    ::slotted(*) {
      margin: 8px 0;
    }
    ::slotted(:first-child) {
      margin-top: 0;
    }
    ::slotted(:last-child) {
      margin-bottom: 0;
    }
  `;
}

interface TileFeatureConfig {
  type: string;
  hvac_modes?: string[];
}

interface TileCardConfig {
  type?: string;
  entity: string;
  name?: string;
  icon?: string;
  color?: string;
  hide_state?: boolean;
  vertical?: boolean;
  features?: TileFeatureConfig[];
  features_position?: 'bottom' | 'inline';
}

const TILE_COLOR: Record<string, string> = {
  cool: '#2196f3',
  heat: '#ff9800',
  heat_cool: '#4caf50',
  auto: '#4caf50',
  dry: '#ff9800',
  fan_only: '#00bcd4',
  on: '#ffc107',
};

const HVAC_MODE_ICON: Record<string, string> = {
  off: mdi.mdiPower,
  cool: mdi.mdiSnowflake,
  heat: mdi.mdiFire,
  heat_cool: mdi.mdiAutorenew,
  auto: mdi.mdiAutorenew,
  dry: mdi.mdiWaterPercent,
  fan_only: mdi.mdiFan,
};

class HaCard extends LitElement {
  render() {
    return html`<slot></slot>`;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      background: var(--card-background-color);
      border: 1px solid var(--ha-card-border-color);
      border-radius: var(--ha-card-border-radius);
      color: var(--primary-text-color);
      box-sizing: border-box;
    }
  `;
}

class HaTileInfo extends LitElement {
  render() {
    return html`<div class="info">
      <span class="primary"><slot name="primary"></slot></span>
      <span class="secondary"><slot name="secondary"></slot></span>
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
      min-width: 0;
      flex: 1;
    }
    .info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
    }
    .primary {
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      color: var(--primary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .secondary {
      font-size: 12px;
      font-weight: 400;
      line-height: 16px;
      color: var(--secondary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;
}

class StateDisplay extends LitElement {
  static properties = {
    hass: { attribute: false },
    stateObj: { attribute: false },
  };
  declare hass?: Hass;
  declare stateObj?: HassEntity;

  render() {
    if (!this.stateObj) return nothing;
    return this.hass?.formatEntityState?.(this.stateObj) ?? this.stateObj.state;
  }
}

class HuiWarning extends LitElement {
  render() {
    return html`<div class="warning"><slot></slot></div>`;
  }

  static styles = css`
    .warning {
      padding: 12px 16px;
      color: #fff;
      background: var(--warning-color, #ff9800);
      border-radius: var(--ha-card-border-radius);
    }
  `;
}

class HuiTileCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
  };
  declare hass?: Hass;
  private declare _config?: TileCardConfig;

  setConfig(config: TileCardConfig) {
    if (!config?.entity) throw new Error('hui-tile-card needs an entity');
    this._config = config;
  }

  getCardSize(): number {
    const stackedFeatures =
      this._config?.features_position === 'inline' ? 0 : (this._config?.features?.length ?? 0);
    return 1 + (this._config?.vertical ? 1 : 0) + stackedFeatures;
  }

  getGridOptions(): Record<string, unknown> {
    const featureCount = this._config?.features?.length ?? 0;
    const inline = featureCount > 0 && this._config?.features_position === 'inline';
    const rows = 1 + (this._config?.vertical ? 1 : 0) + (inline ? 0 : featureCount);
    return {
      columns: inline ? 12 : 6,
      min_columns: inline ? 6 : 3,
      rows,
      min_rows: rows,
    };
  }

  render() {
    if (!this.hass || !this._config) return nothing;
    const stateObj = this.hass.states[this._config.entity];
    if (!stateObj) {
      return html`<hui-warning>Entity not found: ${this._config.entity}</hui-warning>`;
    }

    const name = this._config.name ?? (stateObj.attributes.friendly_name as string) ?? this._config.entity;
    const activeColor = TILE_COLOR[stateObj.state];
    const iconStyle = activeColor
      ? `color: ${activeColor}; background: color-mix(in srgb, ${activeColor} 20%, transparent);`
      : '';
    const features = this._config.features ?? [];
    const vertical = Boolean(this._config.vertical);
    const inline = features.length > 0 && this._config.features_position === 'inline';

    return html`<ha-card>
      <div class="container ${inline ? 'inline' : ''}">
        <div class="content ${vertical ? 'vertical' : ''}">
          <div class="icon" style=${iconStyle}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              ${svg`<path d=${iconPath(stateObj, this._config.icon)}></path>`}
            </svg>
          </div>
          <ha-tile-info slot="info">
            <span slot="primary">${name}</span>
            ${this._config.hide_state
              ? nothing
              : html`<span slot="secondary">
                  <state-display .hass=${this.hass} .stateObj=${stateObj}></state-display>
                </span>`}
          </ha-tile-info>
        </div>
        ${features.length
          ? html`<div class="features">
              ${features.map((feature) => this._renderFeature(feature, stateObj))}
            </div>`
          : nothing}
      </div>
    </ha-card>`;
  }

  private _renderFeature(feature: TileFeatureConfig, stateObj: HassEntity) {
    if (feature.type === 'climate-hvac-modes') {
      const modes =
        feature.hvac_modes ??
        (Array.isArray(stateObj.attributes.hvac_modes)
          ? (stateObj.attributes.hvac_modes as string[])
          : ['off', 'cool', 'heat']);
      return html`<div class="feature-modes">
        ${modes.map((mode) => {
          const active = stateObj.state === mode;
          const color = active ? TILE_COLOR[mode] ?? 'var(--primary-color)' : undefined;
          const style = color ? `background: ${color}; color: #fff;` : '';
          return html`<div class="mode ${active ? 'active' : ''}" style=${style} title=${mode}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              ${svg`<path d=${HVAC_MODE_ICON[mode] ?? mdi.mdiThermostat}></path>`}
            </svg>
          </div>`;
        })}
      </div>`;
    }
    if (feature.type === 'target-temperature') {
      const temp = stateObj.attributes.temperature;
      return html`<div class="feature-temp">
        <span class="temp-btn">
          <svg viewBox="0 0 24 24" aria-hidden="true">${svg`<path d=${mdi.mdiMinus}></path>`}</svg>
        </span>
        <span class="temp-value">${temp !== undefined ? `${temp} °C` : '—'}</span>
        <span class="temp-btn">
          <svg viewBox="0 0 24 24" aria-hidden="true">${svg`<path d=${mdi.mdiPlus}></path>`}</svg>
        </span>
      </div>`;
    }
    return nothing;
  }

  static styles = css`
    :host {
      display: block;
      max-width: 360px;
    }
    .container {
      display: flex;
      flex-direction: column;
      padding: 10px;
      gap: 10px;
    }
    .container.inline {
      flex-direction: row;
      align-items: center;
    }
    .content {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }
    .content.vertical {
      flex-direction: column;
      text-align: center;
    }
    .icon {
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--disabled-text-color);
      background: color-mix(in srgb, var(--disabled-text-color) 18%, transparent);
    }
    .icon svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
    .features {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .feature-modes {
      display: flex;
      gap: 6px;
      padding: 4px;
      border-radius: 10px;
      background: var(--primary-background-color);
    }
    .mode {
      flex: 1;
      height: 34px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--secondary-text-color);
    }
    .mode svg,
    .temp-btn svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    .feature-temp {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 40px;
      padding: 0 12px;
      border-radius: 10px;
      background: var(--primary-background-color);
      color: var(--primary-text-color);
      font-weight: 500;
    }
    .temp-btn {
      display: inline-flex;
      align-items: center;
      color: var(--secondary-text-color);
    }
  `;
}

class HaIcon extends LitElement {
  static properties = { icon: { type: String } };
  declare icon?: string;

  render() {
    const path = mdiPath(this.icon);
    if (!path) return nothing;
    return html`<svg viewBox="0 0 24 24" aria-hidden="true">${svg`<path d=${path}></path>`}</svg>`;
  }

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--mdc-icon-size, 24px);
      height: var(--mdc-icon-size, 24px);
      flex: 0 0 auto;
    }
    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  `;
}

for (const [tag, element] of [
  ['state-badge', StateBadge],
  ['ha-entity-toggle', EntityToggle],
  ['hui-generic-entity-row', GenericEntityRow],
  ['ha-card-frame', CardFrame],
  ['ha-card', HaCard],
  ['ha-icon', HaIcon],
  ['ha-tile-info', HaTileInfo],
  ['state-display', StateDisplay],
  ['hui-warning', HuiWarning],
  ['hui-tile-card', HuiTileCard],
] as const) {
  if (!customElements.get(tag)) customElements.define(tag, element);
}
