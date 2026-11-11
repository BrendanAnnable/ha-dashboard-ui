import { describe, expect, it } from 'vitest';
import { fakeHass } from '../storybook/fixtures';
import { findSibling } from './discover';

const status = { name: 'Status', suffix: 'status', domains: ['sensor'] };

describe('findSibling', () => {
  it('finds the entity on the same device by its own name', () => {
    const hass = fakeHass({
      'switch.porch_relay': { state: 'on', device: 'porch' },
      'sensor.porch_recovery_status': { state: 'restored', name: 'Recovery Status', device: 'porch' },
      'sensor.porch_renamed_thing': { state: 'timer', name: 'Status', device: 'porch' },
    });
    expect(findSibling(hass, 'switch.porch_relay', status)).toBe('sensor.porch_renamed_thing');
  });

  it('falls back to the entity ID ending, preferring the shortest match', () => {
    const hass = fakeHass({
      'switch.porch_relay': { state: 'on', device: 'porch' },
      'sensor.porch_recovery_status': { state: 'restored', name: 'Porch thing', device: 'porch' },
      'sensor.porch_status': { state: 'timer', name: 'Porch other thing', device: 'porch' },
    });
    expect(findSibling(hass, 'switch.porch_relay', status)).toBe('sensor.porch_status');
  });

  it('never looks at other devices or other domains', () => {
    const hass = fakeHass({
      'switch.porch_relay': { state: 'on', device: 'porch' },
      'sensor.garden_status': { state: 'timer', name: 'Status', device: 'garden' },
      'binary_sensor.porch_status': { state: 'on', name: 'Status', device: 'porch' },
    });
    expect(findSibling(hass, 'switch.porch_relay', status)).toBeUndefined();
  });

  it('finds nothing for an entity without a device', () => {
    const hass = fakeHass({
      'switch.porch_relay': { state: 'on' },
      'sensor.porch_status': { state: 'timer', name: 'Status' },
    });
    expect(findSibling(hass, 'switch.porch_relay', status)).toBeUndefined();
  });
});
