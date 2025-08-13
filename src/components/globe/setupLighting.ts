import type { GlobeApi } from "./types";

type Mat = {
  color?: { set?: (c: string) => void };
  specular?: { set?: (c: string) => void };
  shininess?: number;
  bumpScale?: number;
  emissive?: { set?: (c: string) => void };
  needsUpdate?: boolean;
};

export async function setupDefaultLighting(globe: GlobeApi) {
  const THREE = await import("three");
  const ambient = new THREE.AmbientLight(0xd9c7ff, 1.2);
  const hemi = new THREE.HemisphereLight(0x6b2fcf, 0x0f072a, 0.6);
  const dir = new THREE.DirectionalLight(0xf5eaff, 1.0);
  dir.position.set(1, 0.8, 0.6);
  globe.lights([ambient, hemi, dir]);

  const matUnknown: unknown = (globe as unknown as { globeMaterial?: () => unknown }).globeMaterial?.();
  const m = matUnknown as Mat | undefined;
  if (m) {
    // Ensure base color isn't dark-multiplying the texture
    m.color?.set?.("#ffffff");
    m.specular?.set?.("#e8dcff");
    m.emissive?.set?.("#1b0b3a");
    m.shininess = 18;
    if (typeof m.bumpScale === "number") m.bumpScale = 2.0;
    m.needsUpdate = true;
  }
}


