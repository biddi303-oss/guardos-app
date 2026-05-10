/**
 * GuardMap — Leaflet map with geofences + guard markers.
 *
 * Design:
 * - Clean green dots for on-duty guards, orange for out-of-zone, red for alert
 * - No labels on the map — keeps it uncluttered
 * - Clicking a geofence polygon fires onLocationClick(geofenceId)
 * - Clicking a guard marker fires onGuardClick(guardId)
 * - Highlighted guard gets a larger ring and the map centres on them
 */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAppStore, type GuardPosition } from "@/lib/store";
import { getSites, type Guard } from "@/lib/db";
import { GEOFENCES, getGeofenceById, pointInPolygon } from "@/lib/geofence";

// ── Fix Leaflet icon paths ────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Guard dot icons ───────────────────────────────────────────────────────────
//
// Sizes:   active 16 px · idle/responding 14 px · off-duty 11 px
// Colors:  active #16a34a (bright green) · out-of-zone #dc2626 (red)
//          alert #dc2626 · idle #0ea5e9 (sky) · responding #7c3aed (violet)
// Effects: active — slow green glow · out-of-zone/alert — fast red pulse ring
//          highlighted — 1.6× scale + bright outer ring

function makeMarkerHtml(opts: {
  color: string;
  size: number;
  name?: string;            // guard name shown above the dot
  glowColor?: string;
  pulseRing?: boolean;
  pulseSpeed?: "fast" | "slow";
  outerRing?: boolean;
  outerRingColor?: string;
}): string {
  const {
    color, size, name,
    glowColor,
    pulseRing = false,
    pulseSpeed = "fast",
    outerRing = false,
    outerRingColor,
  } = opts;

  const dur = pulseSpeed === "slow" ? "2.4s" : "1.4s";

  const pulse = pulseRing ? `
    <div style="
      position:absolute;
      inset:${-size * 0.7}px;
      border-radius:50%;
      border:2px solid ${color};
      opacity:0;
      animation:gos-pulse ${dur} ease-out infinite;
    "></div>
    <div style="
      position:absolute;
      inset:${-size * 0.35}px;
      border-radius:50%;
      border:1.5px solid ${color};
      opacity:0;
      animation:gos-pulse ${dur} ease-out infinite;
      animation-delay:0.4s;
    "></div>` : "";

  const outer = outerRing ? `
    <div style="
      position:absolute;
      inset:${-size * 0.55}px;
      border-radius:50%;
      border:2.5px solid ${outerRingColor ?? color};
      opacity:0.85;
    "></div>` : "";

  const glow = glowColor
    ? `0 0 0 3px rgba(255,255,255,0.9), 0 0 10px 2px ${glowColor}, 0 2px 8px rgba(0,0,0,0.5)`
    : `0 0 0 3px rgba(255,255,255,0.9), 0 2px 8px rgba(0,0,0,0.5)`;

  // Label pill — first name only to keep it short
  const firstName = name ? name.split(" ")[0] : "";
  const label = firstName ? `
    <div style="
      position:absolute;
      bottom:calc(100% + 5px);
      left:50%;
      transform:translateX(-50%);
      background:rgba(15,20,30,0.88);
      color:#f1f5f9;
      font-family:system-ui,sans-serif;
      font-size:10px;
      font-weight:600;
      line-height:1;
      padding:3px 6px;
      border-radius:4px;
      white-space:nowrap;
      pointer-events:none;
      border:1px solid rgba(255,255,255,0.12);
      box-shadow:0 1px 4px rgba(0,0,0,0.5);
      letter-spacing:0.01em;
    ">${firstName}</div>` : "";

  return `
    <style>
      @keyframes gos-pulse {
        0%   { transform:scale(1);   opacity:0.7; }
        100% { transform:scale(2.2); opacity:0;   }
      }
    </style>
    <div style="position:relative;width:${size}px;height:${size}px;">
      ${label}
      ${pulse}${outer}
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:${color};
        box-shadow:${glow};
        cursor:pointer;
      "></div>
    </div>`;
}

function guardDot(g: Guard, highlighted: boolean): L.DivIcon {
  const base = highlighted ? 1.6 : 1;

  let color: string;
  let size: number;
  let glowColor: string | undefined;
  let pulseRing = false;
  let pulseSpeed: "fast" | "slow" = "fast";

  switch (g.status) {
    case "alert":
      color      = "#dc2626";
      size       = Math.round(18 * base);
      glowColor  = "rgba(220,38,38,0.6)";
      pulseRing  = true;
      pulseSpeed = "fast";
      break;
    case "out-of-zone":
      color      = "#dc2626";
      size       = Math.round(17 * base);
      glowColor  = "rgba(220,38,38,0.5)";
      pulseRing  = true;
      pulseSpeed = "fast";
      break;
    case "on-patrol":
    case "on-duty":
      color      = "#16a34a";
      size       = Math.round(16 * base);
      glowColor  = "rgba(22,163,74,0.45)";
      pulseRing  = false;
      break;
    case "responding":
      color      = "#7c3aed";
      size       = Math.round(15 * base);
      glowColor  = "rgba(124,58,237,0.45)";
      pulseRing  = true;
      pulseSpeed = "slow";
      break;
    case "idle":
      color      = "#0ea5e9";
      size       = Math.round(14 * base);
      glowColor  = "rgba(14,165,233,0.35)";
      pulseRing  = false;
      break;
    default:
      color      = "#6b7280";
      size       = Math.round(11 * base);
      glowColor  = undefined;
      pulseRing  = false;
  }

  // Label always shown — 23 px reserved above the dot
  const labelH = 23;
  const totalH = size + labelH;

  return L.divIcon({
    className: "",
    html: makeMarkerHtml({
      color, size, name: g.name,
      glowColor, pulseRing, pulseSpeed,
      outerRing:      highlighted,
      outerRingColor: color,
    }),
    iconSize:    [size, totalH],
    iconAnchor:  [size / 2, totalH - size / 2],
    popupAnchor: [0, -(totalH - size / 2) - 4],
  });
}

// ── Geofence styles ───────────────────────────────────────────────────────────

const STYLE_NORMAL: L.PathOptions = {
  color: "#ef4444", weight: 2, opacity: 0.75,
  fillColor: "#ef4444", fillOpacity: 0.05, dashArray: "6 4",
};
// Client view — single site, make the boundary prominent
const STYLE_CLIENT: L.PathOptions = {
  color: "#ef4444", weight: 3, opacity: 1,
  fillColor: "#ef4444", fillOpacity: 0.08, dashArray: undefined,
};
const STYLE_HOVER: L.PathOptions = {
  color: "#ef4444", weight: 2.5, opacity: 1,
  fillColor: "#ef4444", fillOpacity: 0.10, dashArray: undefined,
};
const STYLE_BREACH: L.PathOptions = {
  color: "#ef4444", weight: 3, opacity: 1,
  fillColor: "#ef4444", fillOpacity: 0.16, dashArray: undefined,
};

// ── Component ─────────────────────────────────────────────────────────────────

export interface GuardMapProps {
  height?: number;
  fullscreen?: boolean;
  /** Highlighted guard — map centres on them and their dot is enlarged */
  highlightGuardId?: string | null;
  /** Restrict map to a single site — hides all other geofences and guards */
  onlySiteId?: string;
  /** Called when a geofence polygon is clicked */
  onLocationClick?: (geofenceId: string) => void;
  /** Called when a guard dot is clicked */
  onGuardClick?: (guardId: string) => void;
}

export function GuardMap({
  height = 400,
  fullscreen = false,
  highlightGuardId = null,
  onlySiteId,
  onLocationClick,
  onGuardClick,
}: GuardMapProps) {
  const allGuards      = useAppStore((s) => s.guards);
  const guardPositions = useAppStore((s) => s.guardPositions);

  // When onlySiteId is set, restrict to that site's guards only
  const guards = onlySiteId
    ? allGuards.filter((g) => g.siteId === onlySiteId)
    : allGuards;

  // Geofences to draw — restricted when onlySiteId is set
  const visibleGeofences = onlySiteId
    ? GEOFENCES.filter((gf) => gf.siteId === onlySiteId)
    : GEOFENCES;

  // Effective positions: real GPS > saved position > site centre
  const sites = getSites();
  const effectivePositions: Record<string, GuardPosition> = {};
  guards.forEach((guard) => {
    const real = guardPositions[guard.id];
    if (real) { effectivePositions[guard.id] = real; return; }
    // Use guard's pre-scattered position from seed data
    const pos = (guard as Guard & { position?: { lat: number; lng: number } }).position;
    if (pos) {
      effectivePositions[guard.id] = {
        lat: pos.lat, lng: pos.lng, accuracy: 0,
        heading: null, speed: null, timestamp: Date.now(), source: "mock",
      };
      return;
    }
    const site = sites.find((s) => s.id === guard.siteId);
    if (site) {
      effectivePositions[guard.id] = {
        lat: site.zone.lat, lng: site.zone.lng, accuracy: 0,
        heading: null, speed: null, timestamp: Date.now(), source: "mock",
      };
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<Map<string, L.Marker>>(new Map());
  const fencesRef    = useRef<Map<string, L.Polygon>>(new Map());

  // Stable refs for callbacks so the map init effect doesn't re-run
  const onLocationClickRef = useRef(onLocationClick);
  const onGuardClickRef    = useRef(onGuardClick);
  useEffect(() => { onLocationClickRef.current = onLocationClick; }, [onLocationClick]);
  useEffect(() => { onGuardClickRef.current = onGuardClick; }, [onGuardClick]);

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [5.6050, -0.1870],
      zoom: onlySiteId ? 14 : 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Draw only the relevant geofences
    visibleGeofences.forEach((gf) => {
      // Use a more prominent style when restricted to one site (client view)
      const baseStyle = onlySiteId ? STYLE_CLIENT : STYLE_NORMAL;
      const poly = L.polygon(gf.polygon, baseStyle).addTo(map);

      // Name label centred on polygon
      const centre = poly.getBounds().getCenter();
      L.marker(centre, {
        icon: L.divIcon({
          className: "",
          html: `<div style="
            font-family:system-ui,sans-serif;font-size:11px;font-weight:700;
            color:#ef4444;
            text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;
            white-space:nowrap;pointer-events:none;
            transform:translateX(-50%);
          ">${gf.name}</div>`,
          iconAnchor: [0, 0],
        }),
        interactive: false,
        zIndexOffset: -200,
      }).addTo(map);

      // Hover + click — only add hover effect in multi-site view
      if (!onlySiteId) {
        poly.on("mouseover", () => poly.setStyle(STYLE_HOVER));
        poly.on("mouseout",  () => poly.setStyle(STYLE_NORMAL));
      }
      poly.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onLocationClickRef.current?.(gf.id);
      });

      fencesRef.current.set(gf.id, poly);
    });

    mapRef.current = map;
    if (fullscreen) requestAnimationFrame(() => map.invalidateSize());

    // If restricted to one site, fit tightly to that geofence
    if (onlySiteId && visibleGeofences.length > 0) {
      const bounds = visibleGeofences.reduce<L.LatLngBoundsLiteral>((acc, gf) => {
        return [...acc, ...gf.polygon];
      }, []);
      if (bounds.length > 0) {
        requestAnimationFrame(() =>
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16, animate: false }),
        );
      }
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      fencesRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync markers on every state change ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const breachedFenceIds = new Set<string>();
    const bounds: L.LatLngBoundsLiteral = [];
    const activeIds = new Set<string>();

    guards.forEach((guard) => {
      if (guard.status === "off-duty") return;

      const pos = effectivePositions[guard.id];
      if (!pos) return;

      activeIds.add(guard.id);
      const latlng: L.LatLngTuple = [pos.lat, pos.lng];
      bounds.push(latlng);

      const fence    = getGeofenceById(guard.geofenceId);
      const inside   = fence ? pointInPolygon([pos.lat, pos.lng], fence.polygon) : true;
      const breached = !inside;
      if (breached && fence) breachedFenceIds.add(fence.id);

      const isHighlighted = guard.id === highlightGuardId;
      const icon = guardDot(guard, isHighlighted);

      const existing = markersRef.current.get(guard.id);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
      } else {
        const marker = L.marker(latlng, {
          icon,
          zIndexOffset: isHighlighted ? 1000 : 0,
        }).addTo(map);
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onGuardClickRef.current?.(guard.id);
        });
        markersRef.current.set(guard.id, marker);
      }
    });

    // Remove markers for guards no longer active
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Update fence breach styles
    fencesRef.current.forEach((poly, fenceId) => {
      poly.setStyle(breachedFenceIds.has(fenceId) ? STYLE_BREACH : STYLE_NORMAL);
    });

    // Centre on highlighted guard
    if (highlightGuardId) {
      const pos = effectivePositions[highlightGuardId];
      if (pos) map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 16), { animate: true });
    } else if (bounds.length > 0) {
      if (markersRef.current.size <= guards.filter(g => g.status !== "off-duty").length) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guards, guardPositions, highlightGuardId, onlySiteId]);

  return (
    <>
      <style>{`
        .leaflet-container { background: #0e1726; }
        .leaflet-popup-content-wrapper {
          background: rgba(15,20,30,0.96) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,.5) !important;
          color: #e2e8f0 !important;
        }
        .leaflet-popup-tip { background: rgba(15,20,30,0.96) !important; }
        .leaflet-popup-close-button { color: #94a3b8 !important; }
      `}</style>
      <div
        ref={containerRef}
        style={{ height: fullscreen ? "100%" : height, width: "100%" }}
        className="rounded-lg overflow-hidden z-0"
      />
    </>
  );
}
