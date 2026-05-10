/**
 * useGpsTracking
 *
 * Handles three alert triggers:
 *   1. GEOFENCE BREACH  — guard leaves their assigned polygon
 *   2. INACTIVITY       — no GPS movement for > INACTIVE_THRESHOLD_MS
 *   3. SOS              — triggered manually from the guard app (separate)
 *
 * Also simulates movement for all other on-duty guards so the map looks live.
 *
 * Supabase sync: on every real GPS fix (throttled to once per 10 s) the guard's
 * location is upserted into the `guard_locations` table keyed by guard_name.
 */

import { useEffect, useRef } from "react";
import { useAppStore, type GuardPosition } from "@/lib/store";
import { lsSet, lsGet } from "@/lib/storage";
import { getGeofenceById, pointInPolygon } from "@/lib/geofence";
import { getGuards, getSites } from "@/lib/db";
import type { Alert, Guard } from "@/lib/db";
import { supabase } from "@/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 15_000,
  timeout: 20_000,
};

const SIM_INTERVAL_MS       = 8_000;   // simulated guards move every 8 s
const SIM_MAX_DRIFT         = 0.00015; // ~15 m max per step
const INACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const INACTIVE_CHECK_MS     = 60 * 1000;       // check every 1 minute
const SUPABASE_SYNC_MS      = 10_000;  // upsert to Supabase at most once per 10 s

// ── Helpers ───────────────────────────────────────────────────────────────────

function posKey(id: string) { return `gps:${id}`; }
function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function drift(
  base: { lat: number; lng: number },
  seed: number,
): { lat: number; lng: number } {
  const s = ((seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const angle = s * Math.PI * 2;
  const dist  = 0.00003 + s * SIM_MAX_DRIFT;
  return {
    lat: base.lat + Math.sin(angle) * dist,
    lng: base.lng + Math.cos(angle) * dist,
  };
}

function getSiteName(siteId: string): string {
  return getSites().find((s) => s.id === siteId)?.name ?? "unknown location";
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGpsTracking(loggedInGuardId: string | null) {
  const isOnDuty      = useAppStore((s) => s.isOnDuty);
  const updatePos     = useAppStore((s) => s.updateGuardPosition);
  const setPermission = useAppStore((s) => s.setGpsPermission);
  const setTracking   = useAppStore((s) => s.setIsTrackingGps);
  const addAlert      = useAppStore((s) => s.addAlert);
  const updateGuard   = useAppStore((s) => s.updateGuard);
  const guards        = useAppStore((s) => s.guards);

  const watchIdRef       = useRef<number | null>(null);
  const simTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactiveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasInsideRef     = useRef<boolean>(true);
  const lastMovedRef     = useRef<number>(Date.now());
  const inactiveFiredRef = useRef<boolean>(false);
  const simPositions     = useRef<Record<string, { lat: number; lng: number }>>({});
  const simStepRef       = useRef(0);
  const lastSupabaseSyncRef = useRef<number>(0); // timestamp of last Supabase upsert

  // ── Stop everything ────────────────────────────────────────────────────────
  const stopAll = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simTimerRef.current !== null) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    if (inactiveTimerRef.current !== null) {
      clearInterval(inactiveTimerRef.current);
      inactiveTimerRef.current = null;
    }
    setTracking(false);
    wasInsideRef.current  = true;
    inactiveFiredRef.current = false;
  };

  // ── Geofence check ─────────────────────────────────────────────────────────
  const checkGeofence = (guardId: string, lat: number, lng: number) => {
    const guard = getGuards().find((g) => g.id === guardId);
    if (!guard || !guard.onDuty) return;

    const fence = getGeofenceById(guard.geofenceId);
    if (!fence) return;

    const inside = pointInPolygon([lat, lng], fence.polygon);

    if (!inside && wasInsideRef.current) {
      console.warn(`[ALERT] ${guard.guardId} LEFT geofence: ${fence.name}`);

      updateGuard(guard.id, {
        status:            "out-of-zone",
        lastActivity:      new Date(),
        lastActivityLabel: `Left ${fence.name}`,
      });

      addAlert({
        id:             genId(),
        type:           "geofence-breach",
        guardId:        guard.id,
        guardDisplayId: guard.guardId,
        guardName:      guard.name,
        siteId:         guard.siteId,
        message:        `${guard.name} left ${fence.name}`,
        timestamp:      new Date(),
        read:           false,
      } as Alert);

    } else if (inside && !wasInsideRef.current) {
      console.info(`[GPS] ${guard.guardId} returned to ${fence.name}`);

      updateGuard(guard.id, {
        status:            "on-patrol",
        lastActivity:      new Date(),
        lastActivityLabel: `Returned to ${fence.name}`,
      });
    }

    wasInsideRef.current = inside;
  };

  // ── Inactivity check ───────────────────────────────────────────────────────
  const startInactivityTimer = (guardId: string) => {
    inactiveTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastMovedRef.current;
      if (elapsed >= INACTIVE_THRESHOLD_MS && !inactiveFiredRef.current) {
        const guard = getGuards().find((g) => g.id === guardId);
        if (!guard || !guard.onDuty) return;

        console.warn(`[ALERT] ${guard.guardId} INACTIVE for ${Math.round(elapsed / 60000)} min`);
        inactiveFiredRef.current = true;

        updateGuard(guard.id, {
          status:            "idle",
          lastActivityLabel: "No movement detected",
        });

        addAlert({
          id:             genId(),
          type:           "inactive",
          guardId:        guard.id,
          guardDisplayId: guard.guardId,
          guardName:      guard.name,
          siteId:         guard.siteId,
          message:        `${guard.name} has been inactive for ${Math.round(elapsed / 60000)} minutes at ${getSiteName(guard.siteId)}`,
          timestamp:      new Date(),
          read:           false,
        } as Alert);
      }
    }, INACTIVE_CHECK_MS);
  };

  // ── Apply a real GPS fix ───────────────────────────────────────────────────
  const applyRealFix = (guardId: string, gp: GuardPosition) => {
    console.log(
      `[GPS] ${guardId} | ${gp.lat.toFixed(6)}, ${gp.lng.toFixed(6)}` +
      (gp.accuracy ? ` | ±${Math.round(gp.accuracy)} m` : ""),
    );

    updatePos(guardId, gp);
    lsSet(posKey(guardId), gp);

    lastMovedRef.current     = Date.now();
    inactiveFiredRef.current = false;

    // ── Supabase upsert (throttled) ────────────────────────────────────────
    const now = Date.now();
    if (now - lastSupabaseSyncRef.current >= SUPABASE_SYNC_MS) {
      lastSupabaseSyncRef.current = now;
      const guard = getGuards().find((g) => g.id === guardId);
      if (guard) {
        supabase
          .from("guard_locations")
          .upsert(
            {
              guard_name: guard.name,
              latitude:   gp.lat,
              longitude:  gp.lng,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "guard_name" },
          )
          .then(({ error }) => {
            if (error) console.warn("[Supabase] upsert error:", error.message);
            else console.log(`[Supabase] location synced for ${guard.name}`);
          });
      }
    }

    checkGeofence(guardId, gp.lat, gp.lng);
  };

  // ── Start real GPS ─────────────────────────────────────────────────────────
  const startRealGps = (guardId: string) => {
    const saved = lsGet<GuardPosition>(posKey(guardId));
    if (saved) {
      updatePos(guardId, saved);
    } else {
      const guard = getGuards().find((g) => g.id === guardId);
      const pos   = guard?.position;
      if (pos) {
        updatePos(guardId, {
          lat: pos.lat, lng: pos.lng, accuracy: 0,
          heading: null, speed: null, timestamp: Date.now(), source: "mock",
        });
      }
    }

    if (!("geolocation" in navigator)) {
      console.warn("[GPS] geolocation not available");
      setPermission("unavailable");
      return;
    }

    setTracking(true);
    lastMovedRef.current = Date.now();
    console.log(`[GPS] watchPosition started for ${guardId}`);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPermission("granted");
        applyRealFix(guardId, {
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
          heading:   pos.coords.heading,
          speed:     pos.coords.speed,
          timestamp: pos.timestamp,
          source:    "gps",
        });
      },
      (err) => {
        const reason = err.code === err.PERMISSION_DENIED ? "denied" : "unknown";
        console.warn(`[GPS] error (${reason}): ${err.message}`);
        setPermission(reason);
      },
      GPS_OPTIONS,
    );
  };

  // ── Simulation for other guards ────────────────────────────────────────────
  const startSimulation = (myGuardId: string, allGuards: Guard[]) => {
    allGuards.forEach((g) => {
      if (g.id === myGuardId || g.status === "off-duty") return;
      const pos = g.position;
      if (pos && !simPositions.current[g.id]) {
        simPositions.current[g.id] = { lat: pos.lat, lng: pos.lng };
        updatePos(g.id, {
          lat: pos.lat, lng: pos.lng, accuracy: 0,
          heading: null, speed: null, timestamp: Date.now(), source: "mock",
        });
      }
    });

    simTimerRef.current = setInterval(() => {
      simStepRef.current += 1;
      const step = simStepRef.current;

      allGuards.forEach((g) => {
        if (g.id === myGuardId || g.status === "off-duty") return;
        const base = simPositions.current[g.id];
        if (!base) return;

        const seed = (step * 997 + g.id.charCodeAt(g.id.length - 1) * 31) >>> 0;
        const next = drift(base, seed);
        simPositions.current[g.id] = next;

        updatePos(g.id, {
          lat: next.lat, lng: next.lng, accuracy: 0,
          heading: null, speed: null, timestamp: Date.now(), source: "mock",
        });
      });
    }, SIM_INTERVAL_MS);
  };

  // ── Main effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loggedInGuardId || !isOnDuty) {
      stopAll();
      return;
    }

    startRealGps(loggedInGuardId);
    startSimulation(loggedInGuardId, guards);
    startInactivityTimer(loggedInGuardId);

    return stopAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInGuardId, isOnDuty]);

  // Refresh sim seeds when guard list changes
  useEffect(() => {
    if (!loggedInGuardId || !isOnDuty) return;
    guards.forEach((g) => {
      if (g.id === loggedInGuardId || g.status === "off-duty") return;
      const pos = g.position;
      if (pos && !simPositions.current[g.id]) {
        simPositions.current[g.id] = { lat: pos.lat, lng: pos.lng };
        updatePos(g.id, {
          lat: pos.lat, lng: pos.lng, accuracy: 0,
          heading: null, speed: null, timestamp: Date.now(), source: "mock",
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guards]);
}
