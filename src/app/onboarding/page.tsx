"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useRouter } from "next/navigation";
import GlobeAssistant from "@/components/GlobeAssistant";
import type { ArcDatum } from "@/components/globe/types";
import { computeArcDurationMs } from "@/components/globe/arcTiming";

export default function OnboardingPage() {
  // const router = useRouter();
  const [mode] = useState<"globe" | "assistant">("globe");
  const [speaking] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [focusAlt, setFocusAlt] = useState(2.6);
  type StreamArc = ArcDatum & { createdAt: number; ttlMs: number };
  const [arcs, setArcs] = useState<StreamArc[]>([]);
  const seriesTimersRef = useRef<number[]>([] as number[]);
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setGeoError(err.message || "Permission denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const points = useMemo(() => {
    if (!userPos && geoError) return [];
    if (userPos) return [{ lat: userPos.lat, lng: userPos.lng, radius: 1.2, color: "rgba(14,165,233,0.95)" }];
    return [];
  }, [userPos, geoError]);

  // No remote dataset; arcs use procedural distributed sources

  // Continuous signal emission: arcs never stop; staggered batches toward the user
  useEffect(() => {
    // Clear any pending timers first
    seriesTimersRef.current.forEach((t: number) => window.clearTimeout(t));
    seriesTimersRef.current = [];

    if (!userPos || showParticles) return;

    const BASE_MS = 6000;
    const INITIAL_BURST = 48; // gentle start
    const TICK_BATCH = 6;     // arcs per tick
    const TICK_MS_MEAN = 140; // average cadence
    const TICK_MS_JITTER = 220; // randomness window
    const RETAIN_MAX = 1500;  // cap retained arcs for memory

    const randomSource = (): { lat: number; lng: number } => {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const z = 2 * v - 1; // [-1,1]
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      const lat = Math.asin(z) * (180 / Math.PI) + (Math.random() - 0.5) * 1.2;
      const lng = Math.atan2(y, x) * (180 / Math.PI) + (Math.random() - 0.5) * 1.2;
      return { lat, lng };
    };

    const emitOne = () => {
      const src = randomSource();
      const animMs = computeArcDurationMs(src.lat, src.lng, userPos.lat, userPos.lng, BASE_MS);
      const now = Date.now();
      // Freeze random dash parameters per arc so it doesn't change each render
      const dashLength = 0.12 + Math.random() * 0.32;
      const dashGap = 0.7 + Math.random() * 1.1;
      const dashTime = 800 + Math.random() * 3800;
      const initialGap = Math.random();
      const arc: StreamArc = {
        startLat: src.lat,
        startLng: src.lng,
        endLat: userPos.lat,
        endLng: userPos.lng,
        color: ["#905f77"],
        createdAt: now,
        ttlMs: Math.ceil(animMs + 300),
        dashLength,
        dashGap,
        dashTime,
        initialGap,
      };
      setArcs((prev) => {
        const next = [...prev, arc];
        const pruned = next.filter((a) => now - a.createdAt < a.ttlMs);
        return pruned.slice(Math.max(0, pruned.length - RETAIN_MAX));
      });
    };

    // Initial gentle burst
    for (let i = 0; i < INITIAL_BURST; i++) emitOne();

    // Continuous randomized ticks
    const schedule = () => {
      for (let j = 0; j < TICK_BATCH; j++) emitOne();
      const delay = TICK_MS_MEAN + (Math.random() - 0.5) * TICK_MS_JITTER;
      const id = window.setTimeout(schedule, Math.max(20, delay));
      seriesTimersRef.current.push(id);
    };
    schedule();

    // periodic cleanup
    const cleanupInterval = window.setInterval(() => {
      const now = Date.now();
      setArcs((prev) => prev.filter((a) => now - a.createdAt < a.ttlMs));
    }, 800);

    return () => {
      seriesTimersRef.current.forEach((t: number) => window.clearTimeout(t));
      seriesTimersRef.current = [];
      window.clearInterval(cleanupInterval);
    };
  }, [userPos, showParticles]);

  // Zoom in gently once location is known
  useEffect(() => {
    if (!userPos) return;
    // ease in closer but keep rotation
    setFocusAlt(2.0);
  }, [userPos]);

  // Legacy helpers removed: interaction is a simple preview on this page

  return (
    <div className="relative min-h-dvh" style={{ minHeight: '100vh' }}>
      <div className="absolute inset-0" style={{ background: '#3f07aa' }}>
        <GlobeAssistant
          mode={mode}
          speaking={speaking}
          globeTextureUrl="/textures/earth-topology.png"
          globeBumpUrl="/textures/earth-bump.png"
          points={points}
          arcs={arcs}
          arcAnimateMs={6000}
          globeTintColor="#422280"
          arcsColor="#905f77"
          focus={userPos ? { ...userPos, altitude: focusAlt } : { lat: 20, lng: 0, altitude: 2.6 }}
          showParticles={showParticles}
          particleCount={6000}
          audioReactive={true}
        />
      </div>
      <div className="relative z-10 pointer-events-none min-h-dvh p-6">
        {/* Bottom-right small Next button */}
        <div className="absolute bottom-6 right-6 pointer-events-auto">
          <button
            onClick={() => {
              try { window.localStorage.setItem("onboarded", "1"); } catch {}
              // Always enable particles
              setShowParticles(true);
              // Reverse existing arcs back to their origin for a collapse effect
              const now = Date.now();
              setArcs((prev) => {
                if (!userPos || prev.length === 0) return [] as StreamArc[];
                const reversed = prev.map((a) => {
                  const animMs = computeArcDurationMs(a.endLat, a.endLng, a.startLat, a.startLng, 900);
                  return {
                    startLat: a.endLat,
                    startLng: a.endLng,
                    endLat: a.startLat,
                    endLng: a.startLng,
                    color: a.color,
                    altitude: a.altitude ?? 0.2,
                    createdAt: now,
                    ttlMs: Math.ceil(animMs + 600),
                  } as StreamArc;
                });
                // Schedule particles to appear after arcs finish collapsing
                const maxTtl = reversed.reduce((m, r) => Math.max(m, r.ttlMs), 0);
                window.setTimeout(() => {
                  // Clear arcs shortly after particles start
                  window.setTimeout(() => setArcs([]), 300);
                }, Math.min(2400, Math.max(600, maxTtl - 400)));
                return reversed;
              });
            }}
            className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-sm shadow-md"
          >
            Next
          </button>
        </div>
        {/* Optional geolocation error toast */}
        {geoError && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-24 bg-black/60 text-white text-sm px-3 py-2 rounded-md">
            {geoError}
          </div>
        )}
      </div>
      {/* particles are now a layer in the same Globe view via showParticles */}
    </div>
  );
}


