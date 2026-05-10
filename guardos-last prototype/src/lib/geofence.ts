/**
 * geofence.ts — Named geofence definitions for GuardOS (Accra, Ghana)
 *
 * Polygons traced from real building/compound footprints.
 * Coordinates are [lat, lng] WGS-84 pairs.
 *
 * To add a location:
 *   1. Trace the boundary on https://geojson.io
 *   2. Add an entry to GEOFENCES
 *   3. Add a matching site in db.ts
 */

export type LatLng = [number, number]; // [lat, lng]

export interface Geofence {
  id: string;
  name: string;
  description: string;
  siteId: string;
  polygon: LatLng[];
}

export const GEOFENCES: Geofence[] = [

  // ── 1. Kotoka International Airport ──────────────────────────────────────
  // Airport City, Accra — full airport perimeter (~2.8 km across)
  {
    id: "gf-s1",
    name: "Kotoka International Airport",
    description: "KIA, Airport City, Accra",
    siteId: "s1",
    polygon: [
      [5.6080, -0.1720],
      [5.6095, -0.1660],
      [5.6088, -0.1600],
      [5.6065, -0.1565],
      [5.6030, -0.1558],
      [5.5998, -0.1575],
      [5.5985, -0.1620],
      [5.5990, -0.1680],
      [5.6010, -0.1718],
      [5.6048, -0.1728],
    ],
  },

  // ── 2. Burma Camp ─────────────────────────────────────────────────────────
  // Cantonments, Accra — large military garrison (~1.5 km across)
  {
    id: "gf-s2",
    name: "Burma Camp",
    description: "Ghana Armed Forces HQ, Cantonments",
    siteId: "s2",
    polygon: [
      [5.5820, -0.1720],
      [5.5825, -0.1650],
      [5.5810, -0.1590],
      [5.5780, -0.1568],
      [5.5748, -0.1572],
      [5.5730, -0.1600],
      [5.5728, -0.1650],
      [5.5740, -0.1700],
      [5.5768, -0.1725],
      [5.5800, -0.1728],
    ],
  },

  // ── 3. University of Ghana, Legon ─────────────────────────────────────────
  // Legon, Accra — large university campus (~2 km across)
  {
    id: "gf-s3",
    name: "University of Ghana",
    description: "Main campus, Legon, Accra",
    siteId: "s3",
    polygon: [
      [5.6560, -0.1960],
      [5.6572, -0.1880],
      [5.6558, -0.1808],
      [5.6530, -0.1778],
      [5.6495, -0.1775],
      [5.6468, -0.1795],
      [5.6455, -0.1840],
      [5.6460, -0.1900],
      [5.6480, -0.1945],
      [5.6520, -0.1965],
    ],
  },

  // ── 4. Bank of Ghana ─────────────────────────────────────────────────────
  // Thorpe Road, Accra CBD — central bank compound
  {
    id: "gf-s4",
    name: "Bank of Ghana",
    description: "Central bank headquarters, Accra CBD",
    siteId: "s4",
    polygon: [
      [5.5510, -0.2025],
      [5.5512, -0.1998],
      [5.5500, -0.1980],
      [5.5482, -0.1978],
      [5.5470, -0.1992],
      [5.5470, -0.2015],
      [5.5482, -0.2028],
      [5.5500, -0.2030],
    ],
  },

  // ── 5. Presbyterian Boys' Secondary School (Presec) ──────────────────────
  // Legon, Accra — secondary school campus
  {
    id: "gf-s5",
    name: "Presec Legon",
    description: "Presbyterian Boys' Secondary School, Legon",
    siteId: "s5",
    polygon: [
      [5.6488, -0.1748],
      [5.6492, -0.1710],
      [5.6478, -0.1688],
      [5.6458, -0.1685],
      [5.6442, -0.1700],
      [5.6440, -0.1728],
      [5.6452, -0.1750],
      [5.6472, -0.1755],
    ],
  },

];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getGeofencesForSite(siteId: string): Geofence[] {
  return GEOFENCES.filter((gf) => gf.siteId === siteId);
}

export function getGeofenceById(id: string): Geofence | undefined {
  return GEOFENCES.find((gf) => gf.id === id);
}

// ─── Point-in-polygon (ray casting) ──────────────────────────────────────────

export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  const [py, px] = point;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [iy, ix] = polygon[i];
    const [jy, jx] = polygon[j];
    const intersects =
      iy > py !== jy > py &&
      px < ((jx - ix) * (py - iy)) / (jy - iy) + ix;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function isInsideGeofence(lat: number, lng: number, siteId: string): boolean {
  const fences = getGeofencesForSite(siteId);
  if (fences.length === 0) return true;
  return fences.some((gf) => pointInPolygon([lat, lng], gf.polygon));
}

export function whichGeofence(lat: number, lng: number, siteId: string): string | null {
  const fences = getGeofencesForSite(siteId);
  return fences.find((gf) => pointInPolygon([lat, lng], gf.polygon))?.name ?? null;
}

// ─── Scatter helpers ──────────────────────────────────────────────────────────

/**
 * Returns a deterministic pseudo-random position inside a polygon's bounding
 * box. Used to spread mock guard positions naturally within a location.
 * seed should be unique per guard (e.g. index).
 */
export function scatterInBounds(
  polygon: LatLng[],
  seed: number,
): LatLng {
  const lats = polygon.map(([la]) => la);
  const lngs = polygon.map(([, ln]) => ln);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  // Simple LCG seeded random
  let s = (seed * 1664525 + 1013904223) >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  // Try up to 20 times to land inside the polygon
  for (let i = 0; i < 20; i++) {
    const lat = minLat + rand() * (maxLat - minLat);
    const lng = minLng + rand() * (maxLng - minLng);
    if (pointInPolygon([lat, lng], polygon)) return [lat, lng];
  }
  // Fallback: centroid
  const lat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const lng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
  return [lat, lng];
}
