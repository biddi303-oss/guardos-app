import { addDays, subDays, subHours, subMinutes } from "date-fns";

export type Status = "active" | "offline" | "alert";
export type Severity = "info" | "warning" | "critical";

export interface Site {
  id: string;
  name: string;
  address: string;
  zone: { lat: number; lng: number };
}

export interface Guard {
  id: string;
  /** Human-readable badge label shown on the physical card (e.g. "G-1042"). */
  badgeId: string;
  /**
   * Unique serial number used for login — distinct from the display badge ID.
   * Format: SN-XXXXXX (6 digits). Guards enter this at the login screen.
   */
  serialNumber: string;
  name: string;
  avatar?: string;
  siteId: string;
  status: Status;
  shiftStart: Date;
  lastLocation: { lat: number; lng: number };
  battery: number;
  lastCheckpointTime: Date;
}

export interface Checkpoint {
  id: string;
  siteId: string;
  name: string;
  expectedIntervalMins: number;
}

export interface Patrol {
  id: string;
  guardId: string;
  siteId: string;
  startTime: Date;
  status: "in-progress" | "completed";
  checkpointsCompleted: number;
  totalCheckpoints: number;
}

export interface Incident {
  id: string;
  siteId: string;
  guardId: string;
  type: string;
  severity: Severity;
  description: string;
  timestamp: Date;
  photo?: string;
}

export interface Alert {
  id: string;
  type: "missed-checkpoint" | "geofence-breach" | "sos" | "low-battery" | "incident";
  siteId: string;
  guardId: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface Client {
  id: string;
  name: string;
  siteId: string;
  clientCode: string;
  contactEmail: string;
}

export interface Supervisor {
  id: string;
  name: string;
  email: string;
  rank: string;
}

const now = new Date();

export const sites: Site[] = [
  { id: "s1", name: "Helix Biotech Campus", address: "100 Innovation Way", zone: { lat: 37.7749, lng: -122.4194 } },
  { id: "s2", name: "Meridian Tower", address: "500 Financial Dr", zone: { lat: 37.7849, lng: -122.4094 } },
  { id: "s3", name: "Pier 19 Logistics", address: "Pier 19, Port Authority", zone: { lat: 37.8049, lng: -122.3994 } },
  { id: "s4", name: "Aurora Embassy Quarter", address: "88 Diplomat Row", zone: { lat: 37.7949, lng: -122.4294 } },
];

export const clients: Client[] = [
  { id: "c1", name: "Helix Biosciences", siteId: "s1", clientCode: "CLI-HELIX", contactEmail: "ops@helixbio.com" },
  { id: "c2", name: "Meridian Properties", siteId: "s2", clientCode: "CLI-MERID", contactEmail: "facilities@meridian.com" },
  { id: "c3", name: "Global Freight Co", siteId: "s3", clientCode: "CLI-GFRT", contactEmail: "security@globalfreight.com" },
  { id: "c4", name: "Aurora Consulate", siteId: "s4", clientCode: "CLI-AURORA", contactEmail: "attache@aurora.gov" },
];

export const supervisors: Supervisor[] = [
  { id: "sup1", name: "Captain Rivera", email: "rivera@guardos.com", rank: "Watch Commander" },
  { id: "sup2", name: "Lt. Park", email: "park@guardos.com", rank: "Dispatch Lead" },
];

/** Demo PIN that works for any badge ID in the prototype. */
export const DEMO_GUARD_PIN = "1234";
/** Demo password that works for any supervisor or client account. */
export const DEMO_PASSWORD = "demo";

export const guards: Guard[] = [
  { id: "g1",  badgeId: "G-1042", serialNumber: "SN-104201", name: "Sarah Jenkins",  avatar: "/src/assets/avatars/guard1.png", siteId: "s1", status: "active",  shiftStart: subHours(now, 4),  lastLocation: { lat: 37.7750, lng: -122.4190 }, battery: 82, lastCheckpointTime: subMinutes(now, 12) },
  { id: "g2",  badgeId: "G-2088", serialNumber: "SN-208802", name: "Marcus Thorne",  avatar: "/src/assets/avatars/guard2.png", siteId: "s1", status: "active",  shiftStart: subHours(now, 2),  lastLocation: { lat: 37.7745, lng: -122.4198 }, battery: 95, lastCheckpointTime: subMinutes(now, 5) },
  { id: "g3",  badgeId: "G-1105", serialNumber: "SN-110503", name: "Elena Rostova",  avatar: "/src/assets/avatars/guard3.png", siteId: "s2", status: "alert",   shiftStart: subHours(now, 6),  lastLocation: { lat: 37.7850, lng: -122.4090 }, battery: 45, lastCheckpointTime: subMinutes(now, 28) },
  { id: "g4",  badgeId: "G-3391", serialNumber: "SN-339104", name: "David Chen",     avatar: "/src/assets/avatars/guard4.png", siteId: "s3", status: "active",  shiftStart: subHours(now, 1),  lastLocation: { lat: 37.8050, lng: -122.3990 }, battery: 99, lastCheckpointTime: subMinutes(now, 2) },
  { id: "g5",  badgeId: "G-4402", serialNumber: "SN-440205", name: "James Wilson",   siteId: "s4", status: "offline", shiftStart: subHours(now, 8),  lastLocation: { lat: 37.7950, lng: -122.4290 }, battery: 12, lastCheckpointTime: subMinutes(now, 120) },
  { id: "g6",  badgeId: "G-1099", serialNumber: "SN-109906", name: "Anita Patel",    siteId: "s2", status: "active",  shiftStart: subHours(now, 3),  lastLocation: { lat: 37.7845, lng: -122.4095 }, battery: 76, lastCheckpointTime: subMinutes(now, 15) },
  { id: "g7",  badgeId: "G-2155", serialNumber: "SN-215507", name: "Michael Chang",  siteId: "s3", status: "active",  shiftStart: subHours(now, 5),  lastLocation: { lat: 37.8045, lng: -122.3995 }, battery: 60, lastCheckpointTime: subMinutes(now, 20) },
  { id: "g8",  badgeId: "G-3022", serialNumber: "SN-302208", name: "Jessica Alba",   siteId: "s4", status: "active",  shiftStart: subHours(now, 2),  lastLocation: { lat: 37.7945, lng: -122.4295 }, battery: 88, lastCheckpointTime: subMinutes(now, 8) },
  { id: "g9",  badgeId: "G-1188", serialNumber: "SN-118809", name: "Robert King",    siteId: "s1", status: "offline", shiftStart: subHours(now, 10), lastLocation: { lat: 37.7740, lng: -122.4180 }, battery: 5,  lastCheckpointTime: subMinutes(now, 200) },
  { id: "g10", badgeId: "G-4055", serialNumber: "SN-405510", name: "Lisa Wong",      siteId: "s2", status: "active",  shiftStart: subHours(now, 1),  lastLocation: { lat: 37.7840, lng: -122.4080 }, battery: 96, lastCheckpointTime: subMinutes(now, 3) },
  { id: "g11", badgeId: "G-2233", serialNumber: "SN-223311", name: "Thomas Wright",  siteId: "s3", status: "alert",   shiftStart: subHours(now, 7),  lastLocation: { lat: 37.8040, lng: -122.3980 }, battery: 22, lastCheckpointTime: subMinutes(now, 45) },
  { id: "g12", badgeId: "G-3144", serialNumber: "SN-314412", name: "Kevin Scott",    siteId: "s4", status: "active",  shiftStart: subHours(now, 4),  lastLocation: { lat: 37.7940, lng: -122.4280 }, battery: 70, lastCheckpointTime: subMinutes(now, 18) },
];

export const checkpoints: Checkpoint[] = [
  { id: "cp1", siteId: "s1", name: "North Gate", expectedIntervalMins: 30 },
  { id: "cp2", siteId: "s1", name: "Lobby Desk", expectedIntervalMins: 60 },
  { id: "cp3", siteId: "s1", name: "Server Room A", expectedIntervalMins: 15 },
  { id: "cp4", siteId: "s2", name: "Parking Garage L1", expectedIntervalMins: 45 },
  { id: "cp5", siteId: "s2", name: "Roof Access", expectedIntervalMins: 120 },
  { id: "cp6", siteId: "s3", name: "Loading Bay 4", expectedIntervalMins: 30 },
  { id: "cp7", siteId: "s3", name: "Perimeter Fence East", expectedIntervalMins: 60 },
  { id: "cp8", siteId: "s4", name: "Main Entrance", expectedIntervalMins: 15 },
  { id: "cp9", siteId: "s4", name: "Diplomat Lounge", expectedIntervalMins: 30 },
];

export const incidents: Incident[] = [
  { id: "inc1", siteId: "s1", guardId: "g1", type: "suspicious-person", severity: "warning", description: "Individual loitering near the north gate. Escorted off property.", timestamp: subHours(now, 2), photo: "/src/assets/incidents/door.png" },
  { id: "inc2", siteId: "s2", guardId: "g3", type: "broken-window", severity: "critical", description: "Broken glass found on the ground floor near the main entrance. Area secured.", timestamp: subHours(now, 5) },
  { id: "inc3", siteId: "s3", guardId: "g4", type: "unattended-package", severity: "warning", description: "Unattended box found in the loading bay. Cleared by supervisor.", timestamp: subDays(now, 1), photo: "/src/assets/incidents/package.png" },
  { id: "inc4", siteId: "s4", guardId: "g8", type: "trespass", severity: "critical", description: "Unauthorized vehicle attempted to enter the embassy quarter. Denied entry.", timestamp: subDays(now, 2) },
  { id: "inc5", siteId: "s1", guardId: "g2", type: "medical", severity: "critical", description: "Employee slipped in the lobby. First aid administered.", timestamp: subDays(now, 3) },
  { id: "inc6", siteId: "s2", guardId: "g6", type: "fire-alarm", severity: "info", description: "False alarm triggered on floor 12. System reset.", timestamp: subDays(now, 4) },
];

export const initialAlerts: Alert[] = [
  { id: "a1", type: "missed-checkpoint", siteId: "s2", guardId: "g3", message: "Elena missed 'Roof Access' checkpoint by 15 mins", timestamp: subMinutes(now, 15), read: false },
  { id: "a2", type: "low-battery", siteId: "s4", guardId: "g5", message: "James' device battery critically low (12%)", timestamp: subMinutes(now, 45), read: false },
  { id: "a3", type: "sos", siteId: "s3", guardId: "g11", message: "SOS TRIGGERED: Thomas Wright at Pier 19", timestamp: subMinutes(now, 2), read: false },
  { id: "a4", type: "incident", siteId: "s1", guardId: "g1", message: "New Incident: Suspicious person at North Gate", timestamp: subHours(now, 2), read: true },
];
