import type { Guard, Site } from "./db";
import { getSites } from "./db";

// Map covers a rectangular region around the four sites in Accra, Ghana.
export const MAP_BOUNDS = {
  latMin: 5.5600,
  latMax: 5.6600,
  lngMin: -0.2100,
  lngMax: -0.1400,
};

export const MAP_VIEW = { width: 1000, height: 600 };

export function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - MAP_BOUNDS.lngMin) / (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin)) * MAP_VIEW.width;
  const y = ((MAP_BOUNDS.latMax - lat) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin)) * MAP_VIEW.height;
  return { x, y };
}

// Convert configured geofence radius in meters to svg pixels along the latitude axis.
// Approx 111km per degree of latitude → MAP_VIEW.height / (BOUND_LAT * 111000) px per meter.
export function metersToPx(meters: number): number {
  const latSpanMeters = (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin) * 111_000;
  const pxPerMeter = MAP_VIEW.height / latSpanMeters;
  return Math.max(18, meters * pxPerMeter);
}

// Deterministic seeded "random" so that polygons & routes are stable across renders.
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Generates an irregular convex-ish polygon around a site center to mimic a real
 * property boundary. Returns SVG-space points.
 */
export function geofencePolygon(site: Site, radiusPx: number): { x: number; y: number }[] {
  const center = project(site.zone.lat, site.zone.lng);
  const rng = seededRandom(seedFromString(site.id));
  const vertices = 8 + Math.floor(rng() * 3); // 8-10 sides
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < vertices; i++) {
    const angle = (i / vertices) * Math.PI * 2 + rng() * 0.15;
    // Slight per-vertex jitter so the polygon doesn't look like a perfect circle.
    const wobble = 0.78 + rng() * 0.34;
    pts.push({
      x: center.x + Math.cos(angle) * radiusPx * wobble,
      y: center.y + Math.sin(angle) * radiusPx * wobble,
    });
  }
  return pts;
}

// --------- Lat/Lng <-> SVG conversions for editable polygon boundaries ---------

export type LatLng = { lat: number; lng: number };

/** Approximate meters per 1° of latitude / longitude at a reference latitude. */
export function metersToDegrees(meters: number, refLat: number): { dLat: number; dLng: number } {
  const dLat = meters / 111_000;
  const dLng = meters / (111_000 * Math.cos((refLat * Math.PI) / 180));
  return { dLat, dLng };
}

/** Inverse of project: turn an SVG (x, y) back into a lat/lng. */
export function unproject(x: number, y: number): LatLng {
  const lng = MAP_BOUNDS.lngMin + (x / MAP_VIEW.width) * (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin);
  const lat = MAP_BOUNDS.latMax - (y / MAP_VIEW.height) * (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin);
  return { lat, lng };
}

/** Project a list of lat/lng vertices into SVG-space points. */
export function boundaryToSvg(boundary: LatLng[]): { x: number; y: number }[] {
  return boundary.map((p) => project(p.lat, p.lng));
}

/**
 * Generates a deterministic default boundary (lat/lng polygon) for a site,
 * approximately a `radiusMeters`-radius irregular polygon centred on the site.
 */
export function defaultBoundaryFor(site: Site, radiusMeters = 220, vertexCount = 10): LatLng[] {
  const rng = seededRandom(seedFromString(site.id + ":boundary"));
  const center = site.zone;
  const out: LatLng[] = [];
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2 + rng() * 0.12;
    const wobble = 0.78 + rng() * 0.36;
    const r = radiusMeters * wobble;
    const { dLat, dLng } = metersToDegrees(r, center.lat);
    out.push({
      lat: center.lat + Math.sin(angle) * dLat,
      lng: center.lng + Math.cos(angle) * dLng,
    });
  }
  return out;
}

/** Centroid (lat/lng) of a polygon. */
export function boundaryCentroid(boundary: LatLng[]): LatLng {
  if (boundary.length === 0) return { lat: 0, lng: 0 };
  const lat = boundary.reduce((s, p) => s + p.lat, 0) / boundary.length;
  const lng = boundary.reduce((s, p) => s + p.lng, 0) / boundary.length;
  return { lat, lng };
}

/** Largest distance from centroid to any vertex, in SVG pixels (used for patrol routes). */
export function boundaryRadiusPx(boundary: LatLng[]): number {
  const c = boundaryCentroid(boundary);
  const cs = project(c.lat, c.lng);
  let max = 0;
  for (const v of boundary) {
    const p = project(v.lat, v.lng);
    const d = Math.hypot(p.x - cs.x, p.y - cs.y);
    if (d > max) max = d;
  }
  return Math.max(36, max);
}

export function polygonToPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return `M ${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")} Z`;
}

/**
 * Returns true if (x, y) lies inside the polygon (ray-casting).
 */
export function pointInPolygon(p: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Generates a smooth patrol route loop for a guard. Returns a polyline of
 * recent positions (oldest → newest) inside the patrol zone.
 */
export function patrolRoute(guard: Guard, radiusPx: number, samples = 36): { x: number; y: number }[] {
  const site = getSites().find((s) => s.id === guard.siteId);
  if (!site) return [];
  const center = project(site.zone.lat, site.zone.lng);
  const rng = seededRandom(seedFromString(guard.id));
  // Two random offsets define a wandering Lissajous-like loop.
  const a = 0.45 + rng() * 0.35;
  const b = 0.55 + rng() * 0.4;
  const phase = rng() * Math.PI * 2;
  const skew = rng() * 0.8;
  const wander = 0.35 + rng() * 0.35;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const r = radiusPx * (0.55 + Math.sin(t * 2 + phase) * wander * 0.4);
    pts.push({
      x: center.x + Math.cos(t * a + phase) * r * (1 + skew * 0.2),
      y: center.y + Math.sin(t * b + phase * 0.6) * r * 0.9,
    });
  }
  // Shift route along based on guard.id so all guards aren't co-located.
  const shift = ((seedFromString(guard.id) % 100) - 50) * 0.4;
  return pts.map((p) => ({ x: p.x + shift * 0.3, y: p.y + shift * 0.2 }));
}

export function routeToPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  // Smooth Catmull-Rom-ish curve.
  const path: string[] = [`M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`];
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const cx = (p0.x + p1.x) / 2;
    const cy = (p0.y + p1.y) / 2;
    path.push(`Q ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}`);
  }
  return path.join(" ");
}

/** A guard's "live" position is the last point of its patrol route. */
export function guardLivePosition(guard: Guard, radiusPx: number): { x: number; y: number } {
  const route = patrolRoute(guard, radiusPx);
  const tail = route[route.length - 1];
  if (guard.status !== "alert") return tail;
  const site = getSites().find((s) => s.id === guard.siteId);
  if (!site) return tail;
  const center = project(site.zone.lat, site.zone.lng);
  const dx = tail.x - center.x;
  const dy = tail.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  const push = radiusPx * 0.35;
  return { x: tail.x + (dx / len) * push, y: tail.y + (dy / len) * push };
}

/**
 * Site building footprint — a tight rectangle centered on the site's zone.
 */
export function siteFootprint(site: Site): { x: number; y: number; w: number; h: number; rotate: number } {
  const c = project(site.zone.lat, site.zone.lng);
  const rng = seededRandom(seedFromString(site.id + "footprint"));
  const w = 28 + rng() * 24;
  const h = 22 + rng() * 18;
  const rotate = (rng() - 0.5) * 30;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h, rotate };
}

export function allGuardLivePositions(
  guards: Guard[],
  radii: Record<string, number>,
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const g of guards) {
    const r = metersToPx(radii[g.siteId] ?? 220);
    out[g.id] = guardLivePosition(g, r);
  }
  return out;
}
