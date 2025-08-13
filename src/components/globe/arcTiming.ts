export function greatCircleKm(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const lat1 = toRad(startLat);
  const lat2 = toRad(endLat);
  const dLat = toRad(endLat - startLat);
  const dLon = toRad(endLng - startLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computeArcDurationMs(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  baseMs: number
): number {
  // Keep this in sync between the UI that cleans up TTLs and the Globe material animation
  const distanceKm = greatCircleKm(startLat, startLng, endLat, endLng);
  const speedKmPerSec = 1800; // drastically slower so signals don't blink
  const timeMs = (distanceKm / speedKmPerSec) * 1000;
  const minMs = baseMs * 1.2;
  const maxMs = baseMs * 4.0;
  return Math.min(maxMs, Math.max(minMs, timeMs || baseMs));
}


