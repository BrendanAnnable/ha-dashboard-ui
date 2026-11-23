# ha-dashboard-ui

Custom rows and cards for Home Assistant dashboards. Each one wraps Home
Assistant's own row or tile element, so it looks and behaves like a built-in
one: same icon, toggle, features, tap and hold actions, more-info dialog. Every
state is developed and tested in Storybook.

| Element | What it shows |
|---|---|
| [`custom:dash-countdown-row`](#countdown-row) | Any entity row, with a second line counting down to a timestamp sensor or `timer.*` entity |
| [`custom:dash-channel-row`](#channel-row) | A light or relay run by a motion-controlled channel: Motion, Presence, Fading off, or the countdown to its automatic turn-off |
| [`custom:dash-countdown-tile`](#countdown-tile) | A built-in tile card with a live countdown (or hold label) appended to its secondary line |

## Install

**Marketplace** (built into Home Assistant; HACS on older versions):
Marketplace → ⋮ → Custom repositories → add
`https://github.com/BrendanAnnable/ha-dashboard-ui` as **Dashboard** →
install **HA Dashboard UI**. It adds the dashboard resource and offers each new
release as an update.

**Manually:** download `ha-dashboard-ui.js` from the
[latest release](https://github.com/BrendanAnnable/ha-dashboard-ui/releases/latest)
into `config/www/`, then add `/local/ha-dashboard-ui.js` as a JavaScript module
under Settings → Dashboards → ⋮ → Resources.

The rows go inside an entities card alongside built-in rows; the tile card goes
anywhere a built-in `tile` card does.

## Countdown row

For anything with a timestamp sensor or `timer.*` entity saying when it will
next change: a towel rail on a timer, a door that relocks itself.

```yaml
type: entities
entities:
  - type: custom:dash-countdown-row
    entity: lock.front_door
    deadline_entity: sensor.front_door_relock_at
    countdown_text: Locks in {time}
    due_text: Locking
```

| Option | Default | |
|---|---|---|
| `entity` | required | The entity the row shows and toggles |
| `deadline_entity` | required | A timestamp sensor (`device_class: timestamp`) or `timer.*` entity |
| `countdown_text` | `Off in {time}` | Second line while counting down; `{time}` reads `3m 05s` or `42s` |
| `due_text` | `Turning off` | Second line from the deadline until a minute after it |

For a `timer.*` entity, the countdown reads `attributes.finishes_at` while the
timer is `active` and is empty when `idle`, `paused`, or `unavailable`. For a
timestamp sensor, the second line is empty when the sensor is unknown or its
time is more than a minute past, so a stale sensor never leaves the row stuck.
Entities with on/off states get a toggle; others (a lock) show their state.

## Countdown tile

Wraps Home Assistant's built-in `tile` card and appends a live countdown (or
optional hold label) to its secondary line—for example, a climate tile showing
`Cool · Off in 15m 00s`, `Cool · Turning off`, or `Cool · Lights on`.

```yaml
type: custom:dash-countdown-tile
entity: climate.office_ac
deadline_entity: timer.office_ac_auto_off
hold_entity: binary_sensor.office_lights
hold_text: Lights on
features:
  - type: climate-hvac-modes
    hvac_modes: [off, cool, heat, fan_only]
  - type: target-temperature
```

| Option | Default | |
|---|---|---|
| `entity` | required | The entity shown by the tile |
| `deadline_entity` | required | A `timer.*` entity or timestamp sensor (`device_class: timestamp`) |
| `countdown_text` | `Off in {time}` | Suffix while counting down; `{time}` reads `3m 05s` or `42s` |
| `due_text` | `Turning off` | Suffix from the deadline until a minute after it |
| `hold_entity` | — | Optional entity whose `on` state shows `hold_text` when no countdown is active |
| `hold_text` | — | Suffix shown when `hold_entity` is `on` and no countdown is running |

When `entity` is `off`, `unavailable`, or `unknown`, the countdown/hold suffix is
hidden. All standard Home Assistant `tile` card options (`name`, `icon`,
`color`, `hide_state`, `vertical`, `features`, `features_position`,
`tap_action`, `icon_tap_action`, etc.) are forwarded directly to `hui-tile-card`.
When `hide_state: true`, the suffix displays on its own without a leading `·`.

## Channel row

For a light or relay controlled by a motion "channel": a device that exposes
the switched entity alongside three sensors:

| Sensor | Entity's own name | Reads |
|---|---|---|
| Status | `Status` | `off`, `on`, `motion`, `presence`, `timer` or `fading` |
| Occupancy | `Occupied` | binary sensor, `on` while someone is detected |
| Turn-off time | `Motion Off Deadline` | timestamp of the automatic turn-off |

The row finds them on the entity's device by those names (or, if renamed, by
entity IDs ending `_status`, `_occupied` and `_motion_off_deadline`), so a row
usually needs only the entity:

```yaml
type: entities
entities:
  - type: custom:dash-channel-row
    entity: light.hallway_lights
  # A light on another device that the hallway channel switches:
  - type: custom:dash-channel-row
    entity: light.hallway_strip
    channel_entity: light.hallway_lights
    icon: mdi:led-strip-variant
```

While the entity is on, the second line says **Motion**, **Presence**,
**Fading off**, or counts down (**Off in 3m 12s**, then **Turning off**). With no
usable Status sensor, occupancy stands in for Motion. When the entity is off,
the second line is empty.

| Option | Default | |
|---|---|---|
| `entity` | required | The entity the row shows and toggles |
| `channel_entity` | `entity` | The entity whose device holds the channel's sensors |
| `status_entity`, `occupied_entity`, `deadline_entity` | found on the device | Set to use a specific sensor |
| `countdown_text`, `due_text` | as the countdown row | |

Both rows also accept the usual row options: `name`, `icon`, `color`,
`state_color`, `secondary_info` (shown when the row has nothing else to say),
`tap_action`, `hold_action`, `double_tap_action`.

`custom:channel-countdown-row` is an older name for the channel row and still
works.

## Develop

```sh
npm install
npm run storybook   # every state, light and dark, plus a timeline you can scrub or play
npm test            # unit tests, and every story run in Chromium with its assertions
npm run build       # dist/ha-dashboard-ui.js
```

In Storybook, Home Assistant's row and tile elements (`hui-generic-entity-row`,
`state-badge`, `ha-entity-toggle`, `hui-tile-card`) are replaced by stand-ins in
`.storybook/ha-stand-ins.ts`, styled from Home Assistant's frontend. Inside Home
Assistant the real ones are used, so check a change on a real dashboard before
releasing.

Release: bump `version` in `package.json`, commit, and push a matching tag
(`v0.2.0`). The release workflow builds the file and attaches it to a GitHub
release, which the Marketplace offers as an update.
