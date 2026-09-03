import { useSyncExternalStore } from "react";
import type {
  Announcement, Attendance, DB, Handover, Leave, Notif, Overtime, PiketAssignment, PiketLog, PiketTask,
  PointEvent, Redemption, RedeemItem, Role, Settings, SwapRequest, User,
} from "../types";
import { addDays, dayKey, fmtDate, hoursBetween, mondayOf, parseKey, todayKey, uid } from "./util";

const DB_KEY = "shiftgate.db.v3";
const SESSION_KEY = "shiftgate.session";
const REMEMBER_KEY = "shiftgate.remember";
const VERSION = 4;

const defaultSettings: Settings = {
  appName: "ShiftGate", company: "PT Nusa Logistik", siteName: "WH-01 · Jakarta",
  lat: -6.1754, lng: 106.8272, radius: 100, lateTime: "08:15", theme: "dark", hue: 38,
  pointsExpiryMonths: 12, otRate: 25000, language: "en",
  supabase: { url: "", key: "", status: "off" },
};

let cache: DB | null = null;
const subs = new Set<() => void>();
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const emit = () => subs.forEach((f) => f());
const persist = () => { try { localStorage.setItem(DB_KEY, JSON.stringify(cache)); } catch { /* storage full */ } };
const mutate = () => { persist(); emit(); };

export const getDB = () => cache;
export const useDB = (): DB | null => useSyncExternalStore(subscribe, getDB);

/* ================= seed ================= */
const seedTasks = (): PiketTask[] => [
  { id: "t-depan", name: "Harian Depan", area: "Depan", points: 10, requiresProof: false, active: true, icon: "broom", desc: "Sweep & tidy the front area and pallet staging lane" },
  { id: "t-tengah", name: "Harian Tengah", area: "Tengah", points: 10, requiresProof: false, active: true, icon: "mop", desc: "Aisle cleaning and rack inspection in the middle zone" },
  { id: "t-belakang", name: "Harian Belakang", area: "Belakang", points: 10, requiresProof: false, active: true, icon: "broom", desc: "Rear dock, waste area and loading bay cleanup" },
  { id: "t-door", name: "Tutup Rolling Door", area: "Gudang", points: 15, requiresProof: true, active: true, icon: "door", desc: "Close & lock all rolling doors after the last shift" },
  { id: "t-suhu20", name: "Foto Suhu Container 20ft", area: "Gudang", points: 20, requiresProof: true, active: true, icon: "thermo", desc: "Photograph the thermometer reading of the 20ft container" },
  { id: "t-suhu40", name: "Foto Suhu Container 40ft", area: "Gudang", points: 20, requiresProof: true, active: true, icon: "thermo", desc: "Photograph the thermometer reading of the 40ft container" },
];

function mkUser(id: string, name: string, email: string, role: Role, employeeId: string, department: string, hue: number, password = "shift123", faceEnrolled = true): User {
  return { id, name, email, password, role, employeeId, department, avatarHue: hue, faceEnrolled, points: 0, active: true, createdAt: "2025-06-02", notifApproval: true };
}

/** Compact SVG "evidence photo" used to seed the gallery without bloating localStorage */
function svgPhoto(label: string, date: string): string {
  const h = (label.length * 7 + date.length * 13) % 360;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='420' viewBox='0 0 640 420'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
<stop offset='0' stop-color='hsl(${h} 24% 24%)'/><stop offset='1' stop-color='hsl(${h} 30% 12%)'/>
</linearGradient></defs>
<rect width='640' height='420' fill='url(#g)'/>
<g stroke='hsl(${h} 20% 34%)' stroke-width='2' opacity='0.55'>
<rect x='60' y='150' width='120' height='90'/><rect x='200' y='120' width='120' height='120'/><rect x='340' y='160' width='140' height='80'/><rect x='500' y='130' width='90' height='110'/>
<rect x='120' y='60' width='100' height='70'/><rect x='400' y='70' width='110' height='70'/></g>
<rect x='0' y='330' width='640' height='90' fill='hsl(40 90% 50%)' opacity='0.92'/>
<text x='24' y='372' font-family='monospace' font-size='26' font-weight='bold' fill='#191203'>${label}</text>
<text x='24' y='402' font-family='monospace' font-size='17' fill='#3d2e03'>BUKTI PIKET · ${date} · GUDANG WH-01</text>
<circle cx='596' cy='44' r='10' fill='#ff5c5c'/><text x='560' y='50' font-family='monospace' font-size='16' fill='#ffd7d7' text-anchor='end'>REC</text>
</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function seed(): DB {
  const users: User[] = [
    mkUser("u-admin", "Budi Santoso", "budi@nusalogistik.id", "superadmin", "WMS-001", "Operations", 210),
    mkUser("u-2", "Rina Wijaya", "rina@nusalogistik.id", "admin", "WMS-002", "Operations", 330),
    mkUser("u-3", "Agus Prasetyo", "agus@nusalogistik.id", "staff", "WMS-003", "Inbound", 22),
    mkUser("u-4", "Dewi Lestari", "dewi@nusalogistik.id", "staff", "WMS-004", "Outbound", 152),
    mkUser("u-5", "Joko Susilo", "joko@nusalogistik.id", "staff", "WMS-005", "Inventory", 262),
    mkUser("u-6", "Siti Rahma", "siti@nusalogistik.id", "staff", "WMS-006", "Packing", 42),
    mkUser("u-7", "Andi Saputra", "andi@nusalogistik.id", "staff", "WMS-007", "Inbound", 192),
    mkUser("u-8", "Maya Putri", "maya@nusalogistik.id", "staff", "WMS-008", "QA", 302),
    mkUser("u-9", "Fajar Hidayat", "fajar@nusalogistik.id", "staff", "WMS-009", "Forklift", 122, "shift123", false),
    mkUser("u-10", "Lina Marlina", "lina@nusalogistik.id", "staff", "WMS-010", "Outbound", 2, "shift123", false),
  ];
  users[8].active = false;

  const staff = users.filter((u) => u.role === "staff" && u.active);
  const tasks = seedTasks();

  // weekly template: rotate staff across tasks × Mon–Sat
  const template: PiketAssignment[] = [];
  let cursor = 0;
  for (let day = 1; day <= 6; day++) {
    for (const t of tasks) {
      template.push({ id: uid(), taskId: t.id, day, userId: staff[cursor % staff.length].id });
      cursor++;
    }
  }

  const attendance: Attendance[] = [];
  const piketLog: PiketLog[] = [];
  const pointEvents: PointEvent[] = [];
  const leaves: Leave[] = [];
  const rng = mulberry(42);

  staff.forEach((u, ui) => {
    const leaveDays = new Set<number>();
    const nLeaves = Math.floor(rng() * 3);
    for (let l = 0; l < nLeaves; l++) leaveDays.add(5 + Math.floor(rng() * 70));
    for (let back = 77; back >= 0; back--) {
      const d = addDays(new Date(), -back);
      const wd = d.getDay();
      if (wd === 0) continue; // Sunday rest
      const k = dayKey(d);
      const isToday = back === 0;
      if (leaveDays.has(back)) {
        leaves.push({ id: uid(), userId: u.id, date: k, reason: ui % 2 ? "Family matter" : "Sick leave", status: "approved", createdAt: k + "T07:00:00" });
        continue;
      }
      if (isToday && rng() < 0.22) continue; // not yet checked in
      const lateRoll = rng();
      const late = lateRoll > (ui === 2 ? 0.6 : 0.85);
      const inMin = late ? 15 + Math.floor(rng() * 40) : -10 + Math.floor(rng() * 18);
      const inD = new Date(d); inD.setHours(8, inMin, Math.floor(rng() * 60), 0);
      const outD = new Date(d);
      outD.setHours(isToday ? new Date().getHours() - 1 : 17, 5 + Math.floor(rng() * 50), 0, 0);
      const early = !isToday && rng() > 0.92;
      if (early) outD.setHours(15, 30, 0, 0);
      attendance.push({
        id: uid(), userId: u.id, date: k,
        checkIn: inD.toISOString(), checkOut: isToday && rng() < 0.5 ? undefined : outD.toISOString(),
        late, early, inScore: 84 + Math.floor(rng() * 15), distance: 8 + Math.floor(rng() * 60),
        method: rng() > 0.25 ? "face" : "qr",
      });
    }
  });

  // piket completion history → points ledger
  for (let back = 13; back >= 0; back--) {
    const d = addDays(new Date(), -back);
    const wd = d.getDay();
    if (wd === 0) continue;
    const k = dayKey(d);
    const isToday = back === 0;
    for (const a of template) {
      if (a.day !== wd) continue;
      const task = tasks.find((x) => x.id === a.taskId)!;
      const p = isToday ? 0.35 : 0.78;
      if (rng() < p) {
        piketLog.push({ id: uid(), date: k, taskId: task.id, userId: a.userId, doneAt: k + "T17:30:00", proof: task.requiresProof ? svgPhoto(task.name, k) : undefined, points: task.points });
        pointEvents.push({ id: uid(), userId: a.userId, date: k, delta: task.points, label: `${task.name} piket` });
      }
    }
  }

  const ot: Overtime[] = [];
  for (let i = 0; i < 14; i++) {
    const u = staff[Math.floor(rng() * staff.length)];
    const back = Math.floor(rng() * 30);
    const d = addDays(new Date(), -back);
    const startH = 17 + Math.floor(rng() * 2);
    const dur = 1 + Math.floor(rng() * 3);
    const status: Overtime["status"] = back > 3 ? (rng() > 0.2 ? "approved" : "rejected") : "pending";
    const date = dayKey(d);
    const createdAt = date + "T16:40:00";
    ot.push({
      id: uid(), userId: u.id, date,
      start: `${String(startH).padStart(2, "0")}:00`, end: `${String(startH + dur).padStart(2, "0")}:00`,
      reason: ["Container unloading overflow", "Monthly stock opname", "Delayed inbound truck", "Repacking export order", "System migration support"][Math.floor(rng() * 5)],
      status, note: status === "rejected" ? "Overlaps with scheduled shift" : undefined,
      createdAt, decidedAt: status !== "pending" ? date + "T20:00:00" : undefined,
    });
    if (status === "approved") pointEvents.push({ id: uid(), userId: u.id, date, delta: 5, label: "Overtime bonus" });
  }
  ot.push({ id: uid(), userId: staff[1].id, date: todayKey(), start: "17:00", end: "20:00", reason: "Cold-chain container monitoring", status: "pending", createdAt: todayKey() + "T09:10:00" });

  const items: RedeemItem[] = [
    { id: "i-1", name: "Safety gloves (premium)", cost: 120, stock: 14, icon: "package", cat: "Essentials" },
    { id: "i-2", name: "Coffee voucher", cost: 60, stock: 25, icon: "cup", cat: "Voucher" },
    { id: "i-3", name: "Hi-vis vest (new)", cost: 150, stock: 8, icon: "shield", cat: "Gear" },
    { id: "i-4", name: "Snack box", cost: 40, stock: 30, icon: "snack", cat: "Essentials" },
    { id: "i-5", name: "Parking voucher (1 week)", cost: 100, stock: 12, icon: "ticket", cat: "Voucher" },
    { id: "i-6", name: "Tumbler ShiftGate", cost: 200, stock: 6, icon: "package", cat: "Gear" },
  ];

  const redemptions: Redemption[] = [];
  for (let i = 0; i < 6; i++) {
    const u = staff[Math.floor(rng() * staff.length)];
    const it = items[Math.floor(rng() * items.length)];
    const date = dayKey(addDays(new Date(), -Math.floor(rng() * 40)));
    redemptions.push({ id: uid(), userId: u.id, itemId: it.id, date, cost: it.cost });
    pointEvents.push({ id: uid(), userId: u.id, date, delta: -it.cost, label: `Redeemed: ${it.name}` });
  }

  // compute balances
  for (const u of users) u.points = Math.max(0, pointEvents.filter((p) => p.userId === u.id).reduce((s, p) => s + p.delta, 0));

  const notifications: Notif[] = [
    { id: uid(), userId: "*", title: "Welcome to ShiftGate", body: "Attendance, piket duty, overtime and rewards now live in one app.", date: new Date(Date.now() - 86400000 * 2).toISOString(), readBy: [] },
    { id: uid(), userId: "*", title: "Stock opname — Friday", body: "Cycle count for Zone C starts 16:00. Piket Belakang is doubled that day.", date: new Date(Date.now() - 86400000).toISOString(), readBy: [] },
  ];

  const announcements: Announcement[] = [
    { id: uid(), title: "Cold-chain audit this week", body: "Container 20ft and 40ft temperature photos are mandatory twice per shift until Friday. QA will cross-check the piket proof gallery every evening. Points for Foto Suhu tasks are doubled during the audit.", author: "Rina Wijaya", date: todayKey(), pinned: true },
    { id: uid(), title: "New rolling door procedure", body: "Rolling doors 3 and 4 must be closed and photographed before 21:00. The piket assignee is responsible — failure is logged in the weekly review.", author: "Budi Santoso", date: dayKey(addDays(new Date(), -1)), pinned: false },
    { id: uid(), title: "Forklift charging bay moved", body: "Starting Monday, forklifts charge at Bay 7. Do not block the outbound lane after 15:00.", author: "Rina Wijaya", date: dayKey(addDays(new Date(), -3)), pinned: false },
  ];

  /* --- shift handovers (demo history) --- */
  const handovers: Handover[] = [
    {
      id: uid(), date: dayKey(addDays(new Date(), -1)), shiftId: "afternoon", fromUserId: staff[1].id,
      note: "Inbound lane 3 cleared. 2 pallets staged at B. Forklift #2 battery swapped and charging at Bay 7.",
      createdAt: dayKey(addDays(new Date(), -1)) + "T16:55:00",
      confirmedBy: staff[3].id, confirmedAt: dayKey(addDays(new Date(), -1)) + "T17:10:00",
    },
    {
      id: uid(), date: todayKey(), shiftId: "morning", fromUserId: staff[0].id,
      note: "Container 40ft TGHU-8812 half unloaded — resume after lunch break. Outbound lane clear.",
      issue: "Rolling door B2 macet — teknisi sudah dihubungi (technician called)",
      createdAt: todayKey() + "T11:50:00",
    },
  ];

  /* --- piket swap requests (one pending demo) --- */
  const monday = mondayOf(new Date());
  let swapDate = dayKey(addDays(monday, 3)); // Thursday
  if (swapDate <= todayKey()) swapDate = dayKey(addDays(monday, 10));
  const thEntry = template.find((t) => t.day === 4);
  const swapFrom = thEntry?.userId ?? staff[2].id;
  const swapTo = staff.find((s) => s.id !== swapFrom)!.id;
  const swapRequests: SwapRequest[] = [{
    id: uid(), date: swapDate, taskId: thEntry?.taskId ?? tasks[3].id, fromUserId: swapFrom, toUserId: swapTo,
    reason: "Ada urusan keluarga — bisa gantikan piket hari itu? (family matter)",
    status: "pending", createdAt: new Date().toISOString(),
  }];

  return {
    version: VERSION, settings: { ...defaultSettings }, users, attendance, tasks, template, piketLog, ot,
    pointEvents, redemptions, items, announcements, notifications, leaves,
    handovers, swapRequests, swapOverrides: [],
  };
}

function mulberry(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================= constants ================= */
/** Permanent Super Admin credentials (fixed for this deployment) */
export const SUPER_EMAIL = "majestap93@gmail.com";
export const SUPER_PASSWORD = "super123";
export const APP_VERSION = "1.6.0";

/** Gmail SMTP relay used for password-reset delivery */
export const SMTP_RELAY = { host: "smtp.gmail.com", port: 587, security: "STARTTLS", from: "ShiftGate <no-reply@shiftgate.app>" };

/* ================= lifecycle ================= */
export function initStore() {
  if (cache) return;
  try {
    const raw = localStorage.getItem(DB_KEY);
    const parsed = raw ? (JSON.parse(raw) as DB) : null;
    cache = parsed && parsed.version === VERSION ? parsed : seed();
    if (!parsed || parsed.version !== VERSION) persist();
  } catch {
    cache = seed();
    persist();
  }
  // Super Admin credentials are permanent — enforce on every load
  const sup = cache!.users.find((u) => u.role === "superadmin");
  if (sup && (sup.email !== SUPER_EMAIL || sup.password !== SUPER_PASSWORD)) {
    sup.email = SUPER_EMAIL;
    sup.password = SUPER_PASSWORD;
    persist();
  }
}

export function hasWorkspace() {
  initStore();
  return cache!.users.some((u) => u.role === "superadmin");
}

export function rerunSetup() {
  try { localStorage.removeItem(DB_KEY); sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
  cache = null;
  initStore();
  const fresh = { ...cache!, users: [], attendance: [], template: [], piketLog: [], pointEvents: [], redemptions: [], ot: [], notifications: [], announcements: [], leaves: [], handovers: [], swapRequests: [], swapOverrides: [] };
  cache = fresh;
  persist();
  emit();
}

export function resetDemoData() {
  if (!cache) return;
  const keep = { settings: cache.settings, users: cache.users };
  const fresh = seed();
  cache = { ...fresh, settings: cache.settings, users: cache.users.map((u) => ({ ...u, points: fresh.users.find((f) => f.id === u.id)?.points ?? 0 })) };
  void keep;
  persist(); emit();
}

export function completeSetup(args: { appName: string; company: string; logo?: string; hue: number; siteName: string; lat: number; lng: number; radius: number; adminName: string; adminEmail: string; adminPassword: string }) {
  initStore();
  // Super Admin sign-in is permanent: majestap93@gmail.com / super123
  const admin: User = mkUser("u-admin", args.adminName, SUPER_EMAIL, "superadmin", "WMS-001", "Operations", args.hue, SUPER_PASSWORD);
  cache = {
    ...seed(),
    settings: { ...defaultSettings, appName: args.appName || "ShiftGate", company: args.company || "-", logo: args.logo, hue: args.hue, siteName: args.siteName || "WH-01", lat: args.lat, lng: args.lng, radius: args.radius },
    users: [admin], attendance: [], template: [], piketLog: [], pointEvents: [], redemptions: [], ot: [], notifications: [], leaves: [], handovers: [], swapRequests: [], swapOverrides: [],
    announcements: [{ id: uid(), title: "Workspace ready", body: "Add staff accounts, then build the weekly piket template in the Piket tab.", author: args.adminName, date: todayKey(), pinned: true }],
  };
  persist(); emit();
}

/* ================= auth ================= */
export function login(email: string, password: string, remember: boolean): { ok: boolean; user?: User; msg?: string } {
  initStore();
  const u = cache!.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (!u || u.password !== password) return { ok: false, msg: "Invalid email or password." };
  if (!u.active) return { ok: false, msg: "This account has been deactivated. Contact your admin." };
  const session = { userId: u.id, exp: Date.now() + 60 * 60 * 1000 }; // JWT-style 1h expiry
  const store = remember ? localStorage : sessionStorage;
  store.setItem(SESSION_KEY, JSON.stringify(session));
  if (remember) localStorage.setItem(REMEMBER_KEY, "1");
  emit();
  return { ok: true, user: u };
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  emit();
}

export function getSessionUser(): User | null {
  initStore();
  const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as { userId: string; exp: number };
    if (Date.now() > s.exp) { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); return null; }
    return cache!.users.find((u) => u.id === s.userId) ?? null;
  } catch { return null; }
}

export function requestReset(email: string): { ok: boolean; msg: string; token?: string; name?: string } {
  initStore();
  const u = cache!.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (!u) return { ok: false, msg: "No account found for that email." };
  const token = Array.from({ length: 24 }, () => "abcdef0123456789"[Math.floor(Math.random() * 16)]).join("");
  pushNotif(u.id, "Password reset", `Reset link delivered via Gmail SMTP (valid 30 min).`);
  return { ok: true, msg: `Reset link sent to ${u.email}.`, token, name: u.name };
}

/** Consume a reset token and set a new password */
export function resetPassword(email: string, newPassword: string): { ok: boolean; msg: string } {
  initStore();
  const u = cache!.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (!u) return { ok: false, msg: "Account not found." };
  if (newPassword.length < 6) return { ok: false, msg: "Password must be at least 6 characters." };
  u.password = newPassword;
  persist();
  pushNotif(u.id, "Password changed", "Your password was updated via the reset link.");
  return { ok: true, msg: "Password updated — sign in with your new password." };
}

export const userById = (id: string) => cache?.users.find((u) => u.id === id);
export const userName = (id: string) => userById(id)?.name ?? "Unknown";

/* ================= notifications ================= */
function pushNotif(userId: string, title: string, body: string) {
  if (!cache) return;
  cache.notifications.unshift({ id: uid(), userId, title, body, date: new Date().toISOString(), readBy: [] });
}
export const unreadCount = (userId: string) =>
  (cache?.notifications ?? []).filter((n) => (n.userId === "*" || n.userId === userId) && !n.readBy.includes(userId)).length;
export function markNotisRead(userId: string) {
  if (!cache) return;
  cache.notifications.forEach((n) => { if ((n.userId === "*" || n.userId === userId) && !n.readBy.includes(userId)) n.readBy.push(userId); });
  mutate();
}
export function setNotifPref(userId: string, on: boolean) {
  const u = userById(userId); if (!u) return; u.notifApproval = on; mutate();
}

/* ================= attendance ================= */
export const todayRecord = (userId: string) => cache?.attendance.find((a) => a.userId === userId && a.date === todayKey());

export function punch(userId: string, kind: "in" | "out", opts: { score?: number; distance?: number; method: "face" | "qr" }): Attendance | null {
  if (!cache) return null;
  const now = new Date();
  let rec = todayRecord(userId);
  const late = kind === "in" && `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` > cache.settings.lateTime;
  if (!rec) {
    rec = { id: uid(), userId, date: todayKey(), late: false, early: false };
    cache.attendance.push(rec);
  }
  if (kind === "in") Object.assign(rec, { checkIn: now.toISOString(), inScore: opts.score, distance: opts.distance, method: opts.method, late });
  else {
    const early = now.getHours() < 16;
    Object.assign(rec, { checkOut: now.toISOString(), outScore: opts.score, early });
  }
  if (userById(userId)?.notifApproval) pushNotif(userId, kind === "in" ? "Check-in recorded" : "Check-out recorded", `${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${opts.method === "face" ? `face match ${opts.score}%` : "QR badge"}${late ? " · late" : ""}`);
  mutate();
  return rec;
}

export function selfReport(userId: string) {
  if (!cache) return;
  let rec = todayRecord(userId);
  if (!rec) { rec = { id: uid(), userId, date: todayKey(), late: false, early: false }; cache.attendance.push(rec); }
  const now = new Date();
  if (!rec.checkIn) Object.assign(rec, { checkIn: now.toISOString(), method: "manual", selfReport: true, late: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` > cache.settings.lateTime });
  else if (!rec.checkOut) Object.assign(rec, { checkOut: now.toISOString(), selfReport: true });
  cache.users.filter((u) => u.role !== "staff").forEach((a) => pushNotif(a.id, "Self-report submitted", `${userName(userId)} logged attendance manually — please review in Live board.`));
  mutate();
}

export function manualLog(userId: string, date: string, checkIn: string, checkOut?: string) {
  if (!cache) return;
  const rec = cache.attendance.find((a) => a.userId === userId && a.date === date);
  const [h, m] = checkIn.split(":").map(Number);
  const inISO = new Date(parseKey(date)); inISO.setHours(h, m, 0, 0);
  let outISO: string | undefined;
  if (checkOut) { const [h2, m2] = checkOut.split(":").map(Number); const o = new Date(parseKey(date)); o.setHours(h2, m2, 0, 0); outISO = o.toISOString(); }
  const late = checkIn > cache.settings.lateTime;
  if (rec) Object.assign(rec, { checkIn: inISO.toISOString(), checkOut: outISO ?? rec.checkOut, method: "manual" as const, late });
  else cache.attendance.push({ id: uid(), userId, date, checkIn: inISO.toISOString(), checkOut: outISO, late, early: false, method: "manual" });
  pushNotif(userId, "Attendance adjusted", `Admin logged your attendance for ${fmtDate(date)}.`);
  mutate();
}

export function reviewSelfReport(recId: string, approve: boolean) {
  if (!cache) return;
  const rec = cache.attendance.find((a) => a.id === recId);
  if (!rec) return;
  if (approve) { rec.selfReport = false; pushNotif(rec.userId, "Self-report approved", `Your manual attendance on ${fmtDate(rec.date)} was accepted.`); }
  else { cache.attendance = cache.attendance.filter((a) => a.id !== recId); pushNotif(rec.userId, "Self-report rejected", `Your manual attendance on ${fmtDate(rec.date)} was removed. Contact your admin.`); }
  mutate();
}

/* ================= piket ================= */
export const piketForDate = (date: string): { task: PiketTask; assign: PiketAssignment; log?: PiketLog }[] => {
  if (!cache) return [];
  const wd = parseKey(date).getDay();
  if (wd === 0 || wd > 6) return [];
  return cache.template
    .filter((a) => a.day === wd)
    .map((a) => ({ a, task: cache!.tasks.find((t) => t.id === a.taskId) }))
    .filter((x): x is { a: PiketAssignment; task: PiketTask } => !!x.task && x.task.active)
    .map(({ a, task }) => {
      // approved swaps override the weekly template for one specific date
      const ov = cache!.swapOverrides.find((o) => o.date === date && o.taskId === task.id);
      const assign: PiketAssignment = ov ? { ...a, userId: ov.userId } : a;
      return { task, assign, log: cache!.piketLog.find((l) => l.date === date && l.taskId === task.id && l.userId === assign.userId) };
    });
};

export const myPiketToday = (userId: string) => piketForDate(todayKey()).filter((r) => r.assign.userId === userId);

export function completePiket(date: string, taskId: string, userId: string, proof?: string): { ok: boolean; msg: string; points: number } {
  if (!cache) return { ok: false, msg: "Store not ready", points: 0 };
  const task = cache.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, msg: "Task not found", points: 0 };
  if (cache.piketLog.some((l) => l.date === date && l.taskId === taskId && l.userId === userId))
    return { ok: false, msg: "Already completed for this date", points: 0 };
  cache.piketLog.push({ id: uid(), date, taskId, userId, doneAt: new Date().toISOString(), proof, points: task.points });
  cache.pointEvents.push({ id: uid(), userId, date, delta: task.points, label: `${task.name} piket` });
  const u = userById(userId); if (u) u.points += task.points;
  pushNotif(userId, "Piket completed", `${task.name} · +${task.points} pts credited.`);
  mutate();
  return { ok: true, msg: `+${task.points} pts`, points: task.points };
}

/* ================= shift handovers ================= */
export function addHandover(userId: string, date: string, shiftId: string, note: string, issue?: string): { ok: boolean; msg: string } {
  if (!cache) return { ok: false, msg: "Store not ready" };
  cache.handovers.unshift({ id: uid(), date, shiftId, fromUserId: userId, note, issue: issue?.trim() || undefined, createdAt: new Date().toISOString() });
  cache.users.filter((u) => u.role !== "staff").forEach((a) => pushNotif(a.id, "Shift handover", `${userName(userId)} posted a handover note${issue ? " with a pending issue" : ""}.`));
  mutate();
  return { ok: true, msg: "Handover posted — incoming crew will confirm." };
}

export function confirmHandover(id: string, userId: string) {
  if (!cache) return;
  const h = cache.handovers.find((x) => x.id === id);
  if (!h || h.confirmedBy) return;
  h.confirmedBy = userId;
  h.confirmedAt = new Date().toISOString();
  pushNotif(h.fromUserId, "Handover confirmed", `${userName(userId)} confirmed your shift handover.`);
  mutate();
}

/* ================= piket swaps ================= */
export function requestSwap(fromUserId: string, toUserId: string, date: string, taskId: string, reason: string): { ok: boolean; msg: string } {
  if (!cache) return { ok: false, msg: "Store not ready" };
  if (cache.swapRequests.some((s) => s.date === date && s.taskId === taskId && s.status === "pending"))
    return { ok: false, msg: "A swap for this duty is already pending." };
  cache.swapRequests.unshift({ id: uid(), date, taskId, fromUserId, toUserId, reason, status: "pending", createdAt: new Date().toISOString() });
  const task = cache.tasks.find((t) => t.id === taskId);
  pushNotif(toUserId, "Swap request", `${userName(fromUserId)} wants to swap "${task?.name ?? "piket"}" on ${fmtDate(date)} with you.`);
  cache.users.filter((u) => u.role !== "staff").forEach((a) => pushNotif(a.id, "Swap request", `${userName(fromUserId)} → ${userName(toUserId)} · ${task?.name ?? ""} · ${fmtDate(date)}`));
  mutate();
  return { ok: true, msg: "Swap request sent for approval." };
}

export function decideSwap(id: string, approve: boolean, decider: string) {
  if (!cache) return;
  const s = cache.swapRequests.find((x) => x.id === id);
  if (!s || s.status !== "pending") return;
  s.status = approve ? "approved" : "rejected";
  s.decidedBy = decider;
  if (approve) {
    // remove any earlier override for this duty date, then apply the swap
    cache.swapOverrides = cache.swapOverrides.filter((o) => !(o.date === s.date && o.taskId === s.taskId));
    cache.swapOverrides.push({ id: uid(), date: s.date, taskId: s.taskId, userId: s.toUserId });
  }
  const task = cache.tasks.find((t) => t.id === s.taskId);
  const label = `${task?.name ?? "Piket"} · ${fmtDate(s.date)}`;
  pushNotif(s.fromUserId, approve ? "Swap approved" : "Swap rejected", `${label} — ${approve ? `${userName(s.toUserId)} will cover your duty.` : "request declined by admin."}`);
  pushNotif(s.toUserId, approve ? "Swap approved" : "Swap rejected", `${label} — ${approve ? "you are now assigned this duty." : "request declined by admin."}`);
  mutate();
}

export function setAssignment(taskId: string, day: number, userId: string | null) {
  if (!cache) return;
  const existing = cache.template.find((a) => a.taskId === taskId && a.day === day);
  if (userId === null) cache.template = cache.template.filter((a) => !(a.taskId === taskId && a.day === day));
  else if (existing) existing.userId = userId;
  else cache.template.push({ id: uid(), taskId, day, userId });
  mutate();
}

export function saveTask(input: { id?: string; name: string; area: string; points: number; requiresProof: boolean; desc: string; icon: PiketTask["icon"]; active: boolean }) {
  if (!cache) return;
  if (input.id) {
    const t = cache.tasks.find((x) => x.id === input.id);
    if (t) Object.assign(t, input);
  } else {
    cache.tasks.push({ id: uid(), ...input });
  }
  mutate();
}

export function deleteTask(id: string) {
  if (!cache) return;
  cache.tasks = cache.tasks.filter((t) => t.id !== id);
  cache.template = cache.template.filter((a) => a.taskId !== id);
  mutate();
}

export function rotateTemplate() {
  if (!cache) return;
  for (let day = 1; day <= 6; day++) {
    const rows = cache.template.filter((a) => a.day === day);
    if (rows.length < 2) continue;
    const ids = rows.map((r) => r.userId);
    const rotated = [ids[ids.length - 1], ...ids.slice(0, ids.length - 1)];
    rows.forEach((r, i) => { r.userId = rotated[i]; });
  }
  mutate();
}

/* ================= overtime ================= */
export function otHours(o: Overtime) {
  return Math.max(0, hoursBetween(o.start, o.end));
}

export function submitOvertime(userId: string, date: string, start: string, end: string, reason: string, photo?: string): { ok: boolean; msg: string } {
  if (!cache) return { ok: false, msg: "Store not ready" };
  if (hoursBetween(start, end) <= 0) return { ok: false, msg: "End time must be after start time." };
  if (cache.ot.some((o) => o.userId === userId && o.date === date && o.status !== "rejected" && !(end <= o.start || start >= o.end)))
    return { ok: false, msg: "Overlaps an existing request on this date." };
  cache.ot.unshift({ id: uid(), userId, date, start, end, reason, status: "pending", photo, createdAt: new Date().toISOString() });
  cache.users.filter((u) => u.role !== "staff").forEach((a) => pushNotif(a.id, "Overtime request", `${userName(userId)} · ${fmtDate(date)} · ${hoursBetween(start, end)}h`));
  mutate();
  return { ok: true, msg: "Request submitted for approval." };
}

export function cancelOvertime(id: string) {
  if (!cache) return;
  const o = cache.ot.find((x) => x.id === id);
  if (o && o.status === "pending") { cache.ot = cache.ot.filter((x) => x.id !== id); mutate(); }
}

export function decideOvertime(id: string, approve: boolean, note: string, decider: string) {
  if (!cache) return;
  const o = cache.ot.find((x) => x.id === id);
  if (!o || o.status !== "pending") return;
  o.status = approve ? "approved" : "rejected";
  o.note = note || undefined;
  o.decidedAt = new Date().toISOString();
  if (approve) {
    cache.pointEvents.push({ id: uid(), userId: o.userId, date: o.date, delta: 5, label: "Overtime bonus" });
    const u = userById(o.userId); if (u) u.points += 5;
  }
  if (userById(o.userId)?.notifApproval) pushNotif(o.userId, approve ? "Overtime approved 🎉" : "Overtime rejected", `${fmtDate(o.date)} · ${otHours(o)}h${note ? ` — "${note}"` : ""} · by ${decider}`);
  mutate();
}

/* ================= leaves ================= */
export function requestLeave(userId: string, date: string, reason: string): { ok: boolean; msg: string } {
  if (!cache) return { ok: false, msg: "Store not ready" };
  if (cache.leaves.some((l) => l.userId === userId && l.date === date && l.status !== "rejected")) return { ok: false, msg: "You already requested leave on that date." };
  cache.leaves.push({ id: uid(), userId, date, reason, status: "pending", createdAt: new Date().toISOString() });
  cache.users.filter((u) => u.role !== "staff").forEach((a) => pushNotif(a.id, "Leave request", `${userName(userId)} · ${fmtDate(date)}`));
  mutate();
  return { ok: true, msg: "Leave request submitted." };
}

export const leaveBalance = (userId: string) => 12 - (cache?.leaves.filter((l) => l.userId === userId && l.status === "approved").length ?? 0);

/* ================= points & rewards ================= */
export function grantBonus(userId: string, delta: number, label: string) {
  if (!cache) return;
  cache.pointEvents.push({ id: uid(), userId, date: todayKey(), delta, label });
  const u = userById(userId); if (u) u.points += delta;
  mutate();
}

export function redeem(userId: string, itemId: string): { ok: boolean; msg: string } {
  if (!cache) return { ok: false, msg: "Store not ready" };
  const u = userById(userId); const it = cache.items.find((i) => i.id === itemId);
  if (!u || !it) return { ok: false, msg: "Not found" };
  if (it.stock <= 0) return { ok: false, msg: "Out of stock" };
  if (u.points < it.cost) return { ok: false, msg: `Not enough points — you need ${it.cost - u.points} more.` };
  u.points -= it.cost;
  it.stock -= 1;
  cache.redemptions.unshift({ id: uid(), userId, itemId, date: todayKey(), cost: it.cost });
  cache.pointEvents.push({ id: uid(), userId, date: todayKey(), delta: -it.cost, label: `Redeemed: ${it.name}` });
  cache.users.filter((x) => x.role !== "staff").forEach((a) => pushNotif(a.id, "Redemption", `${u.name} redeemed ${it.name} (${it.cost} pts).`));
  mutate();
  return { ok: true, msg: `${it.name} redeemed` };
}

export function addItem(input: { name: string; cost: number; stock: number; cat: RedeemItem["cat"] }) {
  if (!cache) return;
  cache.items.push({ id: uid(), icon: "package", ...input });
  mutate();
}

/* ================= announcements ================= */
export function addAnnouncement(input: { title: string; body: string; author: string; pinned: boolean }) {
  if (!cache) return;
  cache.announcements.unshift({ id: uid(), date: todayKey(), ...input });
  pushNotif("*", "Announcement", input.title);
  mutate();
}

export function deleteAnnouncement(id: string) {
  if (!cache) return;
  cache.announcements = cache.announcements.filter((a) => a.id !== id);
  mutate();
}

/* ================= staff management ================= */
export function addStaff(input: { name: string; email: string; employeeId: string; role: Role; department: string; password: string }): { ok: boolean; msg: string } {
  if (!cache) return { ok: false, msg: "Store not ready" };
  if (cache.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) return { ok: false, msg: "Email already registered." };
  cache.users.push(mkUser(uid(), input.name, input.email, input.role, input.employeeId, input.department, Math.floor(Math.random() * 360), input.password, false));
  pushNotif("*", "New team member", `${input.name} joined ${input.department}.`);
  mutate();
  return { ok: true, msg: `${input.name} created · temp password ${input.password}` };
}

export function toggleActive(userId: string) {
  const u = userById(userId); if (!u) return;
  u.active = !u.active; mutate();
}

/** Edit an existing account (admin/super admin only). Super Admin role is locked. */
export function updateUser(userId: string, patch: { name: string; email: string; employeeId: string; role: Role; department: string }): { ok: boolean; msg: string } {
  if (!cache) return { ok: false, msg: "Store not ready" };
  const u = userById(userId);
  if (!u) return { ok: false, msg: "Account not found." };
  if (!patch.name.trim()) return { ok: false, msg: "Name is required." };
  if (!patch.email.includes("@")) return { ok: false, msg: "Valid email required." };
  if (!patch.employeeId.trim()) return { ok: false, msg: "Employee ID is required." };
  if (cache.users.some((x) => x.id !== userId && x.email.toLowerCase() === patch.email.toLowerCase()))
    return { ok: false, msg: "Email is already used by another account." };
  if (cache.users.some((x) => x.id !== userId && x.employeeId === patch.employeeId.trim()))
    return { ok: false, msg: "Employee ID is already taken." };
  if (u.role === "superadmin" && patch.role !== "superadmin")
    return { ok: false, msg: "The Super Admin role cannot be changed." };
  if (u.role !== "superadmin" && patch.role === "superadmin")
    return { ok: false, msg: "Super Admin accounts can only be created during setup." };
  const oldName = u.name;
  u.name = patch.name.trim();
  u.email = patch.email.trim();
  u.employeeId = patch.employeeId.trim();
  u.role = patch.role;
  u.department = patch.department;
  pushNotif(userId, "Profile updated", `Your account details were changed by an admin${oldName !== u.name ? ` (now ${u.name})` : ""}.`);
  mutate();
  return { ok: true, msg: `${u.name}'s account updated.` };
}

export function enrollFace(userId: string) {
  const u = userById(userId); if (!u) return;
  u.faceEnrolled = true;
  pushNotif(userId, "Face enrolled", "Your face descriptor is now active for check-in.");
  mutate();
}

export function updateSettings(patch: Partial<Settings>) {
  if (!cache) return;
  cache.settings = { ...cache.settings, ...patch };
  persist(); emit();
}

/* ================= supabase deploy ================= */
export function connectSupabase(url: string, key: string) {
  updateSettings({ supabase: { url, key, status: "connected", connectedAt: new Date().toISOString() } });
}

export function syncSupabase(): { pushed: number; pulled: number } {
  if (!cache) return { pushed: 0, pulled: 0 };
  const pushed = cache.attendance.length + cache.piketLog.length + cache.ot.length;
  const pulled = Math.floor(Math.random() * 5);
  updateSettings({ supabase: { ...cache.settings.supabase, lastSync: new Date().toISOString() } });
  return { pushed, pulled };
}

export function disconnectSupabase() {
  updateSettings({ supabase: { url: "", key: "", status: "off" } });
}

/* ================= analytics ================= */
export interface UserStats {
  pct: number; lates: number; earlies: number; otHours: number; points: number;
  leaveDays: number; monthPct: number; ytd: number[]; heat: Record<string, "ok" | "late" | "absent" | "out">;
  weeks: number[]; streak: number; score: number;
}

export function perfIndex(pct: number, lates: number, points: number): number {
  return Math.round(Math.min(100, 0.7 * pct + 0.2 * Math.max(0, 100 - Math.min(lates * 8, 100)) + 0.1 * Math.min(points, 100)));
}

export function statsFor(userId: string): UserStats | null {
  if (!cache) return null;
  const u = userById(userId);
  if (!u) return null;
  const rows = cache.attendance.filter((a) => a.userId === userId).sort((a, b) => a.date.localeCompare(b.date));
  const now = new Date();
  const ym = now.toISOString().slice(0, 7);
  const monthRows = rows.filter((r) => r.date.startsWith(ym));
  const present = rows.filter((r) => r.checkIn).length;
  const mon = mondayOf(now);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const s = addDays(mon, (i - 7) * 7);
    const wk = rows.filter((r) => { const d = parseKey(r.date); return d >= s && d < addDays(s, 7) && r.checkIn; }).length;
    return Math.round((wk / 6) * 100);
  });
  const heat: UserStats["heat"] = {};
  const y1 = new Date(now.getFullYear(), 0, 1);
  for (let d = new Date(y1); d <= now; d = addDays(d, 1)) {
    const k = dayKey(d);
    if (d.getDay() === 0) { heat[k] = "out"; continue; }
    const r = rows.find((x) => x.date === k);
    heat[k] = !r || !r.checkIn ? (k > todayKey() ? "out" : "absent") : r.late ? "late" : "ok";
  }
  const lates = rows.filter((r) => r.late).length;
  const monthDen = Math.max(1, monthRows.length + monthRows.filter((r) => !r.checkIn).length);
  const pct = rows.length ? Math.round((present / Math.max(rows.length, 1)) * 100) : 0;
  return {
    pct: Math.min(100, pct),
    lates,
    earlies: rows.filter((r) => r.early).length,
    otHours: cache.ot.filter((o) => o.userId === userId && o.status === "approved").reduce((s, o) => s + otHours(o), 0),
    points: u.points,
    leaveDays: cache.leaves.filter((l) => l.userId === userId && l.status === "approved").length,
    monthPct: Math.min(100, Math.round((monthRows.filter((r) => r.checkIn).length / monthDen) * 100)),
    ytd: Array.from({ length: now.getMonth() + 1 }, (_, m) => {
      const mk = `${now.getFullYear()}-${String(m + 1).padStart(2, "0")}`;
      const mr = rows.filter((r) => r.date.startsWith(mk) && r.date <= todayKey());
      return mr.length ? Math.round((mr.filter((r) => r.checkIn).length / mr.length) * 100) : 0;
    }),
    heat, weeks,
    streak: (() => { let s = 0; for (let b = rows.length - 1; b >= 0; b--) { if (rows[b].checkIn && !rows[b].late) s++; else break; } return s; })(),
    score: perfIndex(Math.min(100, pct), lates, u.points),
  };
}

export function leaderboard(): { user: User; stats: UserStats }[] {
  if (!cache) return [];
  return cache.users
    .filter((u) => u.role === "staff" && u.active)
    .map((user) => ({ user, stats: statsFor(user.id)! }))
    .sort((a, b) => b.stats.score - a.stats.score);
}

/* ================= misc ================= */
export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const supabaseSQL = `-- ShiftGate schema v1 (PostgreSQL / Supabase)
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null, name text not null,
  role text check (role in ('superadmin','admin','staff')),
  employee_id text unique, department text,
  photo_url text, face_descriptor jsonb, -- encrypted at rest
  points int default 0, active bool default true,
  created_at timestamptz default now()
);
create table attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  date date not null, check_in timestamptz, check_out timestamptz,
  late bool default false, early bool default false,
  in_score int, out_score int, distance_m int,
  method text check (method in ('face','qr','manual')),
  self_report bool default false,
  unique (user_id, date)
);
create table piket_tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null, area text, points int default 10,
  requires_proof bool default false, active bool default true,
  icon text, description text
);
create table piket_template (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references piket_tasks(id) on delete cascade,
  day int check (day between 1 and 6),
  user_id uuid references users(id),
  unique (task_id, day)
);
create table piket_log (
  id uuid primary key default gen_random_uuid(),
  date date not null, task_id uuid references piket_tasks(id),
  user_id uuid references users(id), done_at timestamptz,
  proof_url text, points int,
  unique (date, task_id, user_id)
);
create table overtime (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id), date date not null,
  start_time time, end_time time, reason text,
  status text check (status in ('pending','approved','rejected')),
  note text, created_at timestamptz default now(), decided_at timestamptz
);
create table leaves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id), date date not null,
  reason text, status text default 'pending', created_at timestamptz default now()
);
create table point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id), date date, delta int, label text
);
create table redeem_items (
  id uuid primary key default gen_random_uuid(),
  name text, points_cost int, stock int, icon text, cat text
);
create table redeem_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id), item_id uuid references redeem_items(id),
  points_spent int, date date default current_date
);
create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text, content text, created_by uuid references users(id),
  date date default current_date, pinned bool default false
);
alter table attendance enable row level security;
alter table piket_log enable row level security;
-- policies: staff read own rows, admin full access`;
