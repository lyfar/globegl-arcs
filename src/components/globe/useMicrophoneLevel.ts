"use client";

import { useEffect, useRef } from "react";

/**
 * Lightweight microphone analyzer that tracks a smoothed RMS level (0..~1)
 * in a mutable ref to avoid re-renders. Starts when `enabled` is true.
 */
export function useMicrophoneLevel(enabled: boolean) {
  const levelRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let stream: MediaStream | null = null;
    // Adaptive normalization to keep signal in an expressive 0..1 range
    let rollingMax = 0.2; // initialized small so first sounds are visible
    let lastUpdateTs = 0;
    let envelope = 0; // attack/release smoothed level

    const setup = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });

        // Safari prefix fallback
        const win = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const Ctor: typeof AudioContext = win.AudioContext || win.webkitAudioContext!;
        audioCtx = new Ctor();
        try { await audioCtx.resume(); } catch {}
        source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        // Smaller FFT for lower latency; lighter internal smoothing for real-time feel
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.2;
        source.connect(analyser);

        const timeBuffer = new Uint8Array(analyser.fftSize);
        const freqBuffer = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyser) return;
          // Time-domain RMS
          analyser.getByteTimeDomainData(timeBuffer);
          let sumSquares = 0;
          for (let i = 0; i < timeBuffer.length; i++) {
            const v = (timeBuffer[i] - 128) / 128;
            sumSquares += v * v;
          }
          const rms = Math.sqrt(sumSquares / timeBuffer.length);

          // Frequency-domain average in typical voice band (~80Hz..2kHz)
          analyser.getByteFrequencyData(freqBuffer);
          const sampleRate = audioCtx?.sampleRate || 44100;
          const binWidth = sampleRate / (2 * freqBuffer.length);
          const lowHz = 80;
          const highHz = 2000;
          const lowBin = Math.max(0, Math.floor(lowHz / binWidth));
          const highBin = Math.min(freqBuffer.length - 1, Math.ceil(highHz / binWidth));
          let sum = 0;
          for (let i = lowBin; i <= highBin; i++) sum += freqBuffer[i];
          const avgMag = sum / Math.max(1, highBin - lowBin + 1);
          const freqLevel = avgMag / 255; // 0..1

          // Combine signals and normalize adaptively
          const combined = Math.max(rms * 1.2, freqLevel * 1.0);
          // decay rolling max over time so quiet moments remain expressive
          const now = performance.now();
          const dt = lastUpdateTs ? (now - lastUpdateTs) / 1000 : 0.016;
          lastUpdateTs = now;
          // Decay rollingMax with ~2s time constant to adapt to environment
          const normTau = 2.0;
          rollingMax = Math.max(combined, rollingMax * Math.exp(-Math.max(0, dt) / normTau));
          const normalized = combined / Math.max(0.001, rollingMax);
          // additional overall gain for visibility
          const boosted = Math.min(1, normalized * 1.5);

          // Attack/Release envelope for smooth but responsive dynamics
          const attackTau = 0.05;  // ~50ms fast rise
          const releaseTau = 0.25; // ~250ms slower fall
          const tau = boosted > envelope ? attackTau : releaseTau;
          const k = 1 - Math.exp(-Math.max(0, dt) / tau);
          envelope += (boosted - envelope) * k;

          // Mix envelope with instantaneous boosted level for stronger transients
          const mixed = Math.min(1, envelope * 0.6 + boosted * 0.6);
          levelRef.current = Math.max(0, Math.min(1, mixed));
          try {
            (window as unknown as { __micLevel?: number }).__micLevel = levelRef.current;
          } catch {}
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        // Some browsers create the context suspended until a user gesture.
        // Attempt to resume on common user interactions and visibility changes.
        const tryResume = async () => {
          if (!audioCtx) return;
          try {
            if (audioCtx.state === "suspended") await audioCtx.resume();
          } catch {}
        };
        const onInteract = () => { tryResume(); };
        const onVisibility = () => { tryResume(); };
        window.addEventListener("click", onInteract, { once: true });
        window.addEventListener("touchstart", onInteract, { once: true });
        document.addEventListener("visibilitychange", onVisibility);

        // Cleanup these listeners in return below
        (setup as unknown as { _cleanup?: () => void })._cleanup = () => {
          window.removeEventListener("click", onInteract);
          window.removeEventListener("touchstart", onInteract);
          document.removeEventListener("visibilitychange", onVisibility);
        };
      } catch {
        // If permission denied or any error, keep level at 0
        levelRef.current = 0;
      }
    };

    setup();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      try { source?.disconnect(); } catch {}
      try { analyser?.disconnect(); } catch {}
      if (audioCtx) {
        try { audioCtx.close(); } catch {}
      }
      if (stream) {
        for (const track of stream.getTracks()) {
          try { track.stop(); } catch {}
        }
      }
      try {
        const fn = (setup as unknown as { _cleanup?: () => void })._cleanup;
        if (typeof fn === "function") fn();
      } catch {}
    };
  }, [enabled]);

  return levelRef;
}


