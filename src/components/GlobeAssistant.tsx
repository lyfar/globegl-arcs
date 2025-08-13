"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
// import { computeArcDurationMs } from "./globe/arcTiming";
import type {
  GlobeAssistantMode,
  ArcDatum,
  City,
  PointDatum,
  GlobeApi,
} from "./globe/types";
import { applyTopologyTexture } from "./globe/applyTopologyTexture";
import { setupDefaultLighting } from "./globe/setupLighting";
import { useOrbCanvas } from "./globe/useOrbCanvas";
import { useParticlesLayer } from "./globe/useParticlesLayer";

type GlobeAssistantProps = {
  mode: GlobeAssistantMode;
  speaking?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onInitialized?: () => void;
  showPoints?: boolean;
  globeTextureUrl?: string;
  globeBumpUrl?: string;
  showGraticules?: boolean;
  points?: PointDatum[];
  arcs?: ArcDatum[];
  focus?: { lat: number; lng: number; altitude?: number };
  arcAnimateMs?: number;
  globeTintColor?: string; // non-photoreal tint for continents
  arcsColor?: string; // override color for arcs
  showParticles?: boolean; // render dense particle layer in same view
  particleCount?: number; // optional override for particle density
  // Enable microphone-driven particle motion when particles are shown
  audioReactive?: boolean;
};

// Lightweight prototype component that crossfades between a GlobeGL canvas and a 2D orb canvas.
// Globe is used to depict "the world"; orb canvas represents the assistant with pulsing beams.
export const GlobeAssistant: React.FC<GlobeAssistantProps> = ({
  mode,
  speaking = false,
  className,
  style,
  onInitialized,
  showPoints = false,
  globeTextureUrl = "/textures/earth-day.jpg",
  globeBumpUrl = undefined,
  showGraticules = false,
  points,
  arcs,
  focus,
  arcAnimateMs,
  globeTintColor,
  arcsColor,
  showParticles,
  particleCount,
  audioReactive,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const globeLayerRef = useRef<HTMLDivElement | null>(null);
  const orbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const globeRef = useRef<GlobeApi | null>(null);
  const topologyActiveRef = useRef(false);
  const userInteractingRef = useRef(false);
  const lastFocusRef = useRef<{ lat: number; lng: number; altitude: number } | null>(null);
  const [globeReady, setGlobeReady] = useState(false);

  // Initialize GlobeGL lazily on client
  useEffect(() => {
    const layerAtMount = globeLayerRef.current;
    let globeInstance: GlobeApi | null = null;

    const init = async () => {
      if (!layerAtMount) return;
      try {
        // Dynamic import to avoid SSR issues
        type GlobeFactory = () => (el: HTMLElement) => GlobeApi;
        const Globe = (await import("globe.gl")).default as unknown as GlobeFactory;
        const globeEl = document.createElement("div");
        globeEl.style.position = "absolute";
        globeEl.style.inset = "0";
        layerAtMount.appendChild(globeEl);

        globeInstance = Globe()(globeEl)
          .backgroundColor("rgba(0,0,0,0)")
          .globeImageUrl(globeTextureUrl)
          .bumpImageUrl(globeBumpUrl ?? null)
          .showGlobe(true)
          .showAtmosphere(true)
          .atmosphereColor("#a78bfa")
          .atmosphereAltitude(0.28)
           .showGraticules(showGraticules)
          .pointOfView({ lat: 20, lng: 0, altitude: 2.4 }, 0)
          .enablePointerInteraction(true);

        globeRef.current = globeInstance;

        // Apply stylized tint material if requested
        if (globeTintColor) {
          try {
            const THREE = await import("three");
            const material = new THREE.MeshPhongMaterial({
              color: new THREE.Color(globeTintColor),
              shininess: 12,
              specular: new THREE.Color(globeTintColor),
            });
            globeInstance.globeMaterial(material as unknown as object);
          } catch (e) {
            console.warn("tint material failed", e);
          }
        }

        // If using a topology texture, transform and apply it
        if (globeTextureUrl && globeTextureUrl.includes("earth-topology")) {
          topologyActiveRef.current = true;
          await applyTopologyTexture(globeInstance, globeTextureUrl);
        } else {
          topologyActiveRef.current = false;
        }

        // Size to container
        const resizeToContainer = () => {
          const rect = globeEl.getBoundingClientRect();
          globeInstance!.width(Math.max(1, Math.floor(rect.width)));
          globeInstance!.height(Math.max(1, Math.floor(rect.height)));
        };
        resizeToContainer();
        const ro = new ResizeObserver(resizeToContainer);
        ro.observe(globeEl);

        // Optional arcs (off by default for a clean light look)
        globeInstance.arcsData([]);

        // Gentle auto-rotation
        const controls = globeInstance.controls();
        if (controls) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.2;
          // Track user interaction to avoid overriding camera while dragging
          try {
            (controls as unknown as { addEventListener?: (ev: string, cb: () => void) => void })
              .addEventListener?.("start", () => { userInteractingRef.current = true; });
            (controls as unknown as { addEventListener?: (ev: string, cb: () => void) => void })
              .addEventListener?.("end", () => { userInteractingRef.current = false; });
          } catch {}
        }
        await setupDefaultLighting(globeInstance);
        setGlobeReady(true);
        onInitialized?.();
      } catch (e) {
        console.error("Failed to init globe", e);
      }
    };

    init();

    return () => {
      if (layerAtMount) layerAtMount.innerHTML = "";
      globeRef.current = null;
    };
  }, 
  // We intentionally initialize the Globe once on mount; other props are applied via separate effects
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [onInitialized]);

  // Apply props: texture, arcs visibility, and points
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    // Avoid resetting the map if we are using the custom topology pipeline
    if (!topologyActiveRef.current) {
      globe.globeImageUrl(globeTextureUrl);
    }
    globe.bumpImageUrl(globeBumpUrl ?? null);
    globe.showGraticules(showGraticules);
  }, [globeTextureUrl, globeBumpUrl, showGraticules]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    if (!arcs || arcs.length === 0) {
      globe.arcsData([]);
      return;
    }
    // const animateMs = arcAnimateMs ?? 6000;
    // Simplified single-dash animation per arc (like the reference sample)
    const OPACITY = 0.35;
    // Append-only when possible to avoid restarting animations on existing arcs
    try {
      const current = (globe as unknown as { arcsData?: () => ArcDatum[] }).arcsData?.();
      if (Array.isArray(current) && current.length <= arcs.length) {
        const next = current.concat(arcs.slice(current.length));
        (globe as unknown as { arcsData?: (d: ArcDatum[]) => void }).arcsData?.(next);
      } else {
        globe.arcsData(arcs);
      }
    } catch {
      globe.arcsData(arcs);
    }
    globe.arcColor((d: ArcDatum) => [
      (arcsColor || (Array.isArray(d.color) ? d.color[0] : (d.color as unknown as string))) || `rgba(255,178,106,${OPACITY})`,
      `rgba(255,255,255,${OPACITY})`
    ] as unknown as string);
    globe.arcAltitude((d: ArcDatum) => (d.altitude == null ? 0.2 : d.altitude));
    globe.arcStroke(() => 0.35);
    // Use stable, per-arc parameters to avoid restarts/jumps
    globe.arcDashLength((d: ArcDatum) => (d.dashLength != null ? d.dashLength : 0.22));
    globe.arcDashGap((d: ArcDatum) => (d.dashGap != null ? d.dashGap : 1.1));
    globe.arcDashAnimateTime((d: ArcDatum) => (d.dashTime != null ? d.dashTime : 2500));
    try {
      (globe as unknown as { arcDashInitialGap?: (fn: (d: ArcDatum) => number) => void }).arcDashInitialGap?.((d: ArcDatum) => (d.initialGap != null ? d.initialGap : 0));
    } catch {}
    try {
      (globe as unknown as { arcsTransitionDuration?: (ms: number) => void }).arcsTransitionDuration?.(0);
    } catch {}
  }, [arcs, arcAnimateMs, arcsColor]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    // When particles layer is active (fallback uses pointsData), avoid modifying points here
    if (showParticles) return;
    let cancelled = false;
    if (points && points.length > 0) {
      globe
        .pointsData(points as unknown[])
        .pointLat((d: unknown) => (d as PointDatum).lat)
        .pointLng((d: unknown) => (d as PointDatum).lng)
        .pointAltitude((d: unknown) => {
          const p = d as PointDatum;
          return p.altitude == null ? 0.04 : p.altitude;
        })
        .pointRadius((d: unknown) => {
          const p = d as PointDatum;
          return p.radius == null ? 0.6 : p.radius;
        })
        .pointColor((d: unknown) => (d as PointDatum).color ?? "rgba(2,132,199,0.9)");
      return () => {
        cancelled = true;
      };
    }
    if (!showPoints) {
      globe.pointsData([]);
      return () => {
        cancelled = true;
      };
    }
    // Load world cities dataset (lat/lon/pop)
    const url =
      "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/worldcities.csv";
    fetch(url)
      .then((r) => r.text())
      .then((txt) => {
        if (cancelled) return;
        const lines = txt.split(/\r?\n/);
        const header = lines.shift() || "";
        const cols = header.split(",");
        const latIdx = cols.findIndex((c) => c.toLowerCase() === "lat");
        const lonIdx = cols.findIndex((c) => c.toLowerCase() === "lng" || c.toLowerCase() === "lon");
        const popIdx = cols.findIndex((c) => c.toLowerCase() === "population" || c.toLowerCase() === "pop");
        const cities: City[] = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          const parts = line.split(",");
          const lat = parseFloat(parts[latIdx]);
          const lng = parseFloat(parts[lonIdx]);
          const pop = popIdx >= 0 ? parseFloat(parts[popIdx]) : Math.random() * 1_000_000;
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            cities.push({ lat, lng, pop: Number.isFinite(pop) ? pop : 0 });
          }
        }
        // Keep significant cities for clarity
        const filtered = cities
          .filter((c) => c.pop >= 500_000)
          .sort((a, b) => b.pop - a.pop)
          .slice(0, 1200);

        const maxPop = filtered[0]?.pop || 1;
        globe
          .pointsData(filtered as unknown[])
          .pointLat((d: unknown) => (d as City).lat)
          .pointLng((d: unknown) => (d as City).lng)
          .pointAltitude((d: unknown) => 0.02 + 0.05 * ((d as City).pop / maxPop))
          .pointRadius((d: unknown) => 0.25 + 0.75 * ((d as City).pop / maxPop))
          .pointColor(() => "rgba(2,132,199,0.75)");
      })
      .catch((e) => console.error("Failed to load world cities", e));

    return () => {
      cancelled = true;
    };
  }, [showPoints, points, showParticles]);

  // Particles layer extracted to a hook for maintainability
  useParticlesLayer(globeRef, {
    showParticles: Boolean(showParticles && globeReady),
    particleCount,
    focus: focus ? { lat: focus.lat, lng: focus.lng } : null,
    particlesColor: "#ffb26a",
    useMicrophone: Boolean(audioReactive),
  });

  // When particles are shown, hide the globe sphere and atmosphere entirely (keep only particles)
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !globeReady) return;
    if (showParticles) {
      try { globe.showGlobe(false); } catch {}
      try { globe.showAtmosphere(false); } catch {}
      try { globe.showGraticules(false); } catch {}
      try { (globe as unknown as { globeImageUrl: (url: string | null) => void }).globeImageUrl(null); } catch {}
      try { (globe as unknown as { bumpImageUrl: (url: string | null) => void }).bumpImageUrl(null); } catch {}
    } else {
      try { globe.showGlobe(true); } catch {}
      try { globe.showAtmosphere(true); } catch {}
      try { globe.showGraticules(showGraticules); } catch {}
      // Restore texture when leaving particles view
      try {
        if (!topologyActiveRef.current) {
          (globe as unknown as { globeImageUrl: (url: string | null) => void }).globeImageUrl(globeTextureUrl);
        } else if (globeTextureUrl && globeTextureUrl.includes("earth-topology")) {
          applyTopologyTexture(globe, globeTextureUrl).catch(() => {});
        }
      } catch {}
    }
  }, [showParticles, globeReady, globeTextureUrl, showGraticules]);

  // Focus camera on a specific location, but only when values change and the user is not dragging
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !focus) return;
    if (userInteractingRef.current) return; // Respect user drag
    const next = { lat: focus.lat, lng: focus.lng, altitude: focus.altitude ?? 1.8 };
    const prev = lastFocusRef.current;
    const epsilon = 1e-3; // ~0.001 degrees
    const changed =
      !prev ||
      Math.abs(prev.lat - next.lat) > epsilon ||
      Math.abs(prev.lng - next.lng) > epsilon ||
      Math.abs((prev.altitude ?? 0) - (next.altitude ?? 0)) > 1e-3;
    if (!changed) return;
    globe.pointOfView(next, 1200);
    lastFocusRef.current = next;
  }, [focus]);

  // Initialize Orb 2D canvas
  useOrbCanvas(orbCanvasRef, speaking);

  // Crossfade + scale/blur between layers based on mode
  useEffect(() => {
    const globe = globeLayerRef.current;
    const orb = orbCanvasRef.current;
    if (!globe || !orb) return;

    const tl = gsap.timeline();
    if (mode === "assistant") {
      tl.to(globe, { opacity: 0, filter: "blur(10px)", scale: 0.9, duration: 0.9, ease: "power2.inOut" }, 0)
        .to(orb, { opacity: 1, scale: 1.05, duration: 1.0, ease: "power2.inOut" }, 0)
        .to(orb, { scale: 1.0, duration: 0.6, ease: "power2.out" }, ">-0.2");
    } else {
      tl.to(globe, { opacity: 1, filter: "blur(0px)", scale: 1.0, duration: 0.9, ease: "power2.inOut" }, 0)
        .to(orb, { opacity: 0, scale: 0.96, duration: 0.9, ease: "power2.inOut" }, 0);
    }
  }, [mode]);

  // Initial styles
  const containerStyles: React.CSSProperties = useMemo(
    () => ({ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }),
    []
  );

  return (
    <div ref={containerRef} className={className} style={{ ...containerStyles, ...style }}>
      <div
        ref={globeLayerRef}
        style={{ position: "absolute", inset: 0, opacity: mode === "globe" ? 1 : 0, willChange: "opacity, transform, filter", transform: "scale(1)" }}
      />
      <canvas
        ref={orbCanvasRef}
        style={{ position: "absolute", inset: 0, opacity: mode === "assistant" ? 1 : 0, transform: "scale(0.98)", willChange: "opacity, transform" }}
      />
    </div>
  );
};

export default GlobeAssistant;


