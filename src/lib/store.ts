/**
 * Local-first data layer.
 * Shape mirrors the production Supabase/Postgres schema; every mutation is an
 * immutable swap + persist, so swapping in `supabase-js` later only touches this file.
 */
import { useSyncExternalStore } from "react";
import type {
  Announcement, Attendance, DB, LeaveReq, Noti, OTReq, PointEvent,
  Redemption, Role, ScheduleEntry, Settings, Shift, User,
} from "../types";
import { addDays, dayKey, isAfter, mondayOf, mulberry32, pad2, parseKey, todayKey, uid } from "./util";

const LS_DB = "shiftgate_db_v1";
const LS_SES = "shiftgate_session_v1";
const LS_THEME = "shiftgate_theme";

/* ================= seed ================= */
const DEMO_STAFF: Omit<User, "id" | "joinedAt">[] = [
  { name: "Andi Setiawan", email: "admin@nusalogistik.id", password: "admin123", role: "admin", employeeId: "WMS-001", department: "Operations", hue: 48, faceEnrolled: true, faceHash: "f8c2ab91", active: true, points: 0 },
  { name: "Budi Santoso", email: "budi@nusalogistik.id", password: "staff123", role: "staff", employeeId: "WMS-011", department: "Forklift", hue: 30, faceEnrolled: true, faceHash: "1d77e04c", active: true, points: 0 },
  { name: "Dewi Lestari", email: "dewi@nusalogistik.id", password: "staff123", role: "staff", employeeId: "WMS-007", department: "Inbound", hue: 160, faceEnrolled: true, faceHash: "9a31bb02", active: true, points: 0 },
  { name: "Agus Prasetyo", email: "agus@nusalogistik.id", password: "staff123", role: "staff", employeeId: "WMS-015", department: "Outbound", hue: 210, faceEnrolled: true, faceHash: "c45f7d8e", active: true, points: 0 },
  { name: "Rina Wijaya", email: "rina@nusalogistik.id", password: "staff123", role: "staff", employeeId: "WMS-003", department: "Inventory", hue: 280, faceEnrolled: true, faceHash: "57aa12f6", active: true, points: 0 },
  { name: "Joko Susilo", email: "joko@nusalogistik.id", password: "staff123", role: "staff", employeeId: "WMS-021", department: "Packing", hue: 96, faceEnrolled: true, faceHash: "e309c4d5", active: true, points: 0 },
  { name: "Siti Aminah", email: "siti@nusalogistik.id", password: "staff123", role: "staff", employeeId: "WMS-009", department: "QA", hue: 340, faceEnrolled: true, faceHash: "b81d5e77", active: true, points: 0 },
  { name: "Tono Hartono", email: "tono@nusalogistik.id", password: "staff123", role: "staff", employeeId: "WMS-018", department: "Outbound", hue: 260, faceEnrolled: false, faceHash: "", active: false, points: 0 },
];

const SHIFTS: Shift[] = [
  { id: "s1", name: "Morning", window: "06:00 – 14:00", start: "06:00", end: "14:00", points: 10, tone: "morning" },
  { id: "s2", name: "Afternoon", window: "14:00 – 22:00", start: "14:00", end: "22:00", points: 12, tone: "afternoon" },
  { id: "s3", name: "Night", window: "22:00 – 06:00", start: "22:00", end: "06:00", points: 15, tone: "night" },
];

const ITEMS = [
  { id: "i1", name: "Sembako Pack", cost: 150, stock: 24, cat: "Essentials" as const, icon: "package" },
  { id: "i2", name: "E-Wallet Rp 50k", cost: 120, stock: 40, cat: "Voucher" as const, icon: "wallet" },
  { id: "i3", name: "Safety Gloves", cost: 60, stock: 55, cat: "Gear" as const, icon: "shield" },
  { id: "i4", name: "Steel Tumbler", cost: 90, stock: 18, cat: "Gear" as const, icon: "cup" },
  { id: "i5", name: "1-Day Leave Voucher", cost: 300, stock: 8, cat: "Voucher" as const, icon: "ticket" },
  { id: "i6", name: "Snack Box", cost: 40, stock: 60, cat: "Essentials" as const, icon: "snack" },
];

function buildSeed(superAdmin: User | null, settings: Settings): DB {
  const rng = mulberry32(20240817);
  const now = new Date();
  const users: User[] = DEMO_STAFF.map((s, i) => ({
    ...s,
    id: "u" + (i + 2),
    joinedAt: new Date(now.getFullYear() - 1, 2, 5 + i * 9).toISOString(),
  }));
  if (superAdmin) users.unshift(superAdmin);

  const attendance: Attendance[] = [];
  const schedules: ScheduleEntry[] = [];
  const pointEvents: PointEvent[] = [];
  const staff = users.filter((u) => u.role === "staff" && u.active);

  // ~11 weeks of attendance history (Mon–Sat operation).
  for (let back = 77; back >= 1; back--) {
    const d = addDays(now, -back);
    if (d.getDay() === 0) continue;
    const key = dayKey(d);
    staff.forEach((u, ui) => {
      const r = rng();
      if (r < 0.055) return; // absent day
      const lateBias = ui === 2 ? 0.3 : ui === 4 ? 0.22 : 0.1;
      const late = rng() < lateBias;
      const inMin = late ? 8 * 60 + 4 + Math.floor(rng() * 34) : 7 * 60 + 32 + Math.floor(rng() * 27);
      const outMin = 16 * 60 + Math.floor(rng() * 100);
      const iso = (mins: number) => {
        const c = new Date(d);
        c.setHours(Math.floor(mins / 60), mins % 60, Math.floor(rng() * 60), 0);
        return c.toISOString();
      };
      attendance.push({
        id: uid(), userId: u.id, date: key,
        checkIn: iso(inMin), checkOut: iso(outMin),
        inScore: 88 + Math.floor(rng() * 11), outScore: 87 + Math.floor(rng() * 12),
        distance: 9 + Math.floor(rng() * 82), method: rng() < 0.82 ? "face" : "qr",
        late, earlyOut: outMin < 16 * 60, reviewed: true,
      });
    });
  }

  // Piket roster: 2 past weeks (done) + current/next week, rotating shifts.
  const mon = mondayOf(now);
  for (let w = -2; w <= 1; w++) {
    for (let dow = 0; dow < 6; dow++) {
      const d = addDays(mon, w * 7 + dow);
      const key = dayKey(d);
      const past = key < todayKey();
      staff.forEach((u, ui) => {
        const shift = SHIFTS[(ui + dow + w + 6) % 3];
        const done = past && rng() > 0.08;
        schedules.push({ id: uid(), userId: u.id, date: key, shiftId: shift.id, done, proof: done && rng() > 0.25 });
        if (done) {
          const bonus = rng() < 0.12 ? 3 : 0;
          pointEvents.push({ id: uid(), userId: u.id, delta: shift.points + bonus, date: key, label: `Piket ${shift.name}${bonus ? " · bonus" : ""}` });
          u.points += shift.points + bonus;
        }
      });
    }
  }

  const redemptions: Redemption[] = [
    { id: uid(), userId: "u3", itemId: "i6", cost: 40, date: dayKey(addDays(now, -5)) },
    { id: uid(), userId: "u4", itemId: "i3", cost: 60, date: dayKey(addDays(now, -12)) },
  ];
  redemptions.forEach((r) => {
    pointEvents.push({ id: uid(), userId: r.userId, delta: -r.cost, date: r.date, label: "Redeemed reward" });
    const u = users.find((x) => x.id === r.userId);
    if (u) u.points = Math.max(0, u.points - r.cost);
  });

  const dk = (n: number) => dayKey(addDays(now, n));
  const ot: OTReq[] = [
    { id: uid(), userId: "u3", date: dk(-6), start: "17:00", end: "20:30", reason: "Inbound container backlog — dock 2", photo: true, status: "approved", by: "Andi Setiawan", createdAt: dk(-6) },
    { id: uid(), userId: "u3", date: dk(-2), start: "17:00", end: "19:00", reason: "Cycle count assist zone B", photo: false, status: "approved", by: "Andi Setiawan", createdAt: dk(-2) },
    { id: uid(), userId: "u3", date: dk(-1), start: "17:30", end: "21:00", reason: "Urgent outbound — retail chain order", photo: true, status: "pending", createdAt: dk(-1) },
    { id: uid(), userId: "u5", date: dk(-1), start: "22:00", end: "01:00", reason: "Night inbound — cold storage", photo: false, status: "pending", createdAt: dk(-1) },
    { id: uid(), userId: "u6", date: dk(-4), start: "17:00", end: "18:30", reason: "Label reprint batch 44", photo: false, status: "rejected", note: "Overlaps with scheduled piket", by: "Andi Setiawan", createdAt: dk(-4) },
    { id: uid(), userId: "u7", date: dk(-8), start: "06:00", end: "08:00", reason: "QA sampling — imported SKU", photo: true, status: "approved", by: "Andi Setiawan", createdAt: dk(-8) },
  ];

  const leaves: LeaveReq[] = [
    { id: uid(), userId: "u4", from: dk(-34), to: dk(-32), reason: "Family wedding — Yogyakarta", status: "approved", createdAt: dk(-40) },
    { id: uid(), userId: "u6", from: dk(6), to: dk(7), reason: "Medical check-up", status: "pending", createdAt: dk(-1) },
  ];

  const announcements: Announcement[] = [
    { id: uid(), title: "Cycle count — Zone C", body: "Full cycle count this Saturday 08:00. QA + Inventory report to Zone C gate. Piket points doubled for volunteers.", author: "Andi Setiawan", date: dk(-1), pinned: true },
    { id: uid(), title: "Hi-vis vest policy", body: "Vests mandatory beyond the yellow line from Monday. Non-compliance logged by safety officer.", author: "Andi Setiawan", date: dk(-4), pinned: false },
    { id: uid(), title: "Night shift meal allowance", body: "Rp 25k meal allowance now auto-added for Night piket. Check your points ledger after each duty.", author: "Andi Setiawan", date: dk(-9), pinned: false },
  ];

  const notis: Noti[] = [
    { id: uid(), to: "u3", text: "Your overtime on " + dk(-6) + " was approved (3.5h).", date: dk(-5), readBy: [], kind: "ok" },
    { id: uid(), to: "all", text: "Night roster for next week has been posted.", date: dk(-1), readBy: [], kind: "info" },
    { id: uid(), to: "all", text: "Snack Box stock is running low — 60 left.", date: dk(-2), readBy: [], kind: "warn" },
  ];

  return {
    v: 1, users, shifts: SHIFTS, attendance, schedules, pointEvents, ot, leaves,
    items: ITEMS, redemptions, announcements, notis, settings,
  };
}

/* ================= store core ================= */
let db: DB | null = load();
const listeners = new Set<() => void>();

function load(): DB | null {
  try {
    const raw = localStorage.getItem(LS_DB);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DB;
    return parsed && parsed.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}
function persist() {
  try {
    if (db) localStorage.setItem(LS_DB, JSON.stringify(db));
  } catch { /* storage full — demo continues in memory */ }
}
function emit() {
  persist();
  listeners.forEach((l) => l());
}
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getDB(): DB | null {
  return db;
}
export function useDB(): DB | null {
  return useSyncExternalStore(subscribe, getDB);
}
export function isSetupDone(): boolean {
  return db !== null;
}
function mut(fn: (d: DB) => void) {
  if (!db) return;
  const next: DB = { ...db };
  fn(next);
  db = next;
  emit();
}

/* ================= session ================= */
export function getSessionUser(): User | null {
  if (!db) return null;
  try {
    const raw = localStorage.getItem(LS_SES) || sessionStorage.getItem(LS_SES);
    if (!raw) return null;
    const { userId } = JSON.parse(raw) as { userId: string };
    return db.users.find((u) => u.id === userId) ?? null;
  } catch {
    return null;
  }
}
export function login(email: string, password: string, remember: boolean): { user?: User; error?: string } {
  if (!db) return { error: "Run setup first" };
  const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u) return { error: "No account found for that email" };
  if (u.password !== password) return { error: "Incorrect password" };
  if (!u.active) return { error: "This account has been deactivated" };
  try {
    const store = remember ? localStorage : sessionStorage;
    store.setItem(LS_SES, JSON.stringify({ userId: u.id, remember }));
  } catch { /* ignore */ }
  return { user: u };
}
export function logout() {
  try {
    localStorage.removeItem(LS_SES);
    sessionStorage.removeItem(LS_SES);
  } catch { /* ignore */ }
  emit();
}

/* ================= setup & lifecycle ================= */
export interface SetupPayload {
  appName: string; company: string; logo?: string; hue: number;
  siteName: string; lat: number; lng: number; radius: number;
  adminName: string; adminEmail: string; adminPassword: string;
}
export function completeSetup(p: SetupPayload) {
  const superAdmin: User = {
    id: "u1", name: p.adminName, email: p.adminEmail, password: p.adminPassword,
    role: "superadmin", employeeId: "WMS-000", department: "Management", hue: p.hue,
    faceEnrolled: true, faceHash: "root0000", active: true, joinedAt: new Date().toISOString(), points: 0,
  };
  const settings: Settings = {
    appName: p.appName, company: p.company, logo: p.logo, hue: p.hue,
    siteName: p.siteName, lat: p.lat, lng: p.lng, radius: p.radius,
    lateTime: "08:00", pointsExpiryMonths: 12, theme: "dark",
  };
  db = buildSeed(superAdmin, settings);
  emit();
}
export function resetDemoData() {
  if (!db) return;
  const fresh = buildSeed(null, db.settings);
  fresh.users = [
    ...db.users.filter((u) => u.role === "superadmin"),
    ...fresh.users,
  ];
  db = fresh;
  emit();
}
export function rerunSetup() {
  try {
    localStorage.removeItem(LS_DB);
  } catch { /* ignore */ }
  db = null;
  emit();
}

/* ================= notifications ================= */
export function notify(to: string, text: string, kind: Noti["kind"] = "info") {
  mut((d) => {
    d.notis = [{ id: uid(), to, text, date: todayKey(), readBy: [], kind }, ...d.notis];
  });
}
export function unreadCount(userId: string): number {
  if (!db) return 0;
  return db.notis.filter((n) => (n.to === userId || n.to === "all") && !n.readBy.includes(userId)).length;
}
export function markNotisRead(userId: string) {
  mut((d) => {
    d.notis = d.notis.map((n) =>
      (n.to === userId || n.to === "all") && !n.readBy.includes(userId)
        ? { ...n, readBy: [...n.readBy, userId] }
        : n
    );
  });
}

/* ================= attendance ================= */
export function todayRecord(userId: string): Attendance | undefined {
  return db?.attendance.find((a) => a.userId === userId && a.date === todayKey());
}
export function punch(
  userId: string,
  kind: "in" | "out",
  p: { score?: number; distance: number; method: Attendance["method"] }
): Attendance | null {
  if (!db) return null;
  const date = todayKey();
  const nowIso = new Date().toISOString();
  let rec: Attendance | null = null;
  mut((d) => {
    const existing = d.attendance.find((a) => a.userId === userId && a.date === date);
    if (kind === "in") {
      if (existing?.checkIn) { rec = existing; return; }
      const late = isAfter(new Date().toTimeString().slice(0, 5), d.settings.lateTime);
      const entry: Attendance = existing
        ? { ...existing, checkIn: nowIso, inScore: p.score, distance: p.distance, method: p.method, late, selfReport: false }
        : { id: uid(), userId, date, checkIn: nowIso, inScore: p.score, distance: p.distance, method: p.method, late, earlyOut: false };
      rec = entry;
      d.attendance = existing
        ? d.attendance.map((a) => (a.id === existing.id ? entry : a))
        : [...d.attendance, entry];
    } else {
      if (!existing?.checkIn) return;
      const earlyOut = isAfter("16:00", new Date().toTimeString().slice(0, 5));
      const entry = { ...existing, checkOut: nowIso, outScore: p.score, earlyOut };
      rec = entry;
      d.attendance = d.attendance.map((a) => (a.id === existing.id ? entry : a));
    }
  });
  return rec;
}
export function selfReport(userId: string): Attendance | null {
  if (!db) return null;
  const date = todayKey();
  const nowIso = new Date().toISOString();
  let rec: Attendance | null = null;
  mut((d) => {
    const existing = d.attendance.find((a) => a.userId === userId && a.date === date);
    const late = isAfter(new Date().toTimeString().slice(0, 5), d.settings.lateTime);
    const entry: Attendance = existing
      ? { ...existing, checkIn: nowIso, method: "manual", selfReport: true, late }
      : { id: uid(), userId, date, checkIn: nowIso, method: "manual", selfReport: true, late, earlyOut: false, distance: 0 };
    rec = entry;
    d.attendance = existing ? d.attendance.map((a) => (a.id === existing.id ? entry : a)) : [...d.attendance, entry];
  });
  mut((d) => {
    d.users.filter((u) => u.role !== "staff").forEach((adm) => {
      d.notis = [{ id: uid(), to: adm.id, text: `${userName(userId)} self-reported attendance — needs review.`, date, readBy: [], kind: "warn" }, ...d.notis];
    });
  });
  return rec;
}
export function reviewSelfReport(attId: string, approve: boolean) {
  mut((d) => {
    const rec = d.attendance.find((a) => a.id === attId);
    if (!rec) return;
    if (approve) {
      d.attendance = d.attendance.map((a) => (a.id === attId ? { ...a, selfReport: false, reviewed: true } : a));
      d.notis = [{ id: uid(), to: rec.userId, text: `Self-reported attendance on ${rec.date} was approved.`, date: todayKey(), readBy: [], kind: "ok" }, ...d.notis];
    } else {
      d.attendance = d.attendance.filter((a) => a.id !== attId);
      d.notis = [{ id: uid(), to: rec.userId, text: `Self-reported attendance on ${rec.date} was rejected.`, date: todayKey(), readBy: [], kind: "warn" }, ...d.notis];
    }
  });
}
export function manualLog(userId: string, date: string, inT: string, outT?: string) {
  mut((d) => {
    const mk = (t?: string) => {
      if (!t) return undefined;
      const [h, m] = t.split(":").map(Number);
      const c = parseKey(date);
      c.setHours(h, m, 0, 0);
      return c.toISOString();
    };
    const late = isAfter(inT, d.settings.lateTime);
    d.attendance = [...d.attendance, {
      id: uid(), userId, date, checkIn: mk(inT), checkOut: mk(outT),
      distance: 0, method: "manual", reviewed: true, late, earlyOut: false,
    }];
    d.notis = [{ id: uid(), to: userId, text: `Admin logged manual attendance for ${date}.`, date: todayKey(), readBy: [], kind: "info" }, ...d.notis];
  });
}

/* ================= roster & points ================= */
export function assignShift(userId: string, date: string, shiftId: string) {
  mut((d) => {
    const existing = d.schedules.find((s) => s.userId === userId && s.date === date);
    if (existing) d.schedules = d.schedules.map((s) => (s.id === existing.id ? { ...s, shiftId } : s));
    else d.schedules = [...d.schedules, { id: uid(), userId, date, shiftId, done: false, proof: false }];
    d.notis = [{ id: uid(), to: userId, text: `Piket assigned: ${shiftName(d, shiftId)} on ${date}.`, date: todayKey(), readBy: [], kind: "info" }, ...d.notis];
  });
}
export function removeSchedule(id: string) {
  mut((d) => { d.schedules = d.schedules.filter((s) => s.id !== id); });
}
export function autofillWeek(monday: Date) {
  mut((d) => {
    const staff = d.users.filter((u) => u.role === "staff" && u.active);
    const keys: string[] = [];
    for (let i = 0; i < 6; i++) keys.push(dayKey(addDays(monday, i)));
    const next = d.schedules.filter((s) => !keys.includes(s.date));
    keys.forEach((key, dow) => {
      staff.forEach((u, ui) => {
        next.push({ id: uid(), userId: u.id, date: key, shiftId: d.shifts[(ui + dow) % d.shifts.length].id, done: false, proof: false });
      });
    });
    d.schedules = next;
  });
}
export function markDutyDone(schedId: string) {
  mut((d) => {
    const s = d.schedules.find((x) => x.id === schedId);
    if (!s || s.done) return;
    const shift = d.shifts.find((x) => x.id === s.shiftId)!;
    d.schedules = d.schedules.map((x) => (x.id === schedId ? { ...x, done: true, proof: true } : x));
    d.pointEvents = [{ id: uid(), userId: s.userId, delta: shift.points, date: s.date, label: `Piket ${shift.name}` }, ...d.pointEvents];
    d.users = d.users.map((u) => (u.id === s.userId ? { ...u, points: u.points + shift.points } : u));
    d.notis = [{ id: uid(), to: s.userId, text: `Duty proof accepted — +${shift.points} pts (${shift.name} piket).`, date: todayKey(), readBy: [], kind: "ok" }, ...d.notis];
  });
}
export function grantBonus(userId: string, delta: number, label: string) {
  mut((d) => {
    d.pointEvents = [{ id: uid(), userId, delta, date: todayKey(), label }, ...d.pointEvents];
    d.users = d.users.map((u) => (u.id === userId ? { ...u, points: Math.max(0, u.points + delta) } : u));
  });
}

/* ================= overtime & leave ================= */
export function submitOT(p: { userId: string; date: string; start: string; end: string; reason: string; photo: boolean }) {
  mut((d) => {
    d.ot = [{ id: uid(), ...p, status: "pending", createdAt: todayKey() }, ...d.ot];
    d.users.filter((u) => u.role !== "staff").forEach((adm) => {
      d.notis = [{ id: uid(), to: adm.id, text: `New overtime request from ${userName(p.userId)} (${p.date}).`, date: todayKey(), readBy: [], kind: "info" }, ...d.notis];
    });
  });
}
export function cancelOT(id: string) {
  mut((d) => { d.ot = d.ot.filter((o) => o.id !== id); });
}
export function decideOT(id: string, approve: boolean, note: string, byName: string) {
  mut((d) => {
    const r = d.ot.find((o) => o.id === id);
    if (!r) return;
    d.ot = d.ot.map((o) => (o.id === id ? { ...o, status: approve ? "approved" : "rejected", note: note || undefined, by: byName } : o));
    d.notis = [{ id: uid(), to: r.userId, text: `Overtime on ${r.date} ${approve ? "approved" : "rejected"}${note ? ` — “${note}”` : ""}.`, date: todayKey(), readBy: [], kind: approve ? "ok" : "warn" }, ...d.notis];
  });
}
export function requestLeave(p: { userId: string; from: string; to: string; reason: string }) {
  mut((d) => {
    d.leaves = [{ id: uid(), ...p, status: "pending", createdAt: todayKey() }, ...d.leaves];
    d.users.filter((u) => u.role !== "staff").forEach((adm) => {
      d.notis = [{ id: uid(), to: adm.id, text: `${userName(p.userId)} requested leave ${p.from} → ${p.to}.`, date: todayKey(), readBy: [], kind: "info" }, ...d.notis];
    });
  });
}
export function decideLeave(id: string, approve: boolean) {
  mut((d) => {
    const r = d.leaves.find((l) => l.id === id);
    if (!r) return;
    d.leaves = d.leaves.map((l) => (l.id === id ? { ...l, status: approve ? "approved" : "rejected" } : l));
    d.notis = [{ id: uid(), to: r.userId, text: `Leave ${r.from} → ${r.to} ${approve ? "approved" : "rejected"}.`, date: todayKey(), readBy: [], kind: approve ? "ok" : "warn" }, ...d.notis];
  });
}

/* ================= redeem ================= */
export function redeem(userId: string, itemId: string): { ok: boolean; msg: string } {
  if (!db) return { ok: false, msg: "No data" };
  const item = db.items.find((i) => i.id === itemId);
  const user = db.users.find((u) => u.id === userId);
  if (!item || !user) return { ok: false, msg: "Item not found" };
  if (item.stock <= 0) return { ok: false, msg: "Out of stock" };
  if (user.points < item.cost) return { ok: false, msg: `Need ${item.cost - user.points} more pts` };
  mut((d) => {
    d.items = d.items.map((i) => (i.id === itemId ? { ...i, stock: i.stock - 1 } : i));
    d.redemptions = [{ id: uid(), userId, itemId, cost: item.cost, date: todayKey() }, ...d.redemptions];
    d.pointEvents = [{ id: uid(), userId, delta: -item.cost, date: todayKey(), label: `Redeemed: ${item.name}` }, ...d.pointEvents];
    d.users = d.users.map((u) => (u.id === userId ? { ...u, points: u.points - item.cost } : u));
  });
  return { ok: true, msg: `${item.name} redeemed` };
}
export function addItem(p: { name: string; cost: number; stock: number; cat: "Essentials" | "Voucher" | "Gear" }) {
  mut((d) => {
    d.items = [...d.items, { id: uid(), name: p.name, cost: p.cost, stock: p.stock, cat: p.cat, icon: "package" }];
  });
}

/* ================= announcements & staff ================= */
export function addAnnouncement(p: { title: string; body: string; author: string; pinned: boolean }) {
  mut((d) => {
    d.announcements = [{ id: uid(), date: todayKey(), ...p }, ...d.announcements];
    d.notis = [{ id: uid(), to: "all", text: `Announcement: ${p.title}`, date: todayKey(), readBy: [], kind: "info" }, ...d.notis];
  });
}
export function deleteAnnouncement(id: string) {
  mut((d) => { d.announcements = d.announcements.filter((a) => a.id !== id); });
}
export function addStaff(p: { name: string; email: string; employeeId: string; role: Role; department: string; password: string }): { ok: boolean; msg: string } {
  if (!db) return { ok: false, msg: "No data" };
  if (db.users.some((u) => u.email.toLowerCase() === p.email.toLowerCase())) return { ok: false, msg: "Email already registered" };
  mut((d) => {
    d.users = [...d.users, {
      id: uid(), name: p.name, email: p.email, password: p.password, role: p.role,
      employeeId: p.employeeId, department: p.department, hue: Math.floor(Math.random() * 360),
      faceEnrolled: false, faceHash: "", active: true, joinedAt: new Date().toISOString(), points: 0,
    }];
  });
  return { ok: true, msg: `${p.name} added — temp password: ${p.password}` };
}
export function toggleActive(id: string) {
  mut((d) => { d.users = d.users.map((u) => (u.id === id ? { ...u, active: !u.active } : u)); });
}
export function enrollFace(id: string) {
  mut((d) => {
    d.users = d.users.map((u) => (u.id === id ? { ...u, faceEnrolled: true, faceHash: uid().slice(0, 8) } : u));
  });
}
export function updateSettings(patch: Partial<Settings>) {
  mut((d) => { d.settings = { ...d.settings, ...patch }; });
  if (patch.theme) {
    try {
      localStorage.setItem(LS_THEME, patch.theme);
      document.documentElement.setAttribute("data-theme", patch.theme);
    } catch { /* ignore */ }
  }
}
export function updateShiftPoints(shiftId: string, points: number) {
  mut((d) => { d.shifts = d.shifts.map((s) => (s.id === shiftId ? { ...s, points } : s)); });
}

/* ================= selectors ================= */
export function userName(id: string): string {
  return db?.users.find((u) => u.id === id)?.name ?? "Staff";
}
export function shiftName(d: DB, id: string): string {
  return d.shifts.find((s) => s.id === id)?.name ?? "—";
}
export function notisFor(userId: string): Noti[] {
  if (!db) return [];
  return db.notis.filter((n) => n.to === userId || n.to === "all");
}

export type DayStatus = "off" | "future" | "absent" | "late" | "early" | "present";

export interface Stats {
  monthPct: number; lateMonth: number; earlyMonth: number; otHoursMonth: number;
  otPending: number; leaveUsedYear: number; streak: number; avgIn: string;
  ytd: { label: string; value: number; current: boolean }[];
  heat: { key: string; status: DayStatus; in?: string; out?: string; hours: number }[];
  weeks: number[]; workHoursMonth: number;
}

export function statsFor(userId: string): Stats | null {
  if (!db) return null;
  const me = db.users.find((u) => u.id === userId);
  const att = db.attendance.filter((a) => a.userId === userId);
  const now = new Date();
  const mk = monthKeyLocal(now);
  const byDate = new Map(att.map((a) => [a.date, a]));

  const workDaysOfMonth = (ym: string, uptoToday: boolean) => {
    const [y, m] = ym.split("-").map(Number);
    const days = new Date(y, m, 0).getDate();
    const out: string[] = [];
    for (let d = 1; d <= days; d++) {
      const dt = new Date(y, m - 1, d);
      if (dt.getDay() === 0) continue;
      const k = dayKey(dt);
      if (uptoToday && k > todayKey()) continue;
      out.push(k);
    }
    return out;
  };

  const pctFor = (keys: string[]) => {
    if (!keys.length) return 0;
    const present = keys.filter((k) => byDate.get(k)?.checkIn).length;
    return Math.round((present / keys.length) * 100);
  };

  const monthDays = workDaysOfMonth(mk, true);
  const monthRecs = monthDays.map((k) => byDate.get(k)).filter(Boolean) as Attendance[];
  const lateMonth = monthRecs.filter((r) => r.late).length;
  const earlyMonth = monthRecs.filter((r) => r.earlyOut).length;
  const workHoursMonth = Math.round(
    monthRecs.reduce((s, r) => (r.checkIn && r.checkOut ? s + (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 36e5 : s), 0)
  );

  const otMonth = db.ot.filter((o) => o.userId === userId && o.status === "approved" && o.date.startsWith(mk));
  const otHoursMonth = Math.round(otMonth.reduce((s, o) => s + otHours(o.start, o.end), 0) * 10) / 10;
  const otPending = db.ot.filter((o) => o.userId === userId && o.status === "pending").length;

  const leaveUsedYear = db.leaves
    .filter((l) => l.userId === userId && l.status === "approved" && l.from.startsWith(String(now.getFullYear())))
    .reduce((s, l) => s + Math.max(1, Math.round((parseKey(l.to).getTime() - parseKey(l.from).getTime()) / 864e5) + 1), 0);

  // on-time streak over workdays walking back from today
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const k = dayKey(addDays(now, -i));
    const d = parseKey(k);
    if (d.getDay() === 0) continue;
    if (k > todayKey()) continue;
    const r = byDate.get(k);
    if (!r) break;
    if (r.late) break;
    streak++;
  }

  const ins = monthRecs.filter((r) => r.checkIn).map((r) => new Date(r.checkIn!));
  const avgMin = ins.length ? Math.round(ins.reduce((s, d) => s + d.getHours() * 60 + d.getMinutes(), 0) / ins.length) : 0;
  const avgIn = ins.length ? `${pad2(Math.floor(avgMin / 60))}:${pad2(avgMin % 60)}` : "—";

  // YTD bars
  const ytd: Stats["ytd"] = [];
  for (let m = 0; m <= now.getMonth(); m++) {
    const ym = `${now.getFullYear()}-${pad2(m + 1)}`;
    ytd.push({
      label: new Date(now.getFullYear(), m, 1).toLocaleDateString("en", { month: "narrow" }),
      value: pctFor(workDaysOfMonth(ym, true)),
      current: m === now.getMonth(),
    });
  }

  // heatmap for current month
  const [hy, hm] = mk.split("-").map(Number);
  const daysInMonth = new Date(hy, hm, 0).getDate();
  const heat: Stats["heat"] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(hy, hm - 1, d);
    const k = dayKey(dt);
    const r = byDate.get(k);
    let status: DayStatus = "future";
    if (dt.getDay() === 0) status = "off";
    else if (k < todayKey()) {
      if (!r?.checkIn) status = "absent";
      else if (r.late) status = "late";
      else if (r.earlyOut) status = "early";
      else status = "present";
    } else if (k === todayKey()) {
      status = r?.checkIn ? (r.late ? "late" : "present") : "absent";
    }
    const hours = r?.checkIn && r.checkOut ? Math.round(((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 36e5) * 10) / 10 : r?.checkIn ? 0 : 0;
    heat.push({ key: k, status, in: r?.checkIn, out: r?.checkOut, hours });
  }

  // last 8 weeks trend
  const weeks: number[] = [];
  const mon = mondayOf(now);
  for (let w = 7; w >= 0; w--) {
    const keys: string[] = [];
    for (let i = 0; i < 6; i++) {
      const k = dayKey(addDays(mon, -w * 7 + i));
      if (k <= todayKey()) keys.push(k);
    }
    weeks.push(pctFor(keys));
  }

  return {
    monthPct: pctFor(monthDays), lateMonth, earlyMonth, otHoursMonth, otPending,
    leaveUsedYear, streak, avgIn, ytd, heat, weeks, workHoursMonth,
  };
}

export function leaderboard(): { user: User; pct: number }[] {
  if (!db) return [];
  const now = new Date();
  const mk = monthKeyLocal(now);
  return db.users
    .filter((u) => u.role === "staff" && u.active)
    .map((user) => {
      const keys: string[] = [];
      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const dt = new Date(now.getFullYear(), now.getMonth(), d);
        if (dt.getDay() === 0) continue;
        const k = dayKey(dt);
        if (k <= todayKey()) keys.push(k);
      }
      const recs = db!.attendance.filter((a) => a.userId === user.id && a.date.startsWith(mk) && a.checkIn);
      const pct = keys.length ? Math.round((recs.length / keys.length) * 100) : 0;
      return { user, pct };
    })
    .sort((a, b) => b.pct - a.pct || b.user.points - a.user.points);
}

/* local helpers */
function monthKeyLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function otHours(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}
export type { ScheduleEntry };
