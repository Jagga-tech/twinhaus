import { Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import type { ImportedModel } from '../../store/types.js';

function Gltf({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

/**
 * Renders an imported `.glb`/`.gltf` model in the scene, so people can bring furniture or a
 * whole home from Blender or SketchUp. Wrapped in Suspense because the loader is async.
 */
export function ImportedModelMesh({ model }: { model: ImportedModel }) {
  return (
    <Suspense fallback={null}>
      <Gltf url={model.url} />
    </Suspense>
  );
}
