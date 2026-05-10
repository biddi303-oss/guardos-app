/**
 * storage.ts
 *
 * Typed localStorage helpers. All values are JSON-serialised with a custom
 * Date reviver so that Date fields survive the round-trip correctly.
 *
 * Keys are namespaced under "guardos:" to avoid collisions.
 */

const NS = "guardos:";

/** JSON replacer — converts Date → ISO string tagged with a sentinel. */
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) return { __date: value.toISOString() };
  return value;
}

/** JSON reviver — converts tagged ISO strings back to Date objects. */
function reviver(_key: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    "__date" in (value as Record<string, unknown>)
  ) {
    return new Date((value as { __date: string }).__date);
  }
  return value;
}

export function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(NS + key);
    if (raw === null) return null;
    return JSON.parse(raw, reviver) as T;
  } catch {
    return null;
  }
}

export function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value, replacer));
  } catch {
    // Storage quota exceeded — fail silently
  }
}

export function lsRemove(key: string): void {
  localStorage.removeItem(NS + key);
}

/** Returns true if the key has never been written. */
export function lsHas(key: string): boolean {
  return localStorage.getItem(NS + key) !== null;
}
