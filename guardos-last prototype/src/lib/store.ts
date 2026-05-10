import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  getGuards,
  getAlerts,
  getPatrolLogs,
  getActivityLogs,
  getSites,
  addAlert as dbAddAlert,
  markAlertRead as dbMarkAlertRead,
  markAllAlertsRead as dbMarkAllAlertsRead,
  addPatrolLog as dbAddPatrolLog,
  addActivityLog as dbAddActivityLog,
  updateGuard as dbUpdateGuard,
  type Guard,
  type Alert,
  type PatrolLog,
  type ActivityLog,
} from "./db";
import { defaultBoundaryFor, type LatLng } from "./geo";

export type Role = "guard" | "admin" | "client" | null;

export interface GuardPosition {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  source: "gps" | "mock";
}

interface AppState {
  // ── Auth ───────────────────────────────────────────────────────────────────
  role: Role;
  userId: string | null;
  setRole: (role: Role, userId?: string) => void;
  logout: () => void;

  // ── Guard duty ─────────────────────────────────────────────────────────────
  isOnDuty: boolean;
  setOnDuty: (v: boolean) => void;

  // ── Offline queue ──────────────────────────────────────────────────────────
  pendingCount: number;
  incrementPending: () => void;
  clearPending: () => void;

  // ── GPS ────────────────────────────────────────────────────────────────────
  guardPositions: Record<string, GuardPosition>;
  updateGuardPosition: (guardId: string, pos: GuardPosition) => void;
  gpsPermission: "unknown" | "granted" | "denied" | "unavailable";
  setGpsPermission: (v: "unknown" | "granted" | "denied" | "unavailable") => void;
  isTrackingGps: boolean;
  setIsTrackingGps: (v: boolean) => void;

  // ── Guards ─────────────────────────────────────────────────────────────────
  guards: Guard[];
  reloadGuards: () => void;
  updateGuard: (id: string, patch: Partial<Guard>) => void;

  // ── Alerts ─────────────────────────────────────────────────────────────────
  alerts: Alert[];
  reloadAlerts: () => void;
  addAlert: (alert: Alert) => void;
  markAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;

  // ── Patrol logs ────────────────────────────────────────────────────────────
  patrolLogs: PatrolLog[];
  reloadPatrolLogs: () => void;
  addPatrolLog: (entry: PatrolLog) => void;

  // ── Activity logs ──────────────────────────────────────────────────────────
  activityLogs: ActivityLog[];
  reloadActivityLogs: () => void;
  addActivityLog: (entry: ActivityLog) => void;

  // ── Geofence / map ─────────────────────────────────────────────────────────
  geofenceRadii: Record<string, number>;
  setGeofenceRadius: (siteId: string, radius: number) => void;
  siteBoundaries: Record<string, LatLng[]>;
  setSiteBoundary: (siteId: string, boundary: LatLng[]) => void;
  resetSiteBoundary: (siteId: string) => void;
  selectedGuardId: string | null;
  setSelectedGuardId: (id: string | null) => void;
  mapLayers: { routes: boolean; geofences: boolean; labels: boolean; buildings: boolean };
  toggleMapLayer: (key: "routes" | "geofences" | "labels" | "buildings") => void;
}

const DEFAULT_RADII: Record<string, number> = { s1: 220, s2: 180, s3: 260, s4: 200 };

function buildDefaultBoundaries(): Record<string, LatLng[]> {
  return Object.fromEntries(
    getSites().map((s) => [s.id, defaultBoundaryFor(s, DEFAULT_RADII[s.id] ?? 220)]),
  );
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // ── Auth ─────────────────────────────────────────────────────────────
      role: null,
      userId: null,
      setRole: (role, userId) => set({ role, userId: userId ?? null }),
      logout: () => set({ role: null, userId: null, isOnDuty: false, isTrackingGps: false }),

      // ── Duty ─────────────────────────────────────────────────────────────
      isOnDuty: false,
      setOnDuty: (v) => set({ isOnDuty: v }),

      // ── Pending ───────────────────────────────────────────────────────────
      pendingCount: 0,
      incrementPending: () => set((s) => ({ pendingCount: s.pendingCount + 1 })),
      clearPending: () => set({ pendingCount: 0 }),

      // ── GPS ───────────────────────────────────────────────────────────────
      guardPositions: {},
      updateGuardPosition: (guardId, pos) => {
        set((s) => ({ guardPositions: { ...s.guardPositions, [guardId]: pos } }));
      },
      gpsPermission: "unknown",
      setGpsPermission: (v) => set({ gpsPermission: v }),
      isTrackingGps: false,
      setIsTrackingGps: (v) => set({ isTrackingGps: v }),

      // ── Guards ────────────────────────────────────────────────────────────
      guards: getGuards(),
      reloadGuards: () => set({ guards: getGuards() }),
      updateGuard: (id, patch) => {
        const updated = dbUpdateGuard(id, patch);
        set({ guards: updated });
      },

      // ── Alerts ────────────────────────────────────────────────────────────
      alerts: getAlerts(),
      reloadAlerts: () => set({ alerts: getAlerts() }),
      addAlert: (alert) => {
        const updated = dbAddAlert(alert);
        set({ alerts: updated });
      },
      markAlertRead: (id) => {
        const updated = dbMarkAlertRead(id);
        set({ alerts: updated });
      },
      markAllAlertsRead: () => {
        const updated = dbMarkAllAlertsRead();
        set({ alerts: updated });
      },

      // ── Patrol logs ───────────────────────────────────────────────────────
      patrolLogs: getPatrolLogs(),
      reloadPatrolLogs: () => set({ patrolLogs: getPatrolLogs() }),
      addPatrolLog: (entry) => {
        const updated = dbAddPatrolLog(entry);
        set({ patrolLogs: updated });
      },

      // ── Activity logs ─────────────────────────────────────────────────────
      activityLogs: getActivityLogs(),
      reloadActivityLogs: () => set({ activityLogs: getActivityLogs() }),
      addActivityLog: (entry) => {
        const updated = dbAddActivityLog(entry);
        set({ activityLogs: updated });
      },

      // ── Geofence / map ────────────────────────────────────────────────────
      geofenceRadii: DEFAULT_RADII,
      setGeofenceRadius: (siteId, radius) =>
        set((s) => ({ geofenceRadii: { ...s.geofenceRadii, [siteId]: radius } })),

      siteBoundaries: buildDefaultBoundaries(),
      setSiteBoundary: (siteId, boundary) =>
        set((s) => ({ siteBoundaries: { ...s.siteBoundaries, [siteId]: boundary } })),
      resetSiteBoundary: (siteId) =>
        set((s) => {
          const site = getSites().find((x) => x.id === siteId);
          if (!site) return s;
          return {
            siteBoundaries: {
              ...s.siteBoundaries,
              [siteId]: defaultBoundaryFor(site, s.geofenceRadii[siteId] ?? 220),
            },
          };
        }),

      selectedGuardId: null,
      setSelectedGuardId: (id) => set({ selectedGuardId: id }),
      mapLayers: { routes: true, geofences: true, labels: true, buildings: true },
      toggleMapLayer: (key) =>
        set((s) => ({ mapLayers: { ...s.mapLayers, [key]: !s.mapLayers[key] } })),
    }),
    {
      name: "guardos-ui",
      partialize: (s) => ({
        role: s.role,
        userId: s.userId,
        isOnDuty: s.isOnDuty,
        geofenceRadii: s.geofenceRadii,
        siteBoundaries: s.siteBoundaries,
        mapLayers: s.mapLayers,
      }),
    },
  ),
);
