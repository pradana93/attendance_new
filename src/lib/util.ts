/** Small shared helpers: dates, randomness, geo, formatting, CSV. */

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

/** Deterministic PRNG so seeded demo data stays stable. */
export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/* ---------------- dates ---------------- */
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const todayKey = () => dayKey(new Date());
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
/** Monday-start week. */
export function mondayOf(d: Date): Date {
  const c = new Date(d);
  const dow = (c.getDay() + 6) % 7;
  return addDays(c, -dow);
}
export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function fmtDate(key: string): string {
  return parseKey(key).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
export function fmtDateLong(key: string): string {
  return parseKey(key).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
export function fmtTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
export function fmtClock(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
export function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
export function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // overnight
  return Math.round((mins / 60) * 100) / 100;
}
export function isAfter(hhmm: string, threshold: string): boolean {
  return hhmm > threshold;
}
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/* ---------------- geo ---------------- */
export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export function locateWithFallback(
  site: { lat: number; lng: number },
  timeoutMs = 3500
): Promise<{ lat: number; lng: number; simulated: boolean }> {
  return new Promise((resolve) => {
    const fallback = () => {
      // Jitter near the gate beacon so the demo flow always completes.
      resolve({ lat: site.lat + rand(-0.0004, 0.0004), lng: site.lng + rand(-0.0004, 0.0004), simulated: true });
    };
    if (!("geolocation" in navigator)) return fallback();
    let done = false;
    const t = window.setTimeout(() => {
      if (!done) {
        done = true;
        fallback();
      }
    }, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!done) {
          done = true;
          clearTimeout(t);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, simulated: false });
        }
      },
      () => {
        if (!done) {
          done = true;
          clearTimeout(t);
          fallback();
        }
      },
      { timeout: timeoutMs - 300, maximumAge: 60000 }
    );
  });
}

/* ---------------- misc ---------------- */
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Indonesian Rupiah formatting */
export function fmtIDR(n: number): string {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} jt`;
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)} rb`;
  return `Rp ${n}`;
}

export function fmtIDRFull(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Deterministic fake-QR matrix from a string seed. */
export function qrMatrix(seed: string, size = 21): boolean[][] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = mulberry32(h >>> 0);
  const m: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(rng() > 0.52);
    m.push(row);
  }
  const finder = (fx: number, fy: number) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        m[fy + y][fx + x] = edge || core;
      }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  return m;
}
