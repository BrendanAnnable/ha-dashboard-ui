import type { Hass, HassEntity } from '../../core/hass';

export type TimeFormat = '12h' | '24h';
export type ChipTone = 'default' | 'ok' | 'warn';
export type ChipTapActionKind = 'more-info' | 'toggle' | 'none';

export interface StatusBarChipConfig {
  label?: string;
  entity?: string;
  secondary_entity?: string;
  icon?: string;
  unit?: string;
  decimals?: number;
  secondary_decimals?: number;
  ok_state?: string;
  warn_state?: string;
  warn_above?: number;
  warn_below?: number;
  navigate_path?: string;
  tap_action?: ChipTapActionKind;
}

export interface StatusBarConfig {
  type?: string;
  show_clock?: boolean;
  time_format?: TimeFormat;
  weather_entity?: string;
  chips?: StatusBarChipConfig[];
}

export type ChipAction =
  | { kind: 'navigate'; path: string }
  | { kind: 'more-info'; entityId: string }
  | { kind: 'toggle'; entityId: string }
  | { kind: 'none' };

export interface StatusBarChipView {
  label: string;
  value: string;
  text: string;
  icon?: string;
  tone: ChipTone;
  action: ChipAction;
}

export interface WeatherView {
  entityId: string;
  icon: string;
  temperature: string;
}

export interface StatusBarState {
  clockText: string;
  dateText: string;
  weather?: WeatherView;
  chips: StatusBarChipView[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const UNAVAILABLE_STATES = new Set(['unavailable', 'unknown']);

const WEATHER_ICONS: Record<string, string> = {
  'clear-night': 'mdi:weather-night',
  cloudy: 'mdi:weather-cloudy',
  exceptional: 'mdi:alert-circle-outline',
  fog: 'mdi:weather-fog',
  hail: 'mdi:weather-hail',
  lightning: 'mdi:weather-lightning',
  'lightning-rainy': 'mdi:weather-lightning-rainy',
  partlycloudy: 'mdi:weather-partly-cloudy',
  pouring: 'mdi:weather-pouring',
  rainy: 'mdi:weather-rainy',
  snowy: 'mdi:weather-snowy',
  'snowy-rainy': 'mdi:weather-snowy-rainy',
  sunny: 'mdi:weather-sunny',
  windy: 'mdi:weather-windy',
  'windy-variant': 'mdi:weather-windy-variant',
};

export function formatClock(now: number, timeFormat: TimeFormat = '12h'): string {
  const date = new Date(now);
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  if (timeFormat === '24h') {
    return `${String(hours24).padStart(2, '0')}:${minutes}`;
  }
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes} ${period}`;
}

export function formatDate(now: number): string {
  const date = new Date(now);
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function weatherIcon(condition: string | undefined): string {
  return (condition && WEATHER_ICONS[condition]) || 'mdi:weather-partly-cloudy';
}

function parseNumeric(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function attachUnit(value: string, unit: string): string {
  if (!unit) return value;
  return unit === '%' || unit === '°' ? `${value}${unit}` : `${value} ${unit}`;
}

function formatEntityValue(
  hass: Hass,
  stateObj: HassEntity | undefined,
  options: { unit?: string; decimals?: number },
): string {
  if (!stateObj || UNAVAILABLE_STATES.has(stateObj.state)) return '—';
  const numeric = parseNumeric(stateObj.state);
  if (numeric !== undefined) {
    const numberText = options.decimals !== undefined ? numeric.toFixed(options.decimals) : stateObj.state;
    const unit =
      options.unit ??
      (typeof stateObj.attributes.unit_of_measurement === 'string'
        ? stateObj.attributes.unit_of_measurement
        : '');
    return attachUnit(numberText, unit);
  }
  return (
    hass.formatEntityState?.(stateObj) ??
    (stateObj.state.charAt(0).toUpperCase() + stateObj.state.slice(1))
  );
}

function resolveTone(stateObj: HassEntity | undefined, chip: StatusBarChipConfig): ChipTone {
  if (!stateObj || UNAVAILABLE_STATES.has(stateObj.state)) return 'default';
  if (chip.warn_state !== undefined && stateObj.state === chip.warn_state) return 'warn';

  const numeric = parseNumeric(stateObj.state);
  if (numeric !== undefined) {
    if (chip.warn_above !== undefined && numeric > chip.warn_above) return 'warn';
    if (chip.warn_below !== undefined && numeric < chip.warn_below) return 'warn';
  }

  if (chip.ok_state !== undefined && stateObj.state === chip.ok_state) return 'ok';
  return 'default';
}

function resolveAction(chip: StatusBarChipConfig): ChipAction {
  if (chip.navigate_path) return { kind: 'navigate', path: chip.navigate_path };
  const tap = chip.tap_action ?? (chip.entity ? 'more-info' : 'none');
  if (tap === 'none' || !chip.entity) return { kind: 'none' };
  return { kind: tap, entityId: chip.entity };
}

function buildChip(hass: Hass, chip: StatusBarChipConfig): StatusBarChipView {
  const primaryState = chip.entity ? hass.states[chip.entity] : undefined;
  const primary = chip.entity
    ? formatEntityValue(hass, primaryState, { unit: chip.unit, decimals: chip.decimals })
    : '';

  const secondary = chip.secondary_entity
    ? formatEntityValue(hass, hass.states[chip.secondary_entity], { decimals: chip.secondary_decimals })
    : '';

  const value = primary && secondary ? `${primary} · ${secondary}` : primary || secondary;
  const label = chip.label ?? '';
  const text = label && value ? `${label} · ${value}` : label || value;

  return {
    label,
    value,
    text,
    icon: chip.icon,
    tone: resolveTone(primaryState, chip),
    action: resolveAction(chip),
  };
}

function buildWeather(hass: Hass, entityId: string | undefined): WeatherView | undefined {
  if (!entityId) return undefined;
  const stateObj = hass.states[entityId];
  if (!stateObj || UNAVAILABLE_STATES.has(stateObj.state)) return undefined;

  const rawTemp = stateObj.attributes.temperature;
  const temp = typeof rawTemp === 'number' && Number.isFinite(rawTemp) ? `${Math.round(rawTemp * 10) / 10}°` : '';
  return {
    entityId,
    icon: weatherIcon(stateObj.state),
    temperature: temp,
  };
}

export function statusBarState(hass: Hass, config: StatusBarConfig, now: number): StatusBarState {
  const showClock = config.show_clock !== false;
  return {
    clockText: showClock ? formatClock(now, config.time_format ?? '12h') : '',
    dateText: showClock || config.weather_entity ? formatDate(now) : '',
    weather: buildWeather(hass, config.weather_entity),
    chips: (config.chips ?? []).map((chip) => buildChip(hass, chip)),
  };
}
