import type { SecondaryLine } from '../../core/entity-row';
import type { Hass, HassEntity } from '../../core/hass';
import { tileStatus } from '../countdown-tile/tile-status';

export type ClimateTone = 'neutral' | 'cool' | 'heat' | 'dry' | 'fan' | 'auto';

export interface ClimatePanelConfig {
  type?: string;
  entity: string;
  name?: string;
  hvac_modes?: string[];
  deadline_entity?: string;
  countdown_text?: string;
  due_text?: string;
  hold_entity?: string;
  hold_text?: string;
  power_entity?: string;
  step?: number;
}

export interface ClimateModeOption {
  mode: string;
  label: string;
  icon: string;
  tone: ClimateTone;
  active: boolean;
}

export interface ClimatePanelState {
  available: boolean;
  isOff: boolean;
  name: string;
  mode: string;
  modeLabel: string;
  modeTone: ClimateTone;
  pillText: string;
  targetTemp: number | undefined;
  targetTempDisplay: string;
  currentTemp: number | undefined;
  roomTempDisplay: string;
  step: number;
  minTemp: number;
  maxTemp: number;
  nextTempDown: number | undefined;
  nextTempUp: number | undefined;
  canStepDown: boolean;
  canStepUp: boolean;
  statusLine: SecondaryLine;
  modes: ClimateModeOption[];
}

const DEFAULT_HVAC_MODES = ['cool', 'heat'] as const;
const DEFAULT_MIN_TEMP = 16;
const DEFAULT_MAX_TEMP = 30;
const UNAVAILABLE_STATES = new Set(['unavailable', 'unknown']);

interface ModeMeta {
  label: string;
  icon: string;
  tone: ClimateTone;
}

const MODE_META: Record<string, ModeMeta> = {
  off: { label: 'Off', icon: 'mdi:power', tone: 'neutral' },
  cool: { label: 'Cool', icon: 'mdi:snowflake', tone: 'cool' },
  heat: { label: 'Heat', icon: 'mdi:fire', tone: 'heat' },
  dry: { label: 'Dry', icon: 'mdi:water-percent', tone: 'dry' },
  fan_only: { label: 'Fan', icon: 'mdi:fan', tone: 'fan' },
  auto: { label: 'Auto', icon: 'mdi:thermostat-auto', tone: 'auto' },
  heat_cool: { label: 'Auto', icon: 'mdi:thermostat-auto', tone: 'auto' },
};

function metaForMode(mode: string): ModeMeta {
  const known = MODE_META[mode];
  if (known) return known;
  const label = mode.replace(/_/g, ' ').replace(/^\w/, (ch) => ch.toUpperCase());
  return { label, icon: 'mdi:thermostat', tone: 'neutral' };
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function formatTemp(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}°`;
}

function formatPower(stateObj: HassEntity | undefined): string | undefined {
  if (!stateObj || UNAVAILABLE_STATES.has(stateObj.state)) return undefined;
  const numeric = finiteNumber(stateObj.state);
  if (numeric === undefined) return undefined;
  const unit =
    typeof stateObj.attributes.unit_of_measurement === 'string'
      ? stateObj.attributes.unit_of_measurement
      : 'W';
  const formatted = unit.toLowerCase() === 'kw' ? numeric.toFixed(1) : String(Math.round(numeric));
  return `${formatted} ${unit}`;
}

/** Steps `current` by `delta`, clamps to `[min, max]`, and strips binary float noise. */
export function clampTemperature(current: number, delta: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, current + delta));
  return Math.round(clamped * 100) / 100;
}

function resolveStatusLine(hass: Hass, config: ClimatePanelConfig, now: number, isOff: boolean): SecondaryLine {
  if (isOff) return { text: '', ticking: false };
  if (config.deadline_entity) {
    return tileStatus(
      hass,
      {
        entity: config.entity,
        deadline_entity: config.deadline_entity,
        countdown_text: config.countdown_text,
        due_text: config.due_text,
        hold_entity: config.hold_entity,
        hold_text: config.hold_text,
      },
      now,
    );
  }
  if (config.hold_entity && config.hold_text && hass.states[config.hold_entity]?.state === 'on') {
    return { text: config.hold_text, ticking: false };
  }
  return { text: '', ticking: false };
}

function buildModes(configured: readonly string[] | undefined, activeMode: string): ClimateModeOption[] {
  const seen = new Set<string>(['off']);
  const ordered = ['off'];
  for (const mode of configured ?? DEFAULT_HVAC_MODES) {
    if (!seen.has(mode)) {
      seen.add(mode);
      ordered.push(mode);
    }
  }
  return ordered.map((mode) => {
    const meta = metaForMode(mode);
    return { mode, ...meta, active: mode === activeMode };
  });
}

export function climatePanelState(hass: Hass, config: ClimatePanelConfig, now: number): ClimatePanelState {
  const stateObj = hass.states[config.entity];
  const name =
    config.name ??
    (typeof stateObj?.attributes.friendly_name === 'string' ? stateObj.attributes.friendly_name : undefined) ??
    config.entity;

  const available = Boolean(stateObj && !UNAVAILABLE_STATES.has(stateObj.state));
  const mode = stateObj?.state ?? 'unavailable';
  const isOff = !available || mode === 'off';

  const modeMeta = available ? metaForMode(mode) : { label: 'Unavailable', icon: 'mdi:thermostat', tone: 'neutral' as const };
  const powerText = !isOff && config.power_entity ? formatPower(hass.states[config.power_entity]) : undefined;
  const pillText = powerText ? `${modeMeta.label} · ${powerText}` : modeMeta.label;

  const targetTemp = finiteNumber(stateObj?.attributes.temperature);
  const currentTemp = finiteNumber(stateObj?.attributes.current_temperature);
  const attrStep = finiteNumber(stateObj?.attributes.target_temp_step);
  const step = config.step && config.step > 0 ? config.step : attrStep && attrStep > 0 ? attrStep : 1;
  const minTemp = finiteNumber(stateObj?.attributes.min_temp) ?? DEFAULT_MIN_TEMP;
  const maxTemp = finiteNumber(stateObj?.attributes.max_temp) ?? DEFAULT_MAX_TEMP;

  const targetTempDisplay = !available
    ? '—'
    : mode === 'off'
      ? 'Off'
      : targetTemp !== undefined
        ? formatTemp(targetTemp)
        : '—';

  const roomTempDisplay = currentTemp !== undefined ? `Room ${formatTemp(currentTemp)}` : '';
  const nextTempDown = targetTemp !== undefined ? clampTemperature(targetTemp, -step, minTemp, maxTemp) : undefined;
  const nextTempUp = targetTemp !== undefined ? clampTemperature(targetTemp, step, minTemp, maxTemp) : undefined;
  const canStepDown = !isOff && targetTemp !== undefined && targetTemp > minTemp;
  const canStepUp = !isOff && targetTemp !== undefined && targetTemp < maxTemp;

  return {
    available,
    isOff,
    name,
    mode,
    modeLabel: modeMeta.label,
    modeTone: modeMeta.tone,
    pillText,
    targetTemp,
    targetTempDisplay,
    currentTemp,
    roomTempDisplay,
    step,
    minTemp,
    maxTemp,
    nextTempDown,
    nextTempUp,
    canStepDown,
    canStepUp,
    statusLine: resolveStatusLine(hass, config, now, isOff),
    modes: buildModes(config.hvac_modes, available ? mode : ''),
  };
}
