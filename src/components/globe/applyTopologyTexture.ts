// Utilities to transform a black/white topology image so continents appear bright
// and apply it to the current Globe material as color map, while using the
// original topology as a bump map for subtle relief.

import type { GlobeApi } from "./types";

type MeshPhongLike = {
  map?: unknown;
  bumpMap?: unknown;
  bumpScale?: number;
  color?: { set?: (c: string) => void };
  needsUpdate?: boolean;
};

export async function applyTopologyTexture(
  globe: GlobeApi,
  topologyUrl: string
): Promise<void> {
  const THREE = await import("three");
  const loader = new THREE.TextureLoader();

  return new Promise((resolve) => {
    loader.load(topologyUrl, (origTex) => {
      const img = origTex.image as HTMLImageElement | HTMLCanvasElement;
      if (!img) return resolve();
      const w = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width || 1024;
      const h = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || 512;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve();
      ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Build an inverted grayscale buffer
      const gray = new Float32Array((w * h));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const rInv = 255 - data[i];
          const gInv = 255 - data[i + 1];
          const bInv = 255 - data[i + 2];
          gray[y * w + x] = 0.299 * rInv + 0.587 * gInv + 0.114 * bInv; // 0..255
        }
      }

      // Simple 3x3 box blur for unsharp mask
      const blurred = new Float32Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let acc = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              acc += gray[(y + dy) * w + (x + dx)];
            }
          }
          blurred[y * w + x] = acc / 9;
        }
      }

      // Sobel edges to emphasize coastlines and ridges
      const sobel = new Float32Array(w * h);
      const kx = [-1,0,1,-2,0,2,-1,0,1];
      const ky = [-1,-2,-1,0,0,0,1,2,1];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let gx = 0, gy = 0, idx = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++, idx++) {
              const v = gray[(y + dy) * w + (x + dx)];
              gx += v * kx[idx];
              gy += v * ky[idx];
            }
          }
          sobel[y * w + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
        }
      }

      // Compose: unsharp mask + edge boost, then map to a purple palette
      // Ocean: deeper purple; Land: light lavender
      const ocean = { r: 0x6b, g: 0x2f, b: 0xcf }; // #6b2fcf (more magenta)
      const land = { r: 0xee, g: 0xdc, b: 0xff };  // #eedcff (light lavender)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const g = gray[y * w + x];
          const b = blurred[y * w + x] || g;
          const e = sobel[y * w + x] || 0;
          // unsharp
          let t = g + (g - b) * 0.9 + e * 0.25; // 0..255ish
          t = Math.max(0, Math.min(255, t));
          // normalize + contrast/gamma to push land lighter and oceans darker
          let n = t / 255;
          n = Math.pow(n, 0.8);
          n = (n - 0.5) * 1.6 + 0.5;
          n = Math.min(1, Math.max(0.03, n));
          // Mix between ocean and land purples
          data[i] = Math.round(ocean.r * (1 - n) + land.r * n);
          data[i + 1] = Math.round(ocean.g * (1 - n) + land.g * n);
          data[i + 2] = Math.round(ocean.b * (1 - n) + land.b * n);
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const invTex = new THREE.CanvasTexture(canvas);
      invTex.colorSpace = THREE.SRGBColorSpace;
      origTex.colorSpace = THREE.SRGBColorSpace;

      // remove default url map so custom map is used
      (globe as unknown as { globeImageUrl: (url: string | null) => unknown }).globeImageUrl(null);

      const matUnknown: unknown = (globe as unknown as { globeMaterial?: () => unknown }).globeMaterial?.();
      const m = matUnknown as MeshPhongLike | undefined;
      if (m) {
        m.map = invTex;
        m.bumpMap = origTex;
        m.bumpScale = 2.4;
        // Keep material color as-is so external lighting/tint can influence the result
        m.needsUpdate = true;
      }

      resolve();
    });
  });
}


