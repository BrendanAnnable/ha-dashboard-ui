import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { getLoadCardHelpers, type CardHelpers } from '../../core/ha-elements';
import type { Hass } from '../../core/hass';
import { tileConfigFor, tileStatus, type CountdownTileStatusConfig } from './tile-status';

export interface CountdownTileConfig extends CountdownTileStatusConfig {
  type?: string;
  name?: string;
  icon?: string;
  color?: string;
  hide_state?: boolean;
  vertical?: boolean;
  features?: unknown[];
  features_position?: 'bottom' | 'inline';
  [key: string]: unknown;
}

interface HuiTileCard extends HTMLElement {
  hass?: Hass;
  setConfig(config: Record<string, unknown>): void;
  updateComplete?: Promise<unknown>;
  getCardSize?(): number;
  getGridOptions?(): Record<string, unknown>;
}

function formatSuffix(text: string, hasStateDisplay: boolean): string {
  if (!text) return '';
  return hasStateDisplay ? ` · ${text}` : text;
}

/**
 * Wraps Home Assistant's built-in `hui-tile-card` and appends a live countdown
 * (or hold status) to its secondary line without re-implementing tile visuals,
 * actions, or features.
 */
export class CountdownTile extends LitElement {
  static properties = {
    hass: { attribute: false },
    now: { attribute: false },
    _tile: { state: true },
  };

  declare hass?: Hass;
  /** The clock this tile reads. Stories and tests pin it; HA uses the real time. */
  declare now: () => number;
  private declare _tile?: HuiTileCard;
  private _config?: CountdownTileConfig;
  private _timer?: ReturnType<typeof setInterval>;
  private _loadVersion = 0;
  private _syncToken = 0;
  private _syncPromise: Promise<void> = Promise.resolve();

  constructor() {
    super();
    this.now = () => Date.now();
  }

  setConfig(config: CountdownTileConfig): void {
    if (!config?.entity) throw new Error(`${this.localName} needs an entity`);
    if (!config.deadline_entity) throw new Error(`${this.localName} needs a deadline_entity`);

    this._config = config;
    const tileConfig = tileConfigFor(config);
    const version = ++this._loadVersion;

    if (this._tile) {
      this._tile.setConfig(tileConfig);
      this._syncPromise = this._sync();
      return;
    }

    const load = getLoadCardHelpers();
    if (!load) {
      const tile = document.createElement('hui-tile-card') as HuiTileCard;
      tile.setConfig(tileConfig);
      this._tile = tile;
      return;
    }

    void this._loadTile(load, tileConfig, version);
  }

  getCardSize(): number {
    if (this._tile?.getCardSize) return this._tile.getCardSize();
    const stackedFeatures =
      this._config?.features_position === 'inline' ? 0 : (this._config?.features?.length ?? 0);
    return 1 + (this._config?.vertical ? 1 : 0) + stackedFeatures;
  }

  getGridOptions(): Record<string, unknown> {
    if (this._tile?.getGridOptions) return this._tile.getGridOptions();
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

  connectedCallback(): void {
    super.connectedCallback();
    if (this._tile && this.hass && this._config) {
      this._syncPromise = this._sync();
    }
  }

  disconnectedCallback(): void {
    this._syncToken++;
    this._stopTicking();
    super.disconnectedCallback();
  }

  protected render() {
    return html`${this._tile ?? nothing}`;
  }

  protected updated(changed: PropertyValues): void {
    if ((changed.has('hass') || changed.has('_tile')) && this._tile && this.hass) {
      this._tile.hass = this.hass;
    }
    this._syncPromise = this._sync();
  }

  protected override async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    await this._syncPromise;
    return result;
  }

  private async _loadTile(
    load: () => Promise<CardHelpers>,
    tileConfig: Record<string, unknown>,
    version: number,
  ): Promise<void> {
    const helpers = await load();
    if (version !== this._loadVersion) return;

    const tile = (await helpers.createCardElement(tileConfig)) as HuiTileCard;
    if (version !== this._loadVersion) return;

    const alreadyDefined = Boolean(customElements.get(tile.localName));
    if (!alreadyDefined) {
      await customElements.whenDefined(tile.localName);
      if (version !== this._loadVersion) return;
      tile.setConfig?.(tileConfig);
    }

    this._tile = tile;
  }

  private async _sync(): Promise<void> {
    const token = ++this._syncToken;
    const tile = this._tile;
    if (!tile || !this.hass || !this._config) {
      this._stopTicking();
      return;
    }

    await tile.updateComplete;
    if (token !== this._syncToken || tile !== this._tile || !this.hass || !this._config) return;

    this._updateCountdown(tile);
  }

  private _updateCountdown(tile: HuiTileCard): void {
    if (!this.hass || !this._config) {
      this._stopTicking();
      return;
    }

    const status = tileStatus(this.hass, this._config, this.now());
    const target = this._attachSpan(tile);
    if (target) {
      const next = formatSuffix(status.text, target.hasStateDisplay);
      if (target.span.textContent !== next) {
        target.span.textContent = next;
      }
    }

    if (status.ticking && this.isConnected) {
      this._startTicking();
    } else {
      this._stopTicking();
    }
  }

  private _attachSpan(tile: HuiTileCard): { span: HTMLSpanElement; hasStateDisplay: boolean } | undefined {
    const info = tile.shadowRoot?.querySelector('ha-tile-info');
    if (!info) return undefined;

    let secondary = info.querySelector<HTMLElement>(':scope > [slot="secondary"]:not([data-dash-secondary])');
    const created = info.querySelector<HTMLElement>(':scope > [data-dash-secondary]');
    if (secondary) {
      created?.remove();
    } else if (created) {
      secondary = created;
    } else {
      secondary = document.createElement('span');
      secondary.setAttribute('slot', 'secondary');
      secondary.dataset.dashSecondary = '';
      info.append(secondary);
    }

    let span = secondary.querySelector<HTMLSpanElement>(':scope > span[data-dash-countdown]');
    if (!span) {
      span = document.createElement('span');
      span.dataset.dashCountdown = '';
      secondary.append(span);
    }

    return { span, hasStateDisplay: secondary.querySelector('state-display') !== null };
  }

  private _startTicking(): void {
    if (this._timer) return;
    this._timer = setInterval(() => {
      if (!this._tile) {
        this._stopTicking();
        return;
      }
      this._updateCountdown(this._tile);
    }, 1000);
  }

  private _stopTicking(): void {
    clearInterval(this._timer);
    this._timer = undefined;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;
}
