"use client";

import React, { useEffect, useMemo, useRef } from "react";
import type { GlobeApi } from "./globe/types";

type Particle = { lat: number; lng: number; altitude?: number; size?: number; seed?: number };

export default function ParticlesGlobe({
  user,
  className,
  style,
}: {
  user: { lat: number; lng: number } | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<GlobeApi | null>(null);
  // not used now (points layer), but kept for future sprite usage
  const textureRef = useRef<unknown>(null);

  // Create a soft circular sprite texture for glow
  const buildParticleTexture = useMemo(() => {
    return () => {
      const canvas = document.createElement("canvas");
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const grd = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
      grd.addColorStop(0, "rgba(255,255,255,0.95)");
      grd.addColorStop(0.4, "rgba(255,255,255,0.55)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);
      return canvas;
    };
  }, []);

  useEffect(() => {
    const isMounted = true;
    const init = async () => {
      const holder = containerRef.current;
      if (!holder) return;

      type GlobeFactory = () => (el: HTMLElement) => GlobeApi;
      const Globe = (await import("globe.gl")).default as unknown as GlobeFactory;
      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.inset = "0";
      holder.appendChild(el);

      const g = Globe()(el)
        .backgroundColor("rgba(0,0,0,0)")
        // Hide the sphere and atmosphere: show only particles/points
        .showGlobe(false)
        .showAtmosphere(false)
        .showGraticules(false)
        .globeImageUrl(null)
        .bumpImageUrl(null)
        .pointOfView({ lat: 20, lng: 0, altitude: 2.4 }, 0)
        .enablePointerInteraction(true);

      globeRef.current = g;

      // Lights
      try {
        const THREE = await import("three");
        const ambient = new THREE.AmbientLight(0xbda4ff, 0.9);
        const dir = new THREE.DirectionalLight(0xffffff, 1.15);
        dir.position.set(1, 0.8, 0.6);
        g.lights([ambient, dir]);
        const matUnknown: unknown = (g as unknown as { globeMaterial?: () => unknown }).globeMaterial?.();
        const m = matUnknown as { color?: { set?: (c: string) => void }; specular?: { set?: (c: string) => void }; shininess?: number; bumpScale?: number; needsUpdate?: boolean };
        m?.color?.set?.("#6d5bd0");
        m?.specular?.set?.("#c7b9ff");
        if (typeof m?.bumpScale === "number") m.bumpScale = 2.2;
        if (m) m.needsUpdate = true;

        // optional sprite for future particlesTexture support
        const spriteCanvas = buildParticleTexture();
        const tex = new THREE.CanvasTexture(spriteCanvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        textureRef.current = tex;
      } catch {}

      // Size
      const resize = () => {
        const rect = el.getBoundingClientRect();
        g.width(Math.max(1, Math.floor(rect.width)));
        g.height(Math.max(1, Math.floor(rect.height)));
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(el);

      // Load cities and create particles
      // Try to load cities; fallback to procedural sphere sampling on failure
      const particles: Particle[] = [];
      try {
        throw new Error('skip_remote');
      } catch {
        // Procedural fallback using Fibonacci sphere
        const count = 3200;
        const gr = (1 + Math.sqrt(5)) / 2;
        for (let i = 0; i < count; i++) {
          const t = i / (count - 1);
          const y = 1 - 2 * t;
          const r = Math.sqrt(Math.max(0, 1 - y * y));
          const theta = 2 * Math.PI * i / gr;
          const x = Math.cos(theta) * r;
          const z = Math.sin(theta) * r;
          const lat = Math.asin(y) * (180 / Math.PI);
          const lng = Math.atan2(z, x) * (180 / Math.PI);
          particles.push({ lat, lng, altitude: 0.01 + Math.random() * 0.01, size: 0.6, seed: Math.random() });
        }
      }

      const center: Particle | null = user ? { lat: user.lat, lng: user.lng, altitude: 0.018, size: 2.2 } : null;
      const allPoints = [...particles.map(p => ({ ...p, color: "rgba(255,255,255,0.6)" })), ...(center ? [{ ...center, color: "#ffffff" }] : [])];

      // Configure as points layer for broad compatibility
      (g as unknown as {
        pointsData: (d: Particle[]) => GlobeApi;
        pointLat: (fn: (d: unknown) => number) => GlobeApi;
        pointLng: (fn: (d: unknown) => number) => GlobeApi;
        pointAltitude: (fn: (d: unknown) => number) => GlobeApi;
        pointRadius: (fn: (d: unknown) => number) => GlobeApi;
        pointColor: (fn: (d: unknown) => string) => GlobeApi;
      })
        .pointsData(allPoints as unknown as Particle[])
        .pointLat((d: unknown) => (d as Particle).lat)
        .pointLng((d: unknown) => (d as Particle).lng)
        .pointAltitude((d: unknown) => (d as Particle).altitude ?? 0.01)
        .pointRadius((d: unknown) => ((d as Particle).size ? (d as Particle).size! : 0.6))
        .pointColor((d: unknown) => (d as Particle & { color?: string }).color ?? "rgba(255,255,255,0.6)");

      // Focus camera on user if available
      if (user) g.pointOfView({ lat: user.lat, lng: user.lng, altitude: 1.8 }, 1400);

      // subtle idle animation: jitter altitudes a bit
      let raf = 0;
      const animate = (t: number) => {
        if (!isMounted) return;
        const s = Math.sin(t * 0.001);
        const altShift = 0.002 * (0.5 + 0.5 * s);
        (g as unknown as { pointAltitude: (fn: (d: Particle) => number) => void }).pointAltitude((d: Particle) => (d.altitude ?? 0.01) + altShift * (d.seed ?? 1));
        raf = requestAnimationFrame(animate);
      };
      raf = requestAnimationFrame(animate);

      // autorotate
      const ctrl = g.controls?.();
      if (ctrl) {
        ctrl.autoRotate = true;
        ctrl.autoRotateSpeed = 0.25;
      }

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        holder.innerHTML = "";
        globeRef.current = null;
      };
    };

    const cleanup = init();
    return () => {
      // ensure async cleanup runs
      Promise.resolve(cleanup).then((fn: (() => void) | undefined) => fn && fn());
    };
  }, [user, buildParticleTexture]);

  const containerStyles: React.CSSProperties = useMemo(
    () => ({ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }),
    []
  );

  return <div ref={containerRef} className={className} style={{ ...containerStyles, ...style }} />;
}


