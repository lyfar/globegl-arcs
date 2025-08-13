export type GlobeAssistantMode = "globe" | "assistant";

export type ArcDatum = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string[];
  altitude?: number | null;
  // Optional timing metadata used for smooth dash continuity
  createdAt?: number;
  ttlMs?: number;
  // Rendering variant for per-arc styling
  variant?: "base" | "head" | "glow";
  // Optional stable animation params (to avoid frame-to-frame randomness)
  dashLength?: number;
  dashGap?: number;
  dashTime?: number;
  initialGap?: number;
};

export type City = { lat: number; lng: number; pop: number };

export type PointDatum = {
  lat: number;
  lng: number;
  altitude?: number;
  radius?: number;
  color?: string;
  seed?: number;
};

export type GlobeControls = {
  autoRotate: boolean;
  autoRotateSpeed: number;
};

export type GlobeApi = {
  (el: HTMLElement): GlobeApi;
  backgroundColor: (color: string) => GlobeApi;
  globeImageUrl: (url: string | null) => GlobeApi;
  bumpImageUrl: (url: string | null) => GlobeApi;
  globeMaterial: (material?: unknown) => GlobeApi | unknown;
  showGlobe: (visible: boolean) => GlobeApi;
  showAtmosphere: (visible: boolean) => GlobeApi;
  atmosphereColor: (color: string) => GlobeApi;
  atmosphereAltitude: (alt: number) => GlobeApi;
  lights: (lights: unknown[]) => GlobeApi;
  showGraticules: (visible: boolean) => GlobeApi;
  pointOfView: (
    pov: { lat: number; lng: number; altitude: number },
    ms?: number
  ) => GlobeApi;
  enablePointerInteraction: (enabled: boolean) => GlobeApi;
  arcsData: (data: ArcDatum[]) => GlobeApi;
  arcColor: (fn: (d: ArcDatum) => string) => GlobeApi;
  arcAltitude: (fn: (d: ArcDatum) => number) => GlobeApi;
  arcStroke: (fn: (d: ArcDatum) => number) => GlobeApi;
  arcDashLength: (fn: (d: ArcDatum) => number) => GlobeApi;
  arcDashGap: (fn: (d: ArcDatum) => number) => GlobeApi;
  arcDashAnimateTime: (fn: (d: ArcDatum) => number) => GlobeApi;
  arcDashInitialGap?: (fn: (d: ArcDatum) => number) => GlobeApi;
  arcsTransitionDuration?: (ms: number) => GlobeApi;
  pointsData: (data: unknown[]) => GlobeApi;
  pointLat: (fn: (d: unknown) => number) => GlobeApi;
  pointLng: (fn: (d: unknown) => number) => GlobeApi;
  pointAltitude: (fn: (d: unknown) => number) => GlobeApi;
  pointRadius: (fn: (d: unknown) => number) => GlobeApi;
  pointColor: (fn: (d: unknown) => string) => GlobeApi;
  pointResolution?: (px: number) => GlobeApi;
  // Particles API (optional on Globe.gl versions that include it)
  particlesData?: (data: unknown[]) => GlobeApi;
  particlesList?: (fn: (d: unknown) => unknown[]) => GlobeApi;
  particleLat?: (fn: (d: unknown) => number) => GlobeApi;
  particleLng?: (fn: (d: unknown) => number) => GlobeApi;
  particleAltitude?: (fn: (d: unknown) => number) => GlobeApi;
  particlesSize?: (fn: (d: unknown) => number) => GlobeApi;
  particlesSizeAttenuation?: (val: boolean | ((d: unknown) => boolean)) => GlobeApi;
  particlesColor?: (fn: (d: unknown) => string) => GlobeApi;
  particlesTexture?: (tex: unknown) => GlobeApi;
  controls: () => GlobeControls | undefined;
  width: (px: number) => GlobeApi;
  height: (px: number) => GlobeApi;
  onGlobeReady?: (fn: () => void) => GlobeApi;
};


