# Twinhaus, Home Assistant add-on

Run Twinhaus as a Home Assistant add-on so it lives right inside your HA dashboard (via
Ingress) instead of a separate dev server.

## Install (local add-on)

1. Copy this repository (or just the `addon/` folder) into your HA config's `addons/` share,
   e.g. `/addons/twinhaus/`.
2. In Home Assistant: **Settings → Add-ons → Add-on Store → ⋮ → Repositories**, or use the
   local add-ons that appear automatically.
3. Find **Twinhaus**, click **Install**, then **Start**.
4. Open the add-on (Ingress) and go to **Settings** inside Twinhaus to connect to Home
   Assistant (URL + a long-lived access token) and pick an AI provider.

## Notes

- The add-on serves the built single-page app; it does not proxy Home Assistant. Twinhaus
  connects to HA over the WebSocket API from your browser, so use your HA URL and a
  long-lived token in the in-app Settings.
- Because Twinhaus connects directly from the browser, ensure your HA `http:` config allows
  the origin (see `cors_allowed_origins`) if you are not using Ingress.
- Local LLM: run [Ollama](https://ollama.com) and point the AI provider at it for fully local,
  private inference.
