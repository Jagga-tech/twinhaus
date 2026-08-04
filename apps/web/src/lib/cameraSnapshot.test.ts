import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { cameraSnapshotUrl } from './cameraSnapshot.js';

const config = { url: 'http://ha.local:8123', token: 't' };

function cam(picture?: string): HaEntityState {
  return {
    entity_id: 'camera.front',
    state: 'idle',
    attributes: picture ? { entity_picture: picture } : {},
    last_changed: '',
    last_updated: '',
  };
}

describe('cameraSnapshotUrl', () => {
  it('joins a relative entity_picture to the base URL', () => {
    expect(
      cameraSnapshotUrl('camera.front', cam('/api/camera_proxy/camera.front?token=x'), config),
    ).toBe('http://ha.local:8123/api/camera_proxy/camera.front?token=x');
  });

  it('passes an absolute picture through untouched', () => {
    expect(cameraSnapshotUrl('camera.front', cam('https://cdn/x.jpg'), config)).toBe(
      'https://cdn/x.jpg',
    );
  });

  it('returns null for non-cameras or missing pictures', () => {
    expect(cameraSnapshotUrl('light.x', cam('/p'), config)).toBeNull();
    expect(cameraSnapshotUrl('camera.front', cam(), config)).toBeNull();
    expect(cameraSnapshotUrl('camera.front', undefined, config)).toBeNull();
  });
});
