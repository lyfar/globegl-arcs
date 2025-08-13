"use client";

import React, { useEffect, useState } from "react";
import ParticlesGlobe from "@/components/ParticlesGlobe";
import { useRouter } from "next/navigation";

export default function ParticlesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ lat: number; lng: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUser({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (e) => setErr(e.message || "Permission denied"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return (
    <div className="relative min-h-dvh">
      <ParticlesGlobe user={user} />
      <div className="absolute bottom-6 right-6 z-10">
        <button onClick={() => router.push("/")} className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-sm shadow-md">Back</button>
      </div>
      {err && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-24 bg-black/60 text-white text-sm px-3 py-2 rounded-md">
          {err}
        </div>
      )}
    </div>
  );
}


