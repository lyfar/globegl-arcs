"use client";

import { useEffect, useMemo, useRef } from "react";
import type { GlobeApi, PointDatum } from "./types";
import { useMicrophoneLevel } from "./useMicrophoneLevel";

type Options = {
  showParticles?: boolean;
  particleCount?: number;
  focus?: { lat: number; lng: number } | null;
  particlesColor?: string; // optional override; default is orange
  // Drive animation with microphone when enabled
  useMicrophone?: boolean;
};

/**
 * Adds a dense particle points layer to an existing Globe instance and animates it subtly.
 * - Color defaults to match the scene lighting tint
 * - Uses Fibonacci sphere distribution for even coverage
 * - Applies gentle altitude jitter and tiny lat/lng drift for life
 */
export function useParticlesLayer(
  globeRef: React.RefObject<GlobeApi | null>,
  { showParticles, particleCount, focus, particlesColor, useMicrophone }: Options
) {
  const rafRef = useRef<number | null>(null);
  // removed throttling; keep ref for potential future use disabled
  // Smoothed 0..1 audio level when mic is enabled
  const micLevelRef = useMicrophoneLevel(Boolean(showParticles && useMicrophone));
  // For transient clap bursts
  const burstStrengthRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const armedRef = useRef(true);
  const lastSpikeMsRef = useRef(0);
  const phaseRef = useRef(0);
  const voiceAmpSmoothRef = useRef(1);
  const latScaleSmoothRef = useRef(1);
  const lngScaleSmoothRef = useRef(1);

  // circular sprite texture for round particles (particles API)
  const buildParticleTexture = useMemo(() => {
    return async () => {
      const canvas = document.createElement("canvas");
      const size = 64;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const grd = ctx.createRadialGradient(size/2, size/2, 1, size/2, size/2, size/2);
      grd.addColorStop(0, "rgba(255,178,106,1)");
      grd.addColorStop(0.6, "rgba(255,178,106,0.6)");
      grd.addColorStop(1, "rgba(255,178,106,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
      ctx.fill();
      try {
        const THREE = await import("three");
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        return tex as unknown;
      } catch {
        return null as unknown;
      }
    };
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    if (!showParticles) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const count = Math.max(500, Math.min(30000, particleCount ?? 20000));
    type ParticleSim = PointDatum & { baseLat: number; baseLng: number; speed?: number };
    const particles: ParticleSim[] = [];
    for (let i = 0; i < count; i++) {
      // Uniform random points on sphere
      const u = 2 * Math.random() - 1; // sin(lat)
      const phi = 2 * Math.PI * Math.random(); // 0..2pi
      const lat = Math.asin(u) * (180 / Math.PI);
      const lng = (phi * (180 / Math.PI)) - 180; // -180..180
      particles.push({ lat, lng, baseLat: lat, baseLng: lng, altitude: 0.01 + Math.random() * 0.01, radius: 0.2, seed: Math.random(), speed: 0.3 + Math.random() * 0.6 });
    }

    // keep for future highlighting (unused now)
    // const center: PointDatum | null = focus ? { lat: focus.lat, lng: focus.lng, altitude: 0.018, radius: 2.2 } : null;

    // default to warm orange
    const baseColor = particlesColor || "rgba(255,178,106,1)";
    const particleColor = baseColor;
    // const centerColor = "#ffffff";

    const gAny = globe as unknown as {
      particlesData?: (data: unknown[]) => GlobeApi;
      particlesList?: (fn: (d: unknown) => unknown[]) => GlobeApi;
      particleLat?: (fn: (d: unknown) => number) => GlobeApi;
      particleLng?: (fn: (d: unknown) => number) => GlobeApi;
      particleAltitude?: (fn: (d: unknown) => number) => GlobeApi;
      particlesSize?: (fn: (d: unknown) => number) => GlobeApi;
      particlesSizeAttenuation?: (val: boolean | ((d: unknown) => boolean)) => GlobeApi;
      particlesColor?: (fn: (d: unknown) => string) => GlobeApi;
      pointsData: (data: unknown[]) => GlobeApi;
      pointLat: (fn: (d: unknown) => number) => GlobeApi;
      pointLng: (fn: (d: unknown) => number) => GlobeApi;
      pointAltitude: (fn: (d: unknown) => number) => GlobeApi;
      pointRadius: (fn: (d: unknown) => number) => GlobeApi;
      pointColor: (fn: (d: unknown) => string) => GlobeApi;
    };

    const supportsParticles =
      typeof gAny.particlesData === "function" &&
      typeof gAny.particlesList === "function" &&
      typeof gAny.particleLat === "function" &&
      typeof gAny.particleLng === "function" &&
      typeof gAny.particleAltitude === "function" &&
      typeof gAny.particlesSize === "function" &&
      typeof gAny.particlesColor === "function";

    if (supportsParticles) {
      gAny
        .particlesData!([particles as unknown[]])
        .particlesList!((d: unknown) => d as unknown[])
        .particleLat!((d: unknown) => (d as ParticleSim).lat)
        .particleLng!((d: unknown) => (d as ParticleSim).lng)
        .particleAltitude!((d: unknown) => (d as ParticleSim).altitude ?? 0.012)
        .particlesSize!(() => 3)
        .particlesSizeAttenuation!(true)
        .particlesColor!(() => particleColor);
      // apply circular sprite if available
      buildParticleTexture().then((tex) => {
        try { (gAny as { particlesTexture?: (t: unknown) => GlobeApi }).particlesTexture?.(tex as unknown); } catch {}
      });
    } else {
      // Fallback: points layer
      gAny
        .pointsData(particles as unknown[])
        .pointLat((d: unknown) => (d as ParticleSim).lat)
        .pointLng((d: unknown) => (d as ParticleSim).lng)
        .pointAltitude((d: unknown) => (d as ParticleSim).altitude ?? 0.012)
        .pointRadius((d: unknown) => (d as ParticleSim).radius ?? 0.2)
        .pointResolution?.(12)
        .pointColor((d: unknown) => (d as ParticleSim).color ?? particleColor);
    }

    // initialize texture (optional) - disabled in points fallback path

    // Immediate full draw once to guarantee visibility (pointsData path)
    // No progressive reveal for now (draw all at once)

    const animate = (t: number) => {
      // Remove throttling for more responsive audio coupling
      const s = Math.sin(t * 0.001);
      const altShiftBase = 0.0022 * (0.5 + 0.5 * s);
      // Map microphone level into multipliers and apply smoothing
      const mic = micLevelRef.current || 0;
      // Moderate response to reduce jitter; we'll also smooth below
      const micAmpInstant = 1 + mic * 2.0; // altitude ripple
      const micLatScaleInstant = 1 + mic * 1.2;
      const micLngScaleInstant = 1 + mic * 1.2;
      const now = performance.now();
      const dt = lastTimeRef.current == null ? 0.016 : Math.max(0.001, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Low-pass smoothing (~120ms time constant)
      const smoothTau = 0.12;
      const kSmooth = 1 - Math.exp(-dt / smoothTau);
      latScaleSmoothRef.current += (micLatScaleInstant - latScaleSmoothRef.current) * kSmooth;
      lngScaleSmoothRef.current += (micLngScaleInstant - lngScaleSmoothRef.current) * kSmooth;

      // Detect sharp transients (claps) using hysteresis + refractory period
      const spikeHigh = 0.22; // trigger threshold
      const spikeLow = 0.12;  // re-arm threshold
      const refractoryMs = 140; // minimum time between triggers
      if (armedRef.current && mic > spikeHigh && (now - lastSpikeMsRef.current) > refractoryMs) {
        const over = mic - spikeHigh;
        // Drive only amplitude envelope (no directional kicks)
        burstStrengthRef.current = Math.min(1, burstStrengthRef.current + over * 5.0 + 0.2);
        armedRef.current = false;
        lastSpikeMsRef.current = now;
      }
      if (!armedRef.current && mic < spikeLow) {
        armedRef.current = true;
      }
      // Exponential decay for burst
      const burstDecayTau = 0.45; // seconds, smooth but not lingering too long
      burstStrengthRef.current *= Math.exp(-dt / burstDecayTau);
      const burst = burstStrengthRef.current;

      // Coherent audio-driven phase evolution for voice-like sway
      const time = t * 0.001;
      const basePhaseSpeed = 0.9; // radians/sec
      const phaseGain = 3.0;      // add with mic for quicker sway when speaking
      let dPhi = dt * (basePhaseSpeed + mic * phaseGain);
      // Clamp to avoid sudden jumps when mic spikes
      dPhi = Math.min(0.2, Math.max(0.0, dPhi));
      phaseRef.current += dPhi;
      const audioPhase = phaseRef.current;

      // Voice amplitude envelope: smooth, high when speaking or clap
      const voiceAmpInstant = Math.min(2.6, 0.8 + mic * 1.8 + burst * 1.4);
      voiceAmpSmoothRef.current += (voiceAmpInstant - voiceAmpSmoothRef.current) * kSmooth;
      const voiceAmp = voiceAmpSmoothRef.current;
      const micAmp = micAmpInstant;
      const micLatScale = latScaleSmoothRef.current;
      const micLngScale = lngScaleSmoothRef.current;
      const altShift = altShiftBase * micAmp * (0.7 + 0.5 * voiceAmp);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const seed = p.seed ?? 0.5;
        const freq = p.speed ?? (0.3 + 0.6 * seed);
        const latAttn = 1 - Math.min(1, Math.abs(p.baseLat) / 90);
        const ampLat = 0.22 * (0.5 + 0.8 * seed) * latAttn * micLatScale * voiceAmp;
        const ampLng = 0.24 * (0.5 + 0.8 * seed) * micLngScale * voiceAmp;
        p.altitude = 0.013 + altShift * (0.8 + 0.6 * seed);
        const lat = p.baseLat + Math.sin(time * freq + seed * 12 + audioPhase) * ampLat;
        const lng = p.baseLng + Math.cos(time * freq + seed * 10 + audioPhase) * ampLng;
        p.lat = Math.max(-89.9, Math.min(89.9, lat));
        const wrappedLng = ((lng + 180) % 360 + 360) % 360 - 180;
        p.lng = wrappedLng;
      }

      // Push updated dataset
      if (supportsParticles) {
        gAny.particlesData!([particles as unknown[]]);
      } else {
        gAny.pointsData(particles as unknown[]);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [globeRef, showParticles, particleCount, focus, particlesColor, buildParticleTexture, micLevelRef]);
}

// (no-op: color already RGBA)


