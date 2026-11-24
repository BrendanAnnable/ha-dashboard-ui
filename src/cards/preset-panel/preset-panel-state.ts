import { textFor } from '../../core/countdown';
import type { Hass, HassEntity } from '../../core/hass';
import { channelLine, resolveChannel, type ChannelOverrides } from '../../rows/channel/channel-status';

export type PresetColor = 'neutral' | 'amber' | 'purple' | 'cool' | 'green' | 'heat';

export interface PresetMatch {
  state?: string;
  preset_mode?: string;
  brightness_min?: number;
  brightness_max?: number;
}

export interface PresetItem {
  label: string;
  icon?: string;
  color?: PresetColor;
  action: string;
  data?: Record<string, unknown>;
  match: PresetMatch;
}

export interface PresetPanelConfig extends ChannelOverrides {
  type?: string;
  entity: string;
  name?: string;
  presets: PresetItem[];
  countdown_text?: string;
  due_text?: string;
}

export interface PresetOptionView {
  label: string;
  icon?: string;
  color: PresetColor;
  action: string;
  data?: Record<string, unknown>;
  active: boolean;
}

export interface PresetPanelState {
  available: boolean;
  name: string;
  activeIndex: number;
  activeColor: PresetColor;
  statusText: string;
  ticking: boolean;
  presets: PresetOptionView[];
}

const INACTIVE_STATES = new Set(['off', 'unavailable', 'unknown']);
const UNAVAILABLE_STATES = new Set(['unavailable', 'unknown']);

export function parseServiceAction(action: string): { domain: string; service: string } | undefined {
  const dot = action.indexOf('.');
  if (dot <= 0 || dot === action.length - 1) return undefined;
  return { domain: action.slice(0, dot), service: action.slice(dot + 1) };
}

function matchesPreset(stateObj: HassEntity, match: PresetMatch): boolean {
  const hasAnyCriterion =
    match.state !== undefined ||
    match.preset_mode !== undefined ||
    match.brightness_min !== undefined ||
    match.brightness_max !== undefined;
  if (!hasAnyCriterion) return false;

  if (match.state !== undefined) {
    if (stateObj.state !== match.state) return false;
  } else if (INACTIVE_STATES.has(stateObj.state)) {
    // Attribute-only matchers (preset_mode/brightness) never match an off or unavailable entity.
    return false;
  }

  if (match.preset_mode !== undefined && stateObj.attributes.preset_mode !== match.preset_mode) {
    return false;
  }

  if (match.brightness_min !== undefined || match.brightness_max !== undefined) {
    const brightness = stateObj.attributes.brightness;
    if (typeof brightness !== 'number' || !Number.isFinite(brightness)) return false;
    if (match.brightness_min !== undefined && brightness < match.brightness_min) return false;
    if (match.brightness_max !== undefined && brightness > match.brightness_max) return false;
  }

  return true;
}

export function activePresetIndex(
  stateObj: HassEntity | undefined,
  presets: readonly PresetItem[],
): number {
  if (!stateObj || UNAVAILABLE_STATES.has(stateObj.state)) return -1;
  return presets.findIndex((preset) => matchesPreset(stateObj, preset.match));
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

export function presetPanelState(hass: Hass, config: PresetPanelConfig, now: number): PresetPanelState {
  const stateObj = hass.states[config.entity];
  const name =
    config.name ??
    (typeof stateObj?.attributes.friendly_name === 'string' ? stateObj.attributes.friendly_name : undefined) ??
    config.entity;

  const available = Boolean(stateObj && !UNAVAILABLE_STATES.has(stateObj.state));
  const activeIndex = activePresetIndex(stateObj, config.presets);
  const activePreset = activeIndex >= 0 ? config.presets[activeIndex] : undefined;
  const activeColor: PresetColor = activePreset?.color ?? 'neutral';

  const channel = resolveChannel(hass, config.entity, config);
  const hasChannel = Boolean(channel.deadline || channel.occupied || channel.status);
  const channelStatus = hasChannel
    ? channelLine(hass, config.entity, channel, textFor(config), now)
    : { text: '', ticking: false };

  const primaryLabel = !available
    ? 'Unavailable'
    : activePreset
      ? activePreset.label
      : capitalize(stateObj!.state);

  const statusText =
    primaryLabel && channelStatus.text
      ? `${primaryLabel} · ${channelStatus.text}`
      : primaryLabel || channelStatus.text;

  return {
    available,
    name,
    activeIndex,
    activeColor,
    statusText,
    ticking: channelStatus.ticking,
    presets: config.presets.map((preset, index) => ({
      label: preset.label,
      icon: preset.icon,
      color: preset.color ?? 'neutral',
      action: preset.action,
      data: preset.data,
      active: index === activeIndex,
    })),
  };
}
