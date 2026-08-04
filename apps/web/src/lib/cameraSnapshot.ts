import { entityDomain, type HaEntityState, type HaConnectionConfig } from '@twinhaus/ha-bridge';

/**
 * Build the URL for a camera's still image so the inspector can show a live snapshot. Home
 * Assistant exposes a signed `entity_picture` path on camera entities (a `camera_proxy` URL with a
 * short-lived token); this joins it to the configured base URL. Returns null for non-cameras or
 * when no picture is available. Pure and testable.
 */
export function cameraSnapshotUrl(
  entityId: string,
  state: HaEntityState | undefined,
  config: HaConnectionConfig,
): string | null {
  if (entityDomain(entityId) !== 'camera' || !state) return null;
  const picture = state.attributes.entity_picture;
  if (typeof picture !== 'string' || !picture) return null;
  if (/^https?:\/\//.test(picture)) return picture;
  const base = config.url.replace(/\/+$/, '');
  if (!base) return null;
  return `${base}${picture.startsWith('/') ? '' : '/'}${picture}`;
}
