/**
 * db.ts — localStorage-backed data layer for GuardOS.
 */

import { lsGet, lsSet, lsHas } from "./storage";
import { GEOFENCES, scatterInBounds } from "./geofence";

// ─── Core types ───────────────────────────────────────────────────────────────

export type GuardStatus = "on-duty" | "off-duty" | "alert" | "out-of-zone" | "on-patrol" | "idle" | "responding";

/** Activity type shown in the guard detail panel */
export type GuardActivity = "patrol" | "idle" | "alert" | "responding";

// ─── Activity log ─────────────────────────────────────────────────────────────

export type ActivityLogType =
  | "movement"      // position update
  | "zone-entry"    // entered geofence
  | "zone-exit"     // left geofence
  | "checkpoint"    // verified a checkpoint
  | "alert"         // SOS or alert triggered
  | "shift-start"   // started shift
  | "shift-end"     // ended shift
  | "status-change" // status changed (e.g. idle → patrol)
  | "response";     // dispatched to respond

export interface ActivityLog {
  id: string;
  guardId: string;       // Guard.id
  guardDisplayId: string;
  type: ActivityLogType;
  message: string;
  timestamp: Date;
}

export interface Guard {
  id: string;
  guardId: string;
  pin: string;
  name: string;
  siteId: string;
  geofenceId: string;
  status: GuardStatus;
  activity: GuardActivity;
  lastActivity: Date;
  lastActivityLabel: string;
  onDuty: boolean;
  shiftStart: Date | null;
  /** Pre-scattered position inside the geofence polygon */
  position: { lat: number; lng: number };
}

export interface Site {
  id: string;
  name: string;
  address: string;
  zone: { lat: number; lng: number };
}

export interface Checkpoint {
  id: string;
  siteId: string;
  name: string;
  expectedIntervalMins: number;
}

export interface PatrolLog {
  id: string;
  guardId: string;     // Guard.id
  guardDisplayId: string; // Guard.guardId e.g. "GD-001"
  guardName: string;
  siteId: string;
  checkpointId: string;
  checkpointName: string;
  timestamp: Date;
  status: "verified" | "missed";
  pendingSync: boolean;
}

export type AlertType = "shift-start" | "shift-end" | "checkpoint" | "sos" | "missed-checkpoint" | "geofence-breach" | "inactive";

export interface Alert {
  id: string;
  type: AlertType;
  guardId: string;     // Guard.id
  guardDisplayId: string;
  guardName: string;
  siteId: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface Supervisor {
  id: string;
  name: string;
  email: string;
  password: string;
  rank: string;
}

export interface Client {
  id: string;
  name: string;
  siteId: string;
  clientCode: string;
  password: string;
  contactEmail: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const now = new Date();
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

const SEED_SITES: Site[] = [
  { id: "s1", name: "Kotoka International Airport",  address: "Airport City, Accra",          zone: { lat: 5.6040, lng: -0.1640 } },
  { id: "s2", name: "Burma Camp",                    address: "Cantonments, Accra",            zone: { lat: 5.5778, lng: -0.1648 } },
  { id: "s3", name: "University of Ghana",           address: "Legon, Accra",                  zone: { lat: 5.6513, lng: -0.1870 } },
  { id: "s4", name: "Bank of Ghana",                 address: "Thorpe Road, Accra CBD",        zone: { lat: 5.5490, lng: -0.2005 } },
  { id: "s5", name: "Presec Legon",                  address: "Presbyterian Boys' Sec, Legon", zone: { lat: 5.6465, lng: -0.1720 } },
];

// ── Guard name pools per site ─────────────────────────────────────────────────
const NAMES_S1 = [
  "Kwame Asante","Abena Mensah","Kofi Boateng","Ama Owusu","Yaw Darko",
  "Efua Tetteh","Nana Adjei","Akosua Frimpong","Kojo Amponsah","Adwoa Sarpong",
  "Fiifi Quaye","Maame Agyei","Kwesi Ofori","Esi Amoah","Kofi Annan",
];
const NAMES_S2 = [
  "Sgt. Mensah","Cpl. Asare","Pvt. Boateng","Sgt. Owusu","Cpl. Darko",
  "Pvt. Tetteh","Sgt. Adjei","Cpl. Frimpong","Pvt. Amponsah","Sgt. Sarpong",
];
const NAMES_S3 = [
  "Kwabena Acheampong","Akua Bonsu","Yaw Asiedu","Abena Kyei","Kofi Ntim",
  "Ama Dankwa","Kwame Poku","Efua Asante","Nana Boadu","Kojo Mensah",
  "Adwoa Ofori","Fiifi Amoah",
];
const NAMES_S4 = [
  "Emmanuel Quaye","Grace Agyei","Samuel Ofori","Patience Amoah",
  "Daniel Asante","Cecilia Mensah","Francis Boateng","Beatrice Owusu",
];
const NAMES_S5 = [
  "Kweku Darko","Abena Tetteh","Kofi Adjei","Ama Frimpong",
  "Yaw Amponsah","Efua Sarpong","Nana Quaye",
];

const ACTIVITIES: GuardActivity[] = ["patrol", "patrol", "patrol", "idle", "responding"];
const LABELS = [
  "Patrolling perimeter","Checked main gate","Idle at post","Verified checkpoint",
  "Patrolling north wing","Checked vehicle entry","Responding to incident",
  "Verified staff entrance","Idle — awaiting relief","Patrolling east fence",
  "SOS triggered","Checked cargo bay","Patrolling inner compound",
];

function makeGuards(
  siteId: string,
  geofenceId: string,
  names: string[],
  startId: number,
): Guard[] {
  const fence = GEOFENCES.find((gf) => gf.id === geofenceId)!;
  return names.map((name, i) => {
    const idx = startId + i;
    const id = `g${idx}`;
    const guardId = `GD-${String(idx).padStart(3, "0")}`;
    const isOff       = i % 7 === 6;
    const isAlert     = i % 11 === 10;
    const isIdle      = i % 5 === 4;
    const isResponding= i % 9 === 8;
    const status: GuardStatus =
      isOff        ? "off-duty"   :
      isAlert      ? "alert"      :
      isResponding ? "responding" :
      isIdle       ? "idle"       : "on-patrol";
    const activity: GuardActivity =
      isAlert      ? "alert"      :
      isResponding ? "responding" :
      isIdle       ? "idle"       : "patrol";
    const [lat, lng] = scatterInBounds(fence.polygon, idx * 31 + 7);
    return {
      id,
      guardId,
      pin: "1234",
      name,
      siteId,
      geofenceId,
      status,
      activity,
      onDuty: !isOff,
      shiftStart: isOff ? null : hoursAgo(1 + (i % 6)),
      lastActivity: minsAgo(2 + (i * 7) % 55),
      lastActivityLabel: LABELS[i % LABELS.length],
      position: { lat, lng },
    };
  });
}

const SEED_GUARDS: Guard[] = [
  ...makeGuards("s1", "gf-s1", NAMES_S1, 1),
  ...makeGuards("s2", "gf-s2", NAMES_S2, 16),
  ...makeGuards("s3", "gf-s3", NAMES_S3, 26),
  ...makeGuards("s4", "gf-s4", NAMES_S4, 38),
  ...makeGuards("s5", "gf-s5", NAMES_S5, 46),
];

const SEED_CHECKPOINTS: Checkpoint[] = [
  { id: "cp1",  siteId: "s1", name: "Terminal 1 Entrance",    expectedIntervalMins: 20 },
  { id: "cp2",  siteId: "s1", name: "Cargo Bay A",            expectedIntervalMins: 30 },
  { id: "cp3",  siteId: "s1", name: "Perimeter Fence North",  expectedIntervalMins: 45 },
  { id: "cp4",  siteId: "s2", name: "Main Gate",              expectedIntervalMins: 15 },
  { id: "cp5",  siteId: "s2", name: "Armoury Block",          expectedIntervalMins: 30 },
  { id: "cp6",  siteId: "s3", name: "Great Hall",             expectedIntervalMins: 30 },
  { id: "cp7",  siteId: "s3", name: "Balme Library",          expectedIntervalMins: 45 },
  { id: "cp8",  siteId: "s3", name: "Student Hostel Block A", expectedIntervalMins: 60 },
  { id: "cp9",  siteId: "s4", name: "Main Entrance",          expectedIntervalMins: 15 },
  { id: "cp10", siteId: "s4", name: "Vault Corridor",         expectedIntervalMins: 20 },
  { id: "cp11", siteId: "s5", name: "School Gate",            expectedIntervalMins: 20 },
  { id: "cp12", siteId: "s5", name: "Dormitory Block",        expectedIntervalMins: 40 },
];

const SEED_SUPERVISORS: Supervisor[] = [
  { id: "sup1", name: "Captain Rivera", email: "rivera@guardos.com", password: "demo", rank: "Watch Commander" },
  { id: "sup2", name: "Lt. Park",       email: "park@guardos.com",   password: "demo", rank: "Dispatch Lead"   },
];

const SEED_CLIENTS: Client[] = [
  { id: "c1", name: "Ghana Airports Authority",    siteId: "s1", clientCode: "CLI-AIRPORT", password: "demo", contactEmail: "security@ghanaairports.com.gh" },
  { id: "c2", name: "Ghana Armed Forces",          siteId: "s2", clientCode: "CLI-BURMA",   password: "demo", contactEmail: "security@gaf.mil.gh"          },
  { id: "c3", name: "University of Ghana",         siteId: "s3", clientCode: "CLI-UG",      password: "demo", contactEmail: "security@ug.edu.gh"           },
  { id: "c4", name: "Bank of Ghana",               siteId: "s4", clientCode: "CLI-BOG",     password: "demo", contactEmail: "security@bog.gov.gh"          },
  { id: "c5", name: "Presec Old Boys Association", siteId: "s5", clientCode: "CLI-PRESEC",  password: "demo", contactEmail: "admin@presec.edu.gh"          },
];

const SEED_PATROL_LOGS: PatrolLog[] = SEED_GUARDS.slice(0, 15).map((g, i) => ({
  id: `pl${i + 1}`,
  guardId: g.id,
  guardDisplayId: g.guardId,
  guardName: g.name,
  siteId: g.siteId,
  checkpointId: `cp${(i % 12) + 1}`,
  checkpointName: SEED_CHECKPOINTS[i % 12].name,
  timestamp: minsAgo(3 + i * 8),
  status: i % 6 === 5 ? "missed" : "verified",
  pendingSync: false,
}));

const SEED_ALERTS: Alert[] = [
  { id: "a1", type: "sos",               guardId: "g10", guardDisplayId: "GD-010", guardName: NAMES_S1[9],  siteId: "s1", message: `SOS triggered by ${NAMES_S1[9]} at KIA`,           timestamp: minsAgo(8),  read: false },
  { id: "a2", type: "missed-checkpoint", guardId: "g20", guardDisplayId: "GD-020", guardName: NAMES_S2[4],  siteId: "s2", message: `${NAMES_S2[4]} missed Armoury Block patrol`,        timestamp: minsAgo(22), read: false },
  { id: "a3", type: "shift-start",       guardId: "g1",  guardDisplayId: "GD-001", guardName: NAMES_S1[0],  siteId: "s1", message: `${NAMES_S1[0]} started shift at KIA`,               timestamp: hoursAgo(2), read: true  },
  { id: "a4", type: "checkpoint",        guardId: "g26", guardDisplayId: "GD-026", guardName: NAMES_S3[0],  siteId: "s3", message: `${NAMES_S3[0]} checked Great Hall at UG`,           timestamp: minsAgo(15), read: true  },
  { id: "a5", type: "shift-end",         guardId: "g38", guardDisplayId: "GD-038", guardName: NAMES_S4[0],  siteId: "s4", message: `${NAMES_S4[0]} ended shift at Bank of Ghana`,       timestamp: hoursAgo(1), read: true  },
];

// ── Seed activity logs — realistic per-guard history ─────────────────────────
function seedActivityLogs(): ActivityLog[] {
  const logs: ActivityLog[] = [];
  let logId = 1;

  const add = (
    guardId: string, guardDisplayId: string,
    type: ActivityLogType, message: string, timestamp: Date,
  ) => {
    logs.push({ id: `al${logId++}`, guardId, guardDisplayId, type, message, timestamp });
  };

  // KIA guards (g1–g15)
  add("g1",  "GD-001", "shift-start",   "Started shift at Kotoka International Airport",  hoursAgo(4));
  add("g1",  "GD-001", "zone-entry",    "Entered Terminal 1 Entrance zone",                hoursAgo(3.8));
  add("g1",  "GD-001", "checkpoint",    "Verified Terminal 1 Entrance",                    hoursAgo(3.5));
  add("g1",  "GD-001", "movement",      "Moving along perimeter — north sector",           hoursAgo(2.5));
  add("g1",  "GD-001", "checkpoint",    "Verified Cargo Bay A",                            hoursAgo(2));
  add("g1",  "GD-001", "status-change", "Status changed: On Patrol",                       hoursAgo(1.5));
  add("g1",  "GD-001", "movement",      "Patrolling south perimeter",                      minsAgo(45));
  add("g1",  "GD-001", "checkpoint",    "Verified Perimeter Fence North",                  minsAgo(12));

  add("g2",  "GD-002", "shift-start",   "Started shift at Kotoka International Airport",  hoursAgo(2));
  add("g2",  "GD-002", "zone-entry",    "Entered Cargo Bay A zone",                        hoursAgo(1.8));
  add("g2",  "GD-002", "movement",      "Patrolling cargo area",                           hoursAgo(1));
  add("g2",  "GD-002", "status-change", "Status changed: Idle",                            minsAgo(30));
  add("g2",  "GD-002", "movement",      "Resumed patrol — east wing",                      minsAgo(5));

  add("g10", "GD-010", "shift-start",   "Started shift at Kotoka International Airport",  hoursAgo(3));
  add("g10", "GD-010", "movement",      "Patrolling terminal entrance",                    hoursAgo(2));
  add("g10", "GD-010", "zone-exit",     "Left assigned zone — heading to car park",        minsAgo(20));
  add("g10", "GD-010", "alert",         "SOS triggered — requesting backup",               minsAgo(8));

  // Burma Camp guards (g16–g25)
  add("g16", "GD-016", "shift-start",   "Started shift at Burma Camp",                     hoursAgo(3));
  add("g16", "GD-016", "checkpoint",    "Verified Main Gate",                              hoursAgo(2.5));
  add("g16", "GD-016", "movement",      "Patrolling inner compound",                       hoursAgo(1.5));
  add("g16", "GD-016", "status-change", "Status changed: Responding",                      minsAgo(40));
  add("g16", "GD-016", "response",      "Dispatched to Armoury Block — suspicious activity", minsAgo(35));
  add("g16", "GD-016", "status-change", "Status changed: On Patrol",                       minsAgo(10));

  add("g20", "GD-020", "shift-start",   "Started shift at Burma Camp",                     hoursAgo(5));
  add("g20", "GD-020", "checkpoint",    "Verified Armoury Block",                          hoursAgo(4));
  add("g20", "GD-020", "movement",      "Patrolling east perimeter",                       hoursAgo(2));
  add("g20", "GD-020", "status-change", "Status changed: Idle",                            hoursAgo(1));
  add("g20", "GD-020", "alert",         "Missed Armoury Block patrol — overdue 8 mins",    minsAgo(22));

  // UG guards (g26–g37)
  add("g26", "GD-026", "shift-start",   "Started shift at University of Ghana",            hoursAgo(2));
  add("g26", "GD-026", "zone-entry",    "Entered Great Hall zone",                         hoursAgo(1.8));
  add("g26", "GD-026", "checkpoint",    "Verified Great Hall",                             minsAgo(15));
  add("g26", "GD-026", "movement",      "Moving toward Balme Library",                     minsAgo(8));

  // Bank of Ghana guards (g38–g45)
  add("g38", "GD-038", "shift-start",   "Started shift at Bank of Ghana",                  hoursAgo(6));
  add("g38", "GD-038", "checkpoint",    "Verified Main Entrance",                          hoursAgo(5));
  add("g38", "GD-038", "checkpoint",    "Verified Vault Corridor",                         hoursAgo(4));
  add("g38", "GD-038", "movement",      "Patrolling lobby area",                           hoursAgo(2));
  add("g38", "GD-038", "shift-end",     "Ended shift at Bank of Ghana",                    hoursAgo(1));

  // Presec guards (g46–g52)
  add("g46", "GD-046", "shift-start",   "Started shift at Presec Legon",                   hoursAgo(3));
  add("g46", "GD-046", "checkpoint",    "Verified School Gate",                            hoursAgo(2.5));
  add("g46", "GD-046", "movement",      "Patrolling dormitory block",                      hoursAgo(1));
  add("g46", "GD-046", "status-change", "Status changed: Idle",                            minsAgo(20));

  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

const SEED_ACTIVITY_LOGS: ActivityLog[] = seedActivityLogs();

// ─── Seed on first run ────────────────────────────────────────────────────────

/** Bump this when the data schema changes — forces a re-seed on next load. */
const SCHEMA_VERSION = "v8";

export function seedIfEmpty(): void {
  // If the stored schema version doesn't match, wipe everything and re-seed.
  const storedVersion = localStorage.getItem("guardos:schema");
  if (storedVersion !== SCHEMA_VERSION) {
    // Clear all guardos: keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("guardos:")) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("guardos:schema", SCHEMA_VERSION);
  }

  if (!lsHas("sites"))         lsSet("sites",         SEED_SITES);
  if (!lsHas("guards"))        lsSet("guards",        SEED_GUARDS);
  if (!lsHas("checkpoints"))   lsSet("checkpoints",   SEED_CHECKPOINTS);
  if (!lsHas("supervisors"))   lsSet("supervisors",   SEED_SUPERVISORS);
  if (!lsHas("clients"))       lsSet("clients",       SEED_CLIENTS);
  if (!lsHas("patrolLogs"))    lsSet("patrolLogs",    SEED_PATROL_LOGS);
  if (!lsHas("alerts"))        lsSet("alerts",        SEED_ALERTS);
  if (!lsHas("activityLogs"))  lsSet("activityLogs",  SEED_ACTIVITY_LOGS);
}

// ─── Readers ──────────────────────────────────────────────────────────────────

export const getGuards        = (): Guard[]        => lsGet<Guard[]>("guards")               ?? SEED_GUARDS;
export const getSites         = (): Site[]         => lsGet<Site[]>("sites")                 ?? SEED_SITES;
export const getCheckpoints   = (): Checkpoint[]   => lsGet<Checkpoint[]>("checkpoints")     ?? SEED_CHECKPOINTS;
export const getSupervisors   = (): Supervisor[]   => lsGet<Supervisor[]>("supervisors")     ?? SEED_SUPERVISORS;
export const getClients       = (): Client[]       => lsGet<Client[]>("clients")             ?? SEED_CLIENTS;
export const getPatrolLogs    = (): PatrolLog[]    => lsGet<PatrolLog[]>("patrolLogs")       ?? SEED_PATROL_LOGS;
export const getAlerts        = (): Alert[]        => lsGet<Alert[]>("alerts")               ?? SEED_ALERTS;
export const getActivityLogs  = (): ActivityLog[]  => lsGet<ActivityLog[]>("activityLogs")   ?? SEED_ACTIVITY_LOGS;

// ─── Writers ──────────────────────────────────────────────────────────────────

export const saveGuards     = (v: Guard[])     => lsSet("guards",     v);
export const savePatrolLogs = (v: PatrolLog[]) => lsSet("patrolLogs", v);
export const saveAlerts     = (v: Alert[])     => lsSet("alerts",     v);

// ─── Mutations ────────────────────────────────────────────────────────────────

export function updateGuard(id: string, patch: Partial<Guard>): Guard[] {
  const list = getGuards().map((g) => (g.id === id ? { ...g, ...patch } : g));
  saveGuards(list);
  return list;
}

export function addPatrolLog(entry: PatrolLog): PatrolLog[] {
  const list = [entry, ...getPatrolLogs()];
  savePatrolLogs(list);
  return list;
}

export function addAlert(alert: Alert): Alert[] {
  const list = [alert, ...getAlerts()];
  saveAlerts(list);
  return list;
}

export function markAlertRead(id: string): Alert[] {
  const list = getAlerts().map((a) => (a.id === id ? { ...a, read: true } : a));
  saveAlerts(list);
  return list;
}

export function markAllAlertsRead(): Alert[] {
  const list = getAlerts().map((a) => ({ ...a, read: true }));
  saveAlerts(list);
  return list;
}

export function addActivityLog(entry: ActivityLog): ActivityLog[] {
  const list = [entry, ...getActivityLogs()].slice(0, 200); // cap at 200
  lsSet("activityLogs", list);
  return list;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** Authenticate a guard by Guard ID (e.g. "GD-001") + 4-digit PIN. */
export function authGuard(guardId: string, pin: string): Guard | null {
  const normalised = guardId.trim().toUpperCase();
  const guard = getGuards().find((g) => g.guardId.toUpperCase() === normalised);
  if (!guard) return null;
  return guard.pin === pin ? guard : null;
}

/** Authenticate a supervisor by email + password. */
export function authSupervisor(email: string, password: string): Supervisor | null {
  const sup = getSupervisors().find(
    (s) => s.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!sup) return null;
  return sup.password === password ? sup : null;
}

/** Authenticate a client by code or email + password. */
export function authClient(codeOrEmail: string, password: string): Client | null {
  const val = codeOrEmail.trim().toLowerCase();
  const client = getClients().find(
    (c) => c.clientCode.toLowerCase() === val || c.contactEmail.toLowerCase() === val,
  );
  if (!client) return null;
  return client.password === password ? client : null;
}
