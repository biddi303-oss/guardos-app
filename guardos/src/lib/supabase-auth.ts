/**
 * supabase-auth.ts
 *
 * Authentication helpers using Supabase.
 *
 * - Admin / Supervisor: Supabase Auth (email + password)
 * - Client:             Supabase Auth (email + password)
 * - Guard:              Custom RPC — Guard ID + PIN verified server-side
 *                       via pgcrypto. No email, no Supabase Auth session.
 */

import { supabase } from "@/supabase";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface AuthProfile {
  id: string;
  role: "admin" | "client";
  name: string | null;
  rank: string | null;
  site_id: string | null;
  client_code: string | null;
}

export interface GuardAuthResult {
  id: string;
  guard_id: string;
  name: string;
  site_id: string;
  geofence_id: string;
  status: string;
}

export type AuthError =
  | "invalid-credentials"
  | "no-profile"
  | "wrong-role"
  | "network-error";

export interface AuthResult {
  profile: AuthProfile | null;
  error: AuthError | null;
}

export interface GuardResult {
  guard: GuardAuthResult | null;
  error: "invalid-credentials" | "network-error" | null;
}

// ── Guard: Guard ID + PIN via RPC ─────────────────────────────────────────────

export async function signInGuard(
  guardId: string,
  pin: string,
): Promise<GuardResult> {
  try {
    const { data, error } = await supabase.rpc("verify_guard_pin", {
      p_guard_id: guardId.trim().toUpperCase(),
      p_pin:      pin.trim(),
    });

    if (error) {
      console.warn("[Auth] guard RPC error:", error.message);
      return { guard: null, error: "network-error" };
    }

    // RPC returns an array; empty = no match
    if (!data || data.length === 0) {
      return { guard: null, error: "invalid-credentials" };
    }

    return { guard: data[0] as GuardAuthResult, error: null };
  } catch {
    return { guard: null, error: "network-error" };
  }
}

// ── Admin / Supervisor: Supabase Auth ─────────────────────────────────────────

export async function signInAdmin(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  // ── DEBUG: log the exact Supabase response ────────────────────────────────
  console.log("[signInAdmin] email sent:", email.trim().toLowerCase());
  console.log("[signInAdmin] supabase error:", error);
  console.log("[signInAdmin] supabase data.user:", data?.user ?? null);
  // ─────────────────────────────────────────────────────────────────────────

  if (error || !data.user) {
    return { profile: null, error: "invalid-credentials" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, name, rank, site_id, client_code")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { profile: null, error: "no-profile" };
  }

  if (profile.role !== "admin") {
    await supabase.auth.signOut();
    return { profile: null, error: "wrong-role" };
  }

  return { profile: profile as AuthProfile, error: null };
}

// ── Client: Supabase Auth ─────────────────────────────────────────────────────

export async function signInClient(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    return { profile: null, error: "invalid-credentials" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, name, rank, site_id, client_code")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { profile: null, error: "no-profile" };
  }

  if (profile.role !== "client") {
    await supabase.auth.signOut();
    return { profile: null, error: "wrong-role" };
  }

  return { profile: profile as AuthProfile, error: null };
}

// ── Sign out (admin / client Supabase session) ────────────────────────────────

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ── Restore Supabase session on app load ──────────────────────────────────────

export async function getSessionProfile(): Promise<AuthProfile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, name, rank, site_id, client_code")
    .eq("id", session.user.id)
    .single();

  return profile as AuthProfile | null;
}

// ── Human-readable error messages ────────────────────────────────────────────

export function authErrorMessage(err: AuthError): string {
  switch (err) {
    case "invalid-credentials": return "Incorrect email or password.";
    case "no-profile":          return "Account found but no role assigned. Contact your administrator.";
    case "wrong-role":          return "This account does not have access to this portal.";
    case "network-error":       return "Network error. Check your connection and try again.";
  }
}

export function guardAuthErrorMessage(
  err: "invalid-credentials" | "network-error",
): string {
  switch (err) {
    case "invalid-credentials": return "Invalid Guard ID or PIN. Check your badge.";
    case "network-error":       return "Connection error. Check your internet and try again.";
  }
}
