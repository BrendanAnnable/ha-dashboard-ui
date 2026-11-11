/**
 * Stand-ins for the three Home Assistant elements our rows render inside HA:
 * `hui-generic-entity-row`, `state-badge` and `ha-entity-toggle`. Layout and
 * colours follow HA's frontend (Apache-2.0, github.com/home-assistant/frontend);
 * behaviour is reduced to what a story needs. They are never bundled: inside
 * HA the real elements are used.
 *
 * `ha-card-frame` stands in for an entities card, so rows sit with HA's
 * spacing and padding.
 */
import * as mdi from '@mdi/js';
import { LitElement, css, html, nothing, svg } from 'lit';
import type { EntityRowConfig, Hass, HassEntity } from '../src/core/hass';

const domainOf = (id: string) => id.split('.')[0];

function iconPath(stateObj: HassEntity | undefined, override?: string): string {
  if (override?.startsWith('mdi:')) {
    const key = `mdi${override
      .slice(4)
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')}`;
    const path = (mdi as Record<string, string>)[key];
    if (path) return path;
  }
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

for (const [tag, element] of [
  ['state-badge', StateBadge],
  ['ha-entity-toggle', EntityToggle],
  ['hui-generic-entity-row', GenericEntityRow],
  ['ha-card-frame', CardFrame],
] as const) {
  if (!customElements.get(tag)) customElements.define(tag, element);
}
