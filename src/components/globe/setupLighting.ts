import type { GlobeApi } from "./types";

type Mat = {
  color?: { set?: (c: string) => void };
  specular?: { set?: (c: string) => void };
  shininess?: number;
  bumpScale?: number;
  needsUpdate?: boolean;
};

export async function setupDefaultLighting(globe: GlobeApi) {
  const THREE = await import("three");
  const ambient = new THREE.AmbientLight(0xd9c7ff, 0.95);
  const dir = new THREE.DirectionalLight(0xf5eaff, 1.15);
  dir.position.set(1, 0.8, 0.6);
  globe.lights([ambient, dir]);

  const matUnknown: unknown = (globe as unknown as { globeMaterial?: () => unknown }).globeMaterial?.();
  const m = matUnknown as Mat | undefined;
  if (m) {
    // Let the texture's purple drive the hue; keep a gentle specular only
    m.specular?.set?.("#e8dcff");
    m.shininess = 20;
    if (typeof m.bumpScale === "number") m.bumpScale = 2.2;
    m.needsUpdate = true;
  }
}


