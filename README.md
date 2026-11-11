# ha-dashboard-ui

Custom rows (and, later, cards) for Home Assistant dashboards. Each one is
drawn by Home Assistant's own row element, so it looks and behaves like a
built-in row: same icon, toggle, tap and hold actions, more-info dialog. Every
state is developed and tested in Storybook.

| Element | What it shows |
|---|---|
| [`custom:dash-countdown-row`](#countdown-row) | Any entity, with a second line counting down to a timestamp sensor |
| [`custom:dash-channel-row`](#channel-row) | A light or relay run by a motion-controlled channel: Motion, Presence, Fading off, or the countdown to its automatic turn-off |

## Install

**HACS:** HACS → ⋮ → Custom repositories → add
`https://github.com/BrendanAnnable/ha-dashboard-ui` as **Dashboard** →
download **HA Dashboard UI**. HACS adds the dashboard resource.

**Manually:** download `ha-dashboard-ui.js` from the
[latest release](https://github.com/BrendanAnnable/ha-dashboard-ui/releases/latest)
into `config/www/`, then add `/local/ha-dashboard-ui.js` as a JavaScript module
under Settings → Dashboards → ⋮ → Resources.

Both rows go inside an entities card, alongside built-in rows.

## Countdown row

For anything with a timestamp sensor saying when it will next change: a towel
rail on a timer, a door that relocks itself.

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
| `deadline_entity` | required | A timestamp sensor (`device_class: timestamp`) |
| `countdown_text` | `Off in {time}` | Second line while counting down; `{time}` reads `3m 05s` or `42s` |
| `due_text` | `Turning off` | Second line from the deadline until a minute after it |

The second line is empty when the sensor is unknown or its time is more than a
minute past, so a stale sensor never leaves the row stuck. Entities with on/off
states get a toggle; others (a lock) show their state.

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

In Storybook, three Home Assistant elements (`hui-generic-entity-row`,
`state-badge`, `ha-entity-toggle`) are replaced by stand-ins in
`.storybook/ha-stand-ins.ts`, styled from Home Assistant's frontend. Inside Home
Assistant the real ones are used, so check a change on a real dashboard before
releasing.

Release: bump `version` in `package.json`, commit, and push a matching tag
(`v0.2.0`). The release workflow builds the file and attaches it to a GitHub
release, which HACS offers as an update.
