# Device discovery, "Found near you"

Twinhaus surfaces devices Home Assistant has **discovered but not yet configured**, and lets you
add one with a click and place it in the 3D twin. This page explains how it works, what Home
Assistant finds on its own, the browser requirement for it to work, and how to extend Bluetooth
range with ESPHome proxies.

## How it works

Twinhaus **never scans hardware directly.** Home Assistant is the discovery layer, it watches
the network and radios and starts a _config flow_ whenever it spots a supported device that isn't
set up yet. Twinhaus only consumes those flows over the WebSocket + REST API:

```
Device powers on
      │  mDNS / SSDP / DHCP / Bluetooth
      ▼
Home Assistant starts a config flow  ──(config_entries/flow/subscribe)──▶  ha-bridge
      │                                                                        │
      │  GET /api/config/config_entries/flow                                   ▼
      └──────────────────────────────────────────────────────────▶  @twinhaus/discovery
                                                                     normalize to DiscoveredDevice
                                                                                │
                                                                                ▼
                                                              "Found near you" tray (count badge)
                                                                                │  Add
                                                                                ▼
                                                              drive the flow (PIN/credentials form)
                                                                                │  create_entry
                                                                                ▼
                                                              "Where does this live?" to click a room
                                                                                │
                                                                                ▼
                                                              device placed in the 3D twin
```

- **`packages/discovery`** normalizes raw config flows into `DiscoveredDevice` (name, brand,
  source, best-guess category) and drives a flow to completion (`ConfigFlowController`).
- **`packages/ha-bridge`** does the HA communication: a WebSocket subscription signals when the
  in-progress set changes; the flow itself is stepped over the REST API.
- **`apps/web`** renders the tray, the add-device form (built from the flow's own schema), and the
  room-placement prompt.

## What Home Assistant finds automatically

Home Assistant runs several discovery integrations out of the box. Common sources you'll see in
the tray:

| Source          | Chip      | Finds                                                                      |
| --------------- | --------- | -------------------------------------------------------------------------- |
| Zeroconf / mDNS | WiFi      | HomeKit accessories, Hue, Chromecast, printers, many WiFi devices          |
| SSDP / UPnP     | WiFi      | Sonos, Roku, smart TVs, media renderers                                    |
| DHCP            | WiFi      | Devices that request an IP with a known hostname/MAC (many plugs, cameras) |
| Bluetooth       | Bluetooth | BLE sensors, locks, thermostats, within radio range of HA (or a proxy)     |
| USB             | USB       | Zigbee/Z-Wave sticks and similar dongles plugged into the HA host          |

If a device supports one of these, it usually appears within seconds of powering on. Devices that
only support cloud accounts (no local discovery) won't appear, add those from Home Assistant
directly.

## Browser requirement: `cors_allowed_origins`

Twinhaus talks to Home Assistant **from your browser**. For the discovery calls (and everything
else) to work when Twinhaus is served from a different origin than HA, allow that origin in your
Home Assistant `configuration.yaml`:

```yaml
http:
  cors_allowed_origins:
    - http://localhost:5173 # Twinhaus dev server
    - https://your-twinhaus-host # wherever you serve the built app
```

Restart Home Assistant after editing. If you run Twinhaus as the Home Assistant **add-on** (see
`addon/`), it's served through Ingress and this is handled for you.

## Extending Bluetooth range with ESPHome proxies

Bluetooth only reaches devices within radio range of the Home Assistant host. To cover a whole
house, add **ESPHome Bluetooth proxies**, cheap ESP32 boards flashed with ESPHome that relay BLE
advertisements back to HA over WiFi. Each proxy extends discovery (and control) to wherever it's
plugged in.

1. Flash an ESP32 with ESPHome (the [Bluetooth Proxy](https://esphome.io/projects/?type=bluetooth)
   project is a one-click install from esphome.io).
2. Adopt it in Home Assistant, it appears in _this very tray_ as a discovered device.
3. Place proxies so every room with BLE devices is within ~10 m of one.

Once proxied, BLE locks, thermostats, and sensors anywhere in the house show up in "Found near
you" just like WiFi devices.

## The optional "Quick scan (beta)"

The retrofit wizard has a browser-side **Quick scan (beta)** using the Web Bluetooth API. It's
**informational only**, it counts BLE advertisements nearby to give a rough sense of what's
around. It never adds devices and its results are never mixed into the Home-Assistant-backed
discovery list. It's hidden entirely on browsers without Web Bluetooth (Safari/iOS). For real
setup, always use Home Assistant discovery above.

## The agent

Ask the agent _"anything new on my network?"_ and it uses the read-only `list_discovered_devices`
tool to report what's waiting. The agent can **offer** to add a device but **cannot** complete a
config flow itself, adding always requires you to confirm setup in the "Found near you" panel.
