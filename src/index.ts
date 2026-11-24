import { ClimatePanel } from './cards/climate-panel/climate-panel';
import { CountdownTile } from './cards/countdown-tile/countdown-tile';
import { PresetPanel } from './cards/preset-panel/preset-panel';
import { StatusBar } from './cards/status-bar/status-bar';
import { ChannelRow } from './rows/channel/channel-row';
import { CountdownRow } from './rows/countdown/countdown-row';

declare const __VERSION__: string;
/** False only for side-by-side test builds, so they cannot take over rows using the old name. */
declare const __LEGACY_ALIAS__: boolean;

function define(tag: string, element: CustomElementConstructor) {
  if (!customElements.get(tag)) customElements.define(tag, element);
}

define('dash-countdown-row', CountdownRow);
define('dash-channel-row', ChannelRow);
define('dash-countdown-tile', CountdownTile);
define('dash-climate-panel', ClimatePanel);
define('dash-preset-panel', PresetPanel);
define('dash-status-bar', StatusBar);
/** The name the first version of the channel row used; kept so old dashboards keep working. */
if (__LEGACY_ALIAS__) define('channel-countdown-row', class extends ChannelRow {});

console.info(`%c ha-dashboard-ui %c ${__VERSION__} `, 'background:#03a9f4;color:#fff', '');

export { ChannelRow, ClimatePanel, CountdownRow, CountdownTile, PresetPanel, StatusBar };
