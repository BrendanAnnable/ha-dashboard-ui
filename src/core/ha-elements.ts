/**
 * HA lazy-loads its row elements. A dashboard with no built-in toggle row may
 * not have defined `hui-generic-entity-row` yet, so ask HA's card helpers to
 * create a toggle row once, which pulls in the row, badge and toggle.
 */
const NEEDED = ['hui-generic-entity-row', 'ha-entity-toggle'];

let loading: Promise<void> | undefined;

export interface CardHelpers {
  createRowElement(config: { type?: string; entity: string }): HTMLElement;
  createCardElement(config: Record<string, unknown>): HTMLElement | Promise<HTMLElement>;
}

export function getLoadCardHelpers(): (() => Promise<CardHelpers>) | undefined {
  return (window as { loadCardHelpers?: () => Promise<CardHelpers> }).loadCardHelpers;
}

export function ensureHaRowElements(): Promise<void> {
  if (NEEDED.every((tag) => customElements.get(tag))) return Promise.resolve();
  loading ??= (async () => {
    const load = getLoadCardHelpers();
    if (load) {
      const helpers = await load();
      helpers.createRowElement({ type: 'toggle', entity: 'switch.ha_dashboard_ui_loader' });
    }
    await Promise.all(NEEDED.map((tag) => customElements.whenDefined(tag)));
  })();
  return loading;
}
