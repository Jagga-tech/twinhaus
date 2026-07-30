# @twinhaus/mcp-server

An [MCP](https://modelcontextprotocol.io) server that exposes your Twinhaus home to any
MCP-capable AI assistant, so "any AI assistant can query your home." It reads a twin document
exported from the web app and (optionally) connects to Home Assistant for live state and control.

## Tools

- `list_rooms`, the rooms in the twin.
- `list_devices`, devices, optionally filtered to a room, with live state.
- `get_device_state`, one entity's live state.
- `get_energy_by_room`, current power draw per room.
- `call_service`, control a device via a Home Assistant service call.

## Run

Export your twin from the web app (**Import → Export twin**), then:

```bash
npm install
TWINHAUS_TWIN=/path/to/twin.json \
HA_URL=http://homeassistant.local:8123 \
HA_TOKEN=<long-lived-token> \
npm run start --workspace @twinhaus/mcp-server
```

`HA_URL` / `HA_TOKEN` are optional, without them the geometry tools still work, but live-state
and control tools report that Home Assistant isn't configured.

## Configure in an MCP client

```json
{
  "mcpServers": {
    "twinhaus": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-server/src/index.ts"],
      "env": {
        "TWINHAUS_TWIN": "/path/to/twin.json",
        "HA_URL": "http://homeassistant.local:8123",
        "HA_TOKEN": "<long-lived-token>"
      }
    }
  }
}
```
