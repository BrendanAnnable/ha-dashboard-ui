import type { Hass, HassEntity } from '../../core/hass';

export type TimeFormat = '12h' | '24h';
export type ChipTone = 'default' | 'ok' | 'warn' | 'danger';
export type ChipTapActionKind = 'more-info' | 'toggle' | 'none';

export interface StatusBarChipBadgeConfig {
  attribute: string;
  equals: unknown;
  icon?: string;
  else_text?: string;
}

export interface StatusBarChipConfig {
  label?: string;
  entity?: string;
  value_attribute?: string;
  secondary_entity?: string;
  icon?: string;
  unit?: string;
  scale?: number;
  decimals?: number;
  secondary_decimals?: number;
  ok_state?: string;
  ok_above?: number;
  ok_below?: number;
  warn_state?: string;
  warn_above?: number;
  warn_below?: number;
  warn_entity?: string;
  warn_badge?: string;
  danger_state?: string;
  danger_above?: number;
  danger_below?: number;
  badge?: StatusBarChipBadgeConfig;
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

export type ChipBadgeView =
  | { kind: 'icon'; icon: string }
  | { kind: 'text'; text: string };

export interface StatusBarChipView {
  label: string;
  value: string;
  text: string;
  icon?: string;
  tone: ChipTone;
  warnBadge?: string;
  badge?: ChipBadgeView;
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
const TIGHT_UNITS = new Set(['%', '°', '¢']);

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

function readAttributePath(attributes: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  if (Object.prototype.hasOwnProperty.call(attributes, path)) {
    return attributes[path];
  }
  let current: unknown = attributes;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment)) return undefined;
      current = current[Number(segment)];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function parseNumeric(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function applyScale(value: number, scale: number | undefined): number {
  if (scale === undefined) return value;
  const scaled = value * scale;
  return Number.isFinite(scaled) ? Number(scaled.toPrecision(12)) : scaled;
}

function attachUnit(value: string, unit: string): string {
  if (!unit) return value;
  return TIGHT_UNITS.has(unit) ? `${value}${unit}` : `${value} ${unit}`;
}

interface ResolvedValue {
  rawText: string;
  fromAttribute: boolean;
  numeric?: number;
}

function resolveRawValue(
  stateObj: HassEntity | undefined,
  valueAttribute?: string,
  scale?: number,
): ResolvedValue | undefined {
  if (!stateObj || UNAVAILABLE_STATES.has(stateObj.state)) return undefined;

  let raw: unknown = stateObj.state;
  let fromAttribute = false;
  if (valueAttribute) {
    const attrValue = readAttributePath(stateObj.attributes, valueAttribute);
    if (attrValue !== undefined && attrValue !== null) {
      raw = attrValue;
      fromAttribute = true;
    }
  }

  const parsed = parseNumeric(raw);
  const numeric = parsed !== undefined ? applyScale(parsed, scale) : undefined;
  return {
    rawText: String(raw),
    fromAttribute,
    numeric,
  };
}

function formatNumber(numeric: number, rawText: string, options: { decimals?: number; scale?: number }): string {
  if (options.decimals !== undefined) {
    const rounded = numeric.toFixed(options.decimals);
    return Number(rounded) === 0 ? (0).toFixed(options.decimals) : rounded;
  }
  if (options.scale !== undefined) {
    return String(Object.is(numeric, -0) ? 0 : numeric);
  }
  return rawText;
}

function formatResolvedValue(
  hass: Hass,
  stateObj: HassEntity | undefined,
  resolved: ResolvedValue | undefined,
  options: { unit?: string; decimals?: number; scale?: number },
): string {
  if (!resolved || !stateObj) return '—';
  if (resolved.numeric !== undefined) {
    const numberText = formatNumber(resolved.numeric, resolved.rawText, options);
    const unit =
      options.unit ??
      (typeof stateObj.attributes.unit_of_measurement === 'string'
        ? stateObj.attributes.unit_of_measurement
        : '');
    return attachUnit(numberText, unit);
  }
  if (!resolved.fromAttribute && hass.formatEntityState) {
    return hass.formatEntityState(stateObj);
  }
  return resolved.rawText.charAt(0).toUpperCase() + resolved.rawText.slice(1);
}

function matchesThreshold(
  rawText: string,
  numeric: number | undefined,
  stateMatch?: string,
  above?: number,
  below?: number,
): boolean {
  if (stateMatch !== undefined && rawText === stateMatch) return true;
  if (numeric !== undefined) {
    if (above !== undefined && numeric > above) return true;
    if (below !== undefined && numeric < below) return true;
  }
  return false;
}

function resolveTone(
  resolved: ResolvedValue | undefined,
  chip: StatusBarChipConfig,
  warnEntityOn: boolean,
): ChipTone {
  if (
    resolved &&
    matchesThreshold(resolved.rawText, resolved.numeric, chip.danger_state, chip.danger_above, chip.danger_below)
  ) {
    return 'danger';
  }
  if (
    warnEntityOn ||
    (resolved &&
      matchesThreshold(resolved.rawText, resolved.numeric, chip.warn_state, chip.warn_above, chip.warn_below))
  ) {
    return 'warn';
  }
  if (
    resolved &&
    matchesThreshold(resolved.rawText, resolved.numeric, chip.ok_state, chip.ok_above, chip.ok_below)
  ) {
    return 'ok';
  }
  return 'default';
}

function resolveBadge(
  stateObj: HassEntity | undefined,
  badge: StatusBarChipBadgeConfig | undefined,
): ChipBadgeView | undefined {
  if (!stateObj || !badge) return undefined;
  const value = readAttributePath(stateObj.attributes, badge.attribute);
  if (value === badge.equals) {
    return badge.icon ? { kind: 'icon', icon: badge.icon } : undefined;
  }
  if (value !== undefined) {
    return badge.else_text ? { kind: 'text', text: badge.else_text } : undefined;
  }
  return undefined;
}

function resolveAction(chip: StatusBarChipConfig): ChipAction {
  if (chip.navigate_path) return { kind: 'navigate', path: chip.navigate_path };
  const tap = chip.tap_action ?? (chip.entity ? 'more-info' : 'none');
  if (tap === 'none' || !chip.entity) return { kind: 'none' };
  return { kind: tap, entityId: chip.entity };
}

function buildChip(hass: Hass, chip: StatusBarChipConfig): StatusBarChipView {
  const primaryState = chip.entity ? hass.states[chip.entity] : undefined;
  const primaryResolved = resolveRawValue(primaryState, chip.value_attribute, chip.scale);
  const primary = chip.entity
    ? formatResolvedValue(hass, primaryState, primaryResolved, {
        unit: chip.unit,
        decimals: chip.decimals,
        scale: chip.scale,
      })
    : '';

  const secondaryState = chip.secondary_entity ? hass.states[chip.secondary_entity] : undefined;
  const secondary = chip.secondary_entity
    ? formatResolvedValue(hass, secondaryState, resolveRawValue(secondaryState), {
        decimals: chip.secondary_decimals,
      })
    : '';

  const value = primary && secondary ? `${primary} · ${secondary}` : primary || secondary;
  const label = chip.label ?? '';
  const text = label && value ? `${label} · ${value}` : label || value;
  const warnEntityOn = Boolean(chip.warn_entity && hass.states[chip.warn_entity]?.state === 'on');
  const warnBadge = warnEntityOn && chip.warn_badge ? chip.warn_badge : undefined;
  const badge = resolveBadge(primaryState, chip.badge);

  return {
    label,
    value,
    text,
    icon: chip.icon,
    tone: resolveTone(primaryResolved, chip, warnEntityOn),
    ...(warnBadge ? { warnBadge } : {}),
    ...(badge ? { badge } : {}),
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
