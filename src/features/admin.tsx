import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Camera, Check, ChevronDown, ChevronUp, ClipboardList, Clock3, Cloud, Copy, Database,
  Download, Globe, Image as ImageIcon, KeyRound, Loader2, LogOut, MapPin, Megaphone, Moon, Pencil, Plus,
  Radio, RefreshCw, ScanFace, Send, Settings2, Sun, Trash2, UserPlus, Users, X,
} from "lucide-react";
import type { Department, Lang, Role, User } from "../types";
import {
  addAnnouncement, addPointEvent, connectSupabase, deleteAnnouncement, disconnectSupabase, enrollFace,
    getDB, manualLog, rerunSetup, reviewSelfReport, addPointEventLocal,
  toggleActive, updateSettings, updateUser, userName, updateUserShift,
} from "../lib/store";
import { downloadCSV, fmtDate, fmtIDRFull, fmtTime, relTime, todayKey, wait } from "../lib/util";
import { useT } from "../lib/i18n";
import { getShiftWindow, getShiftStatusTone } from "../lib/shifts";
import { Avatar, Btn, Chip, Confirm, Empty, Field, LiveDot, SectionTitle, Seg, Sheet, Toggle, toast } from "../components/ui";
import { Lightbox } from "../components/capture";
import { FeedbackInbox } from "./feedback";
import { GeofenceStudio } from "./geofence";
import { testSupabaseConnection, initSupabase } from "../lib/supabase";
import { createStaffAccount, workspaceProfiles } from "../lib/production";
import { createAnnouncement, deleteAnnouncementRemote, setProfileActiveRemote, updateProfileRemote, addPointEventRemote, updateProfileShiftRemote } from "../lib/production";
import { refreshProductionData } from "../lib/store";
import { enrollFaceRemote, manualAttendanceRemote, reviewSelfReportRemote } from "../lib/production";

export type AdminSec = "live" | "staff" | "notice" | "points" | "photos" | "feedback" | "shifts" | "cloud" | "config" | "smtp";
type Sec = AdminSec;
export const DEPARTMENTS = ["Manager", "Supervisor", "Leader", "Checker Inbound", "Checker Outbound", "Checker Packing", "Packing", "Helper", "Stock Keeper Leader", "Stock Keeper", "Picker"] as const;
const DEPTS = [...DEPARTMENTS];

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const tone = state === "saved" ? "ok" : state === "saving" ? "cool" : "bad";
  const label = state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save failed";
  return <Chip tone={tone} className="shrink-0">{label}</Chip>;
}

export default function Admin({ user, sec, onSec }: { user: User; sec: Sec; onSec: (s: Sec) => void }) {
  const db = getDB();
  const t = useT();
  const setSec = onSec;
  if (!db) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-faint">console</p>
          <h1 className="ttl text-[24px] font-bold leading-tight text-ink">Warehouse admin</h1>
        </div>
        <Chip tone={user.role === "superadmin" ? "amber" : "cool"}>{user.role}</Chip>
      </div>
      <Seg
        className="no-scrollbar overflow-x-auto [&>button]:shrink-0"
        options={[
          { id: "live", label: t("a.live") }, { id: "staff", label: t("a.staff") }, { id: "notice", label: t("a.notice") },
          { id: "points", label: "Points" }, { id: "photos", label: t("a.photos") }, { id: "feedback", label: t("fb.inbox") }, { id: "shifts", label: "Shifts" }, { id: "cloud", label: t("a.cloud") }, { id: "config", label: t("a.config") },
          ...(user.role === "superadmin" ? [{ id: "smtp" as AdminSec, label: "SMTP" }] : []),
        ]}
        value={sec} onChange={setSec}
      />
      {sec === "live" && <LiveBoard />}
      {sec === "staff" && <StaffPanel admin={user} />}
      {sec === "notice" && <NoticePanel admin={user} />}
      {sec === "points" && <PointsPanel admin={user} />}
      {sec === "photos" && <PhotosPanel />}
      {sec === "feedback" && <FeedbackInbox admin={user} />}
      {sec === "shifts" && <ShiftsPanel admin={user} />}
      {sec === "cloud" && <CloudPanel />}
      {sec === "config" && <ConfigPanel />}
      {sec === "smtp" && <SmtpPanel />}
    </div>
  );
}

/* ---------------- floor radar (SVG replacement for Leaflet) ---------------- */
/** deterministic pseudo-random offset per user so dots stay stable across renders */
function userOffset(id: string, radius: number): { x: number; y: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const angle = ((Math.abs(h) % 360) * Math.PI) / 180;
  const dist = radius * (0.2 + (Math.abs(h >> 3) % 55) / 100);
  // Convert meters to SVG pixels (scale factor for visualization)
  const scale = 0.3; // pixels per meter
  return {
    x: Math.cos(angle) * dist * scale,
    y: Math.sin(angle) * dist * scale,
  };
}

function FloorRadar({ onDutyIds }: { onDutyIds: string[] }) {
  const db = getDB();
  const t = useT();
  if (!db) return null;
  const { lat, lng, radius } = db.settings;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-3.5 pt-3">
        <p className="ttl inline-flex items-center gap-1.5 text-[12px] font-bold text-ink">
          <Radio size={14} className="text-cool" /> {t("lr.title")}
        </p>
        <Chip tone="ok"><span className="pulse-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-ok" /> {onDutyIds.length} {t("lr.live")}</Chip>
      </div>
      <div className="relative mt-2 h-[190px] w-full overflow-hidden rounded-lg bg-panel2/40">
        <svg viewBox="-150 -150 300 300" className="h-full w-full">
          {/* Grid background */}
          <defs>
            <pattern id="radarGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--line)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="radarGrad">
              <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--amber)" stopOpacity="0.02" />
            </radialGradient>
          </defs>
          <rect x="-150" y="-150" width="300" height="300" fill="url(#radarGrid)" />
          
          {/* Radar sweep animation */}
          <circle cx="0" cy="0" r="135" fill="url(#radarGrad)">
            <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="8s" repeatCount="indefinite" />
          </circle>

          {/* Geofence circle */}
          <circle cx="0" cy="0" r={radius * 0.3} fill="var(--amber)" fillOpacity="0.08" stroke="var(--amber)" strokeWidth="2" strokeDasharray="6 4" />

          {/* Center beacon */}
          <circle cx="0" cy="0" r="5" fill="var(--amber)" />

          {/* User dots */}
          {onDutyIds.map((id) => {
            const u = db.users.find((x) => x.id === id);
            if (!u) return null;
            const off = userOffset(id, radius);
            return (
              <g key={id} transform={`translate(${off.x}, ${off.y})`}>
                <circle r="7" fill="var(--ok)" stroke="var(--panel1)" strokeWidth="2" />
                <title>{u.name} · {u.department}</title>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="border-t border-line2 bg-panel2/60 px-3.5 py-1.5 text-center font-mono text-[9.5px] uppercase tracking-widest text-faint">
        {t("lr.sim")}
      </p>
    </div>
  );
}

function DepartmentCoverageBoard() {
  const db = getDB();
  const t = useT();
  if (!db) return null;

  const today = todayKey();
  const departments = [...new Set(db.users.map((u) => u.department))].sort((a, b) => a.localeCompare(b));
  const rows = departments.map((department) => {
    const activeUsers = db.users.filter((u) => u.department === department && u.active);
    const activeIds = new Set(activeUsers.map((u) => u.id));
    const onDuty = db.attendance.filter((a) => a.date === today && a.checkIn && !a.checkOut && activeIds.has(a.userId)).length;
    const late = db.attendance.filter((a) => a.date === today && a.late && activeIds.has(a.userId)).length;
    return { department, staff: activeUsers.length, onDuty, late };
  });

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="ttl text-[12px] font-bold text-ink">Department coverage</p>
        <Chip tone="mut">today</Chip>
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.department} className="flex items-center justify-between rounded-lg border border-line2 bg-panel2/60 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-ink">{row.department}</p>
              <p className="font-mono text-[10px] text-faint">{row.staff} staff</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Chip tone="cool">{row.onDuty} {t("a.onDuty")}</Chip>
              <Chip tone={row.late > 0 ? "bad" : "ok"}>{row.late} late</Chip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- live board ---------------- */
function LiveBoard() {
  const db = getDB();
  const t = useT();
  const [showManual, setShowManual] = useState(false);
  const [mUser, setMUser] = useState("");
  const [mDate, setMDate] = useState(todayKey());
  const [mIn, setMIn] = useState("08:00");
  const [mOut, setMOut] = useState("");
  const [tick, setTick] = useState(0);
  if (!db) return null;
  const today = todayKey();
  const rows = useMemo(
    () => db.attendance.filter((a) => a.date === today).sort((a, b) => (b.checkIn ?? "").localeCompare(a.checkIn ?? "")),
    [db, today, tick] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const onDuty = rows.filter((r) => r.checkIn && !r.checkOut);
  const selfReports = rows.filter((r) => r.selfReport);

  return (
    <div className="a-fadein space-y-3">
      <DepartmentCoverageBoard />
      <div className="grid grid-cols-3 gap-2.5">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 text-ok"><LiveDot /><span className="ttl text-[10.5px] font-bold text-mut">{t("a.onDuty")}</span></div>
          <p className="mt-1.5 font-mono text-[22px] font-semibold leading-none text-ink">{onDuty.length}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 text-amber"><Clock3 size={12} /><span className="ttl text-[10.5px] font-bold text-mut">{t("a.checkedIn")}</span></div>
          <p className="mt-1.5 font-mono text-[22px] font-semibold leading-none text-ink">{rows.filter((r) => r.checkIn).length}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 text-bad"><Activity size={12} /><span className="ttl text-[10.5px] font-bold text-mut">{t("a.lateC")}</span></div>
          <p className="mt-1.5 font-mono text-[22px] font-semibold leading-none text-ink">{rows.filter((r) => r.late).length}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-mono text-[10.5px] uppercase tracking-widest text-faint">auto-refresh · {today}</p>
        <div className="flex gap-2">
          <button onClick={() => setTick((x) => x + 1)} className="tap flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-2.5 py-1.5 font-mono text-[11px] text-mut hover:text-ink">
            <RefreshCw size={12} /> {t("a.refresh")}
          </button>
          <Btn variant="ghost" className="!px-2.5 !py-1.5 text-[12px]" onClick={() => setShowManual(true)}><Plus size={13} /> {t("a.manual")}</Btn>
          <button onClick={() => {
            if (!db) return;
            const rows = db.attendance.filter((a) => a.date === today);
            downloadCSV(`attendance-${today}.csv`, [
              ["Date", "Employee", "Department", "Check-in", "Check-out", "Late", "Method", "Face match %", "Distance m"],
              ...rows.map((a) => {
                const u = db.users.find((x) => x.id === a.userId);
                return [a.date, u?.name ?? a.userId, u?.department ?? "", a.checkIn ? fmtTime(a.checkIn) : "", a.checkOut ? fmtTime(a.checkOut) : "", a.late ? "YES" : "no", a.method ?? "face", a.inScore ?? "", a.distance ?? ""];
              }),
            ]);
            toast(`${rows.length} rows → CSV`, "ok");
          }}
            className="tap flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-2.5 py-1.5 font-mono text-[11px] text-mut hover:text-ink">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty icon={<Radio size={26} />} title={t("a.floorQuiet")} sub={t("a.floorQuietSub")} />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const u = db.users.find((x) => x.id === r.userId);
            if (!u) return null;
            const active = !!r.checkIn && !r.checkOut;
            return (
              <div key={r.id} className={`card p-3 ${r.selfReport ? "border-amber/40" : ""}`}>
                <div className="flex items-center gap-3">
                  <Avatar user={u} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{u.name}</p>
                      {active && <LiveDot />}
                      {r.selfReport && <Chip tone="amber">self-report</Chip>}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-faint">
                      {u.department} · {getShiftWindow(u, db.settings)} · in {fmtTime(r.checkIn)}{r.checkOut ? ` · out ${fmtTime(r.checkOut)}` : " · on floor"}
                      {r.distance ? ` · ${r.distance}m` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {r.inScore && <Chip tone="cool"><ScanFace size={10} />{r.inScore}%</Chip>}
                    {r.method && <Chip tone={r.method === "manual" ? "mut" : r.method === "qr" ? "cool" : "ok"}>{r.method}</Chip>}
                    {r.late && <Chip tone="bad">late</Chip>}
                  </div>
                </div>
                {r.selfReport && (
                  <div className="mt-2.5 flex gap-2 border-t border-line2 pt-2.5">
                    <Btn variant="ok" className="flex-1 !py-2 text-[12.5px]" onClick={async () => { try { await reviewSelfReportRemote(r.id, true); await refreshProductionData(); toast(`Approved ${u.name}`); } catch (error) { toast(error instanceof Error ? error.message : "Could not approve report", "err"); } }}><Check size={14} /> ✓</Btn>
                    <Btn variant="danger" className="flex-1 !py-2 text-[12.5px]" onClick={async () => { try { await reviewSelfReportRemote(r.id, false); await refreshProductionData(); toast("Rejected", "info"); } catch (error) { toast(error instanceof Error ? error.message : "Could not reject report", "err"); } }}><X size={14} /> ✕</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {selfReports.length > 0 && (
        <p className="text-center font-mono text-[11px] text-amber">{selfReports.length} {t("a.selfReportWait")}</p>
      )}

      <Sheet open={showManual} onClose={() => setShowManual(false)} title={t("a.manualTitle")}>
        <div className="space-y-3.5">
          <Field label={t("a.employee")}>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {db.users.filter((u) => u.role === "staff" && u.active).map((u) => (
                <button key={u.id} onClick={() => setMUser(u.id)}
                  className={`tap flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-2 ${mUser === u.id ? "border-amber/60 bg-amber/12" : "border-line bg-panel2"}`}>
                  <Avatar user={u} size={24} />
                  <span className="text-[12px] font-medium text-ink">{u.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("o.date")}><input className="inp font-mono" type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("a.checkInT")}><input className="inp font-mono" type="time" value={mIn} onChange={(e) => setMIn(e.target.value)} /></Field>
            <Field label={t("a.checkOutT")}><input className="inp font-mono" type="time" value={mOut} onChange={(e) => setMOut(e.target.value)} /></Field>
          </div>
          <Btn className="w-full" onClick={async () => {
            if (!mUser) { toast("Pick an employee first", "err"); return; }
            const selectedUser = db.users.find((u) => u.id === mUser);
            const shiftStart = selectedUser?.shiftStart || db.settings.lateTime;
            try { await manualAttendanceRemote({ userId: mUser, date: mDate, checkIn: mIn, checkOut: mOut || undefined, late: mIn > shiftStart }); await refreshProductionData(); toast(`Saved for ${userName(mUser)}`); setShowManual(false); }
            catch (error) { toast(error instanceof Error ? error.message : "Could not save attendance", "err"); }
          }}>{t("a.saveRecord")}</Btn>
          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint">{t("a.audit")}</p>
        </div>
      </Sheet>
    </div>
  );
}

/* ---------------- staff ---------------- */
function StaffPanel({ admin }: { admin: User }) {
  const db = getDB();
  const t = useT();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState<Department>(DEPTS[0] as Department);
  const [role, setRole] = useState<Role>("staff");
  const [pw, setPw] = useState(genPw());
  const [saving, setSaving] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<User[]>([admin]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  useEffect(() => {
    workspaceProfiles().then(setProfiles).catch((error) => toast(error instanceof Error ? error.message : "Could not load staff", "err")).finally(() => setLoadingProfiles(false));
  }, []);
  if (!db) return null;
  const isSuper = admin.role === "superadmin";
  const nextId = "WMS-" + String(100 + profiles.length + 1).padStart(3, "0");

  const save = async () => {
    if (!name.trim() || !email.includes("@") || pw.length < 8) { toast("Name, valid email, and an 8-character password are required", "err"); return; }
    setSaving(true);
    setSaveState("saving");
    try {
      const res = await createStaffAccount({ name: name.trim(), email: email.trim(), employeeId: nextId, role: role === "admin" ? "admin" : "staff", department: dept, password: pw });
      if (!res.ok) {
        setSaveState("error");
        toast(res.message, "err");
        return;
      }
      if (res.profile) setProfiles((current) => [...current, res.profile!]);
      setSaveState("saved");
      toast(`${res.message} Login credentials are ready.`, "ok");
      setShowAdd(false); setName(""); setEmail(""); setPw(genPw());
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaveState("idle"), 1200);
    }
  };

  return (
    <div className="a-fadein space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[11px] uppercase tracking-widest text-faint">{profiles.length} {t("a.accounts")} · {profiles.filter((u) => u.active).length} {t("a.active")}</p>
          <SaveBadge state={saveState} />
        </div>
        <Btn className="!px-3 !py-2" onClick={() => setShowAdd(true)}><UserPlus size={15} /> {t("a.add")}</Btn>
      </div>
      <div className="space-y-2">
        {loadingProfiles ? <div className="card p-4 text-center font-mono text-[11px] text-faint">Loading staff…</div> : profiles.map((u) => (
          <div key={u.id} className={`card flex items-center gap-3 p-3 ${!u.active ? "opacity-60" : ""}`}>
            <Avatar user={u} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[13.5px] font-semibold text-ink">{u.name}</p>
                <Chip tone={u.role === "superadmin" ? "amber" : u.role === "admin" ? "cool" : "mut"}>{u.role}</Chip>
              </div>
              <p className="mt-0.5 truncate font-mono text-[10.5px] text-faint">{u.employeeId} · {u.department} · {u.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {u.faceEnrolled
                ? <Chip tone="ok"><ScanFace size={10} /> {t("a.face")}</Chip>
                : u.role === "staff" && (
                  <button onClick={async () => { try { await enrollFaceRemote(u.id); await refreshProductionData(); setProfiles(await workspaceProfiles()); toast(`Face enrolled: ${u.name}`); } catch (error) { toast(error instanceof Error ? error.message : "Could not enroll face", "err"); } }}
                    className="tap rounded-lg border border-amber/40 bg-amber/10 px-2 py-1.5 font-mono text-[10px] uppercase text-amber">{t("a.enroll")}</button>
                )}
              <button onClick={() => setEditUser(u)} className="tap rounded-lg border border-line bg-panel2 p-2 text-mut hover:border-amber/50 hover:text-amber" aria-label={t("a.editUser")}>
                <Pencil size={13} />
              </button>
              {admin.role === "superadmin" && u.role !== "superadmin" && (
                <button onClick={() => setResetUser(u)} className="tap rounded-lg border border-line bg-panel2 p-2 text-mut hover:border-amber/50 hover:text-amber" aria-label="Reset password" title="Reset password">
                  <KeyRound size={13} />
                </button>
              )}
              {u.id !== admin.id && u.role !== "superadmin" && <Toggle on={u.active} onChange={async () => { try { await setProfileActiveRemote(u.id, !u.active); await refreshProductionData(); setProfiles(await workspaceProfiles()); toast(`${u.name} ${u.active ? "deactivated" : "reactivated"}`, "info"); } catch (error) { toast(error instanceof Error ? error.message : "Could not update account", "err"); } }} />}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title={t("a.createAccount")}>
        <div className="space-y-3.5">
          <Field label={t("a.fullName")}><input className="inp" value={name} onChange={(e) => { setName(e.target.value); if (!email) setEmail(e.target.value.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/).join(".") + "@company.com"); }} placeholder="Sari Rahma" /></Field>
          <Field label={t("a.email")}><input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("a.empId")}><input className="inp font-mono" value={nextId} readOnly /></Field>
            <Field label={t("a.department")}>
              <select className="inp" value={dept} onChange={(e) => setDept(e.target.value as Department)}>
                {DEPTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <Field label={t("a.role")}>
            <div className="flex gap-2">
              {(["staff", "admin"] as Role[]).map((r) => (
                <button key={r} disabled={r === "admin" && !isSuper} onClick={() => setRole(r)}
                  className={`tap ttl flex-1 rounded-lg border px-2 py-2 text-[12.5px] font-bold disabled:opacity-35 ${role === r ? "border-amber/60 bg-amber/12 text-amber" : "border-line bg-panel2 text-mut"}`}>{r}</button>
              ))}
            </div>
          </Field>
          <Field label={t("a.tempPw")}>
            <div className="flex gap-2">
              <input className="inp font-mono" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <Btn variant="ghost" onClick={() => setPw(genPw())}><RefreshCw size={14} /></Btn>
            </div>
          </Field>
          <Btn className="w-full" busy={saving} onClick={save}><Plus size={15} /> {t("a.createAccount")}</Btn>
        </div>
      </Sheet>

      <EditUserSheet user={editUser} onClose={() => setEditUser(null)} onSaved={async () => setProfiles(await workspaceProfiles())} />
      <ResetPasswordSheet user={resetUser} onClose={() => setResetUser(null)} />
    </div>
  );
}

function ResetPasswordSheet({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) setPw(""); }, [user]);
  if (!user) return null;
  return (
    <Sheet open={!!user} onClose={onClose} title={`Reset password — ${user.name}`}>
      <div className="space-y-3.5">
        <p className="font-mono text-[11px] text-faint">Super Admin only — Gmail SMTP will send new temp password if configured.</p>
        <Field label="New temporary password"><input className="inp font-mono" type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Min 8 chars" /></Field>
        <Btn className="w-full" busy={busy} onClick={async () => {
          if (pw.length < 8) { toast("Min 8 characters", "err"); return; }
          setBusy(true);
          try {
            const { productionClient } = await import("../lib/production");
            const client = productionClient();
            if (!client) throw new Error("Supabase not configured");
            const { error } = await client.functions.invoke("reset-password", { body: { userId: user.id, newPassword: pw } });
            if (error) throw new Error(error.message);
            toast(`Password reset for ${user.name}`, "ok");
            onClose();
          } catch (e) { toast(e instanceof Error ? e.message : "Reset failed", "err"); }
          finally { setBusy(false); }
        }}><KeyRound size={14} /> Reset via Gmail</Btn>
      </div>
    </Sheet>
  );
}

/* ---------------- edit existing account ---------------- */
function EditUserSheet({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const db = getDB();
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [empId, setEmpId] = useState("");
  const [dept, setDept] = useState<Department>(DEPTS[0] as Department);
  const [role, setRole] = useState<Role>("staff");
  useEffect(() => {
    if (user) {
      setName(user.name); setEmail(user.email); setEmpId(user.employeeId);
      setDept((DEPTS as string[]).includes(user.department) ? (user.department as Department) : (DEPTS[0] as Department));
      setRole(user.role);
    }
  }, [user]);
  if (!db) return null;
  const isSuper = user?.role === "superadmin";
  return (
    <Sheet open={!!user} onClose={onClose} title={t("a.editUser")}>
      {user && (
        <div className="space-y-3.5">
          <div className="card2 flex items-center gap-3 p-3">
            <Avatar user={user} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-ink">{user.name}</p>
              <p className="font-mono text-[10.5px] text-faint">{t("m.member")} {user.createdAt} · {user.active ? t("a.active") : "inactive"}</p>
            </div>
            {isSuper && <Chip tone="amber"><Settings2 size={10} /> root</Chip>}
          </div>
          <Field label={t("a.fullName")}><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t("a.email")}><input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isSuper} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("a.empId")}><input className="inp font-mono" value={empId} onChange={(e) => setEmpId(e.target.value)} disabled={isSuper} /></Field>
            <Field label={t("a.department")}>
              <select className="inp" value={dept} onChange={(e) => setDept(e.target.value as Department)}>
                {DEPTS.map((d) => <option key={d}>{d}</option>)}
                {!(DEPTS as string[]).includes(user.department) && <option>{user.department}</option>}
              </select>
            </Field>
          </div>
          <Field label={t("a.role")} hint={isSuper ? t("a.superLocked") : undefined}>
            <div className="flex gap-2">
              {(["staff", "admin"] as Role[]).map((r) => (
                <button key={r} disabled={isSuper} onClick={() => setRole(r)}
                  className={`tap ttl flex-1 rounded-lg border px-2 py-2 text-[12.5px] font-bold disabled:opacity-35 ${role === r ? "border-amber/60 bg-amber/12 text-amber" : "border-line bg-panel2 text-mut"}`}>{r}</button>
              ))}
            </div>
          </Field>
          <Btn className="w-full" onClick={async () => {
            try { await updateProfileRemote({ id: user.id, name, email, employeeId: empId, role: isSuper ? "superadmin" : role, department: dept }); await refreshProductionData(); await onSaved(); toast(`${name}'s account updated.`, "ok"); onClose(); }
            catch (error) { toast(error instanceof Error ? error.message : "Could not update account", "err"); }
          }}><Check size={15} /> {t("a.updateUser")}</Btn>
        </div>
      )}
    </Sheet>
  );
}

/* ---------------- evidence photo gallery ---------------- */
type Evidence = { id: string; src: string; kind: "piket" | "ot"; who: string; label: string; date: string; time: string };

function PhotosPanel() {
  const db = getDB();
  const t = useT();
  const [filter, setFilter] = useState<"all" | "piket" | "ot">("all");
  const [view, setView] = useState<Evidence | null>(null);

  const ev = useMemo<Evidence[]>(() => {
    if (!db) return [];
    const pik: Evidence[] = db.piketLog.filter((l) => l.proof).map((l) => {
      const task = db.tasks.find((x) => x.id === l.taskId);
      return { id: "p-" + l.id, src: l.proof!, kind: "piket", who: userName(l.userId), label: task?.name ?? "Piket", date: l.date, time: fmtTime(l.doneAt) };
    });
    const ots: Evidence[] = db.ot.filter((o) => o.photo).map((o) => ({
      id: "o-" + o.id, src: o.photo!, kind: "ot", who: userName(o.userId), label: t("o.title"), date: o.date, time: o.start,
    }));
    return [...pik, ...ots].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [db, t]);

  if (!db) return null;
  const list = ev.filter((e) => filter === "all" || e.kind === filter);

  return (
    <div className="a-fadein space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="ttl text-[15px] font-bold text-ink">{t("a.photoGallery")}</p>
          <p className="font-mono text-[10.5px] text-faint">{ev.length} {t("a.photos").toLowerCase()} · {t("a.photoHint")}</p>
        </div>
        <Seg small value={filter} onChange={setFilter} options={[
          { id: "all", label: t("a.galleryAll") }, { id: "piket", label: t("a.galleryPiket") }, { id: "ot", label: t("a.galleryOt") },
        ]} />
      </div>

      {list.length === 0 ? (
        <Empty icon={<ImageIcon size={26} />} title={t("a.noPhotos")} sub={t("a.noPhotosSub")} />
      ) : (
        <div className="columns-2 gap-2.5">
          {list.map((e) => (
            <button key={e.id} onClick={() => setView(e)}
              className="tap group relative mb-2.5 block w-full break-inside-avoid overflow-hidden rounded-xl border border-line bg-panel2 text-left">
              <img src={e.src} alt={e.label} loading="lazy"
                className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                style={{ aspectRatio: e.kind === "piket" ? "4/3" : "16/10" }} />
              <span className="absolute left-2 top-2">
                <Chip tone={e.kind === "piket" ? "amber" : "cool"}>
                  {e.kind === "piket" ? <ClipboardList size={10} /> : <Clock3 size={10} />} {t(e.kind === "piket" ? "a.galleryPiket" : "a.galleryOt")}
                </Chip>
              </span>
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 pb-2 pt-6">
                <span className="block truncate text-[11.5px] font-semibold text-white">{e.label}</span>
                <span className="block truncate font-mono text-[9.5px] text-white/65">{e.who} · {fmtDate(e.date)} {e.time}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <Lightbox src={view?.src ?? null} onClose={() => setView(null)}
        caption={view ? `${view.label} · ${view.who} · ${fmtDate(view.date)} ${view.time}` : undefined} />
    </div>
  );
}

function genPw() {
  const c = "abcdefghjkmnpqrstuvwxyz23456789";
  return "wms-" + Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

/* ---------------- announcements ---------------- */
function NoticePanel({ admin }: { admin: User }) {
  const db = getDB();
  const t = useT();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  if (!db) return null;
  const list = [...db.announcements].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));
  return (
    <div className="a-fadein space-y-3">
      <div className="card space-y-3 p-4">
        <Field label={t("a.titleL")}><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Forklift maintenance — Friday" /></Field>
        <Field label={t("a.message")}>
          <textarea className="inp min-h-[68px] resize-none" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Broadcast to every device on the floor…" />
        </Field>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[12.5px] text-mut"><Toggle on={pinned} onChange={setPinned} /> {t("a.pinDash")}</label>
          <Btn onClick={async () => {
            if (!title.trim() || !body.trim()) { toast("Title and message required", "err"); return; }
            try { await createAnnouncement({ title: title.trim(), body: body.trim(), authorId: admin.id, pinned }); await refreshProductionData(); toast("Broadcast sent to all staff"); setTitle(""); setBody(""); setPinned(false); }
            catch (error) { toast(error instanceof Error ? error.message : "Could not send announcement", "err"); }
          }}><Megaphone size={14} /> {t("a.broadcast")}</Btn>
        </div>
      </div>

      {list.length === 0 ? (
        <Empty icon={<Megaphone size={26} />} title={t("a.noAnn")} sub={t("a.noAnnSub")} />
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className="card p-3.5">
              <div className="flex items-center gap-2">
                {a.pinned && <Chip tone="amber">{t("a.pinned")}</Chip>}
                <span className="font-mono text-[10px] text-faint">{a.date} · {a.author}</span>
                <button onClick={async () => { try { await deleteAnnouncementRemote(a.id); await refreshProductionData(); toast("Removed", "info"); } catch (error) { toast(error instanceof Error ? error.message : "Could not remove announcement", "err"); } }}
                  className="tap ml-auto rounded-lg border border-line bg-panel2 p-1.5 text-faint hover:text-bad" aria-label="Delete"><Trash2 size={13} /></button>
              </div>
              <p className="ttl mt-1.5 text-[15px] font-bold text-ink">{a.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-mut">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
/* ------------ warehouse shift creator ------------ */
function ShiftsPanel({ admin }: { admin: User }) {
  const db = getDB();
  const t = useT();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [profiles, setProfiles] = useState<User[]>([admin]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [editUser, setEditUser] = useState<User | null>(null);

  useEffect(() => {
    workspaceProfiles().then(setProfiles).catch((error) => toast(error instanceof Error ? error.message : "Could not load staff", "err")).finally(() => setLoadingProfiles(false));
  }, []);

  if (!db) return null;

  const getDisplayShift = (u: User) => {
    if (u.shiftStart && u.shiftEnd) return `${u.shiftStart} — ${u.shiftEnd}`;
    if (u.shiftStart) {
      const start = u.shiftStart.split(":").map(Number);
      const end = new Date(2000, 0, 1, start[0] + 9, start[1]);
      const endStr = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
      return `${u.shiftStart} — ${endStr}`;
    }
    return `Default (${db.settings.lateTime} — +9h)`;
  };

  return (
    <div className="a-fadein space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[11px] uppercase tracking-widest text-faint">{profiles.length} {t("a.accounts")} · {profiles.filter((u) => u.shiftStart).length} custom shifts</p>
          <SaveBadge state={saveState} />
        </div>
      </div>
      <div className="space-y-2">
        {loadingProfiles ? <div className="card p-4 text-center font-mono text-[11px] text-faint">Loading staff…</div> : profiles.map((u) => (
          <div key={u.id} className="card flex items-center gap-3 p-3">
            <Avatar user={u} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[13.5px] font-semibold text-ink">{u.name}</p>
                <Chip tone={u.shiftStart ? "cool" : "mut"} className="text-[10px]">
                  <Clock3 size={10} className="mr-1" /> {getDisplayShift(u)}
                </Chip>
              </div>
              <p className="mt-0.5 truncate font-mono text-[10.5px] text-faint">{u.employeeId} · {u.department}</p>
            </div>
            <button onClick={() => setEditUser(u)} className="tap rounded-lg border border-line bg-panel2 p-2 text-mut hover:border-cool/50 hover:text-cool" aria-label="Edit shift">
              <Pencil size={13} />
            </button>
          </div>
        ))}
      </div>
      <ShiftEditorSheet
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={async () => {
          setSaveState("saved");
          window.setTimeout(() => setSaveState("idle"), 1200);
          setProfiles(await workspaceProfiles());
        }}
      />
    </div>
  );
}

/* ------------ shift editor modal ------------ */
function ShiftEditorSheet({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const db = getDB();
  const t = useT();
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setShiftStart(user.shiftStart || "");
      setShiftEnd(user.shiftEnd || "");
    }
  }, [user]);

  if (!db || !user) return null;

  const handleAutoCalcEnd = (start: string) => {
    if (!start) {
      setShiftEnd("");
      return;
    }
    const [h, m] = start.split(":").map(Number);
    const endDate = new Date(2000, 0, 1, h + 9, m);
    const endStr = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
    setShiftEnd(endStr);
  };

  const handleSave = async () => {
    try {
      // save state is managed by the parent panel through refresh callbacks
      setSaving(true);
      await updateProfileShiftRemote(user.id, shiftStart || null, shiftEnd || null);
      updateUserShift(user.id, shiftStart || null, shiftEnd || null);
      await refreshProductionData();
      await onSaved();
      toast(`${user.name}'s shift updated.`, "ok");
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update shift", "err");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      // save state is managed by the parent panel through refresh callbacks
      setSaving(true);
      await updateProfileShiftRemote(user.id, null, null);
      updateUserShift(user.id, null, null);
      await refreshProductionData();
      await onSaved();
      toast(`${user.name}'s shift reset to default.`, "ok");
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not reset shift", "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={!!user} onClose={onClose} title={`${user.name} — Shift Creator`}>
      <div className="space-y-4">
        <div className="card2 flex items-center gap-3 p-3">
          <Avatar user={user} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-ink">{user.name}</p>
            <p className="font-mono text-[10.5px] text-faint">{user.employeeId} · {user.department}</p>
          </div>
        </div>

        <div className="rounded-lg border border-line/60 bg-panel2/50 p-3">
          <p className="text-[11px] text-faint mb-2">Current Shift</p>
          <p className="font-mono text-[12px] text-ink font-semibold">
            {shiftStart && shiftEnd ? `${shiftStart} — ${shiftEnd}` : shiftStart ? `${shiftStart} — (auto +9h)` : "Default workspace baseline"}
          </p>
          <p className="text-[10px] text-faint mt-1">Default: {db.settings.lateTime} — +9 hours</p>
        </div>

        <Field label="Shift Start Time (HH:MM)">
          <div className="flex gap-2">
            <input
              type="time"
              className="inp flex-1"
              value={shiftStart}
              onChange={(e) => {
                setShiftStart(e.target.value);
                handleAutoCalcEnd(e.target.value);
              }}
            />
            <Btn variant="ghost" onClick={() => { setShiftStart(""); setShiftEnd(""); }} disabled={!shiftStart} title="Clear start time">
              <X size={14} />
            </Btn>
          </div>
        </Field>

        <Field label="Shift End Time (HH:MM)">
          <input
            type="time"
            className="inp"
            value={shiftEnd}
            onChange={(e) => setShiftEnd(e.target.value)}
            disabled={!shiftStart}
            placeholder="Auto-calculated (start + 9h) if not set"
          />
        </Field>

        <p className="text-[10px] text-faint leading-relaxed">
          Set a custom daily shift window for this employee. If left blank, the system will use the default workspace late time and add 9 hours. This shift baseline is used for attendance validation and overtime calculations.
        </p>

        <div className="flex gap-2">
          <Btn className="flex-1" busy={saving} onClick={handleSave} disabled={!shiftStart}>
            <Check size={15} /> {user.shiftStart ? "Update Shift" : "Create Shift"}
          </Btn>
          {user.shiftStart && (
            <Btn variant="ghost" tone="bad" busy={saving} onClick={handleClear} className="flex-1">
              <Trash2 size={14} /> Reset to Default
            </Btn>
          )}
        </div>
      </div>
    </Sheet>
  );
}
/* ---------------- supabase deploy ---------------- */
const MIGRATIONS = [
  "verify project credentials …", "check workspace schema …", "initialize Supabase client …",
];

function CloudPanel() {
  const db = getDB();
  const t = useT();
  const supa = db?.settings.supabase;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [migStep, setMigStep] = useState(-1);
  const [testing, setTesting] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [schemaReady, setSchemaReady] = useState(false);
  const migStarted = useRef(false);

  useEffect(() => {
    if (step !== 2 || migStarted.current) return;
    migStarted.current = true;
    let cancelled = false;
    (async () => {
      // Step 1: Test connection
      setMigStep(0);
      const connTest = await testSupabaseConnection(url, key);
      if (!connTest.success && !cancelled) {
        toast(connTest.error || "Connection failed", "err");
        setStep(1);
        migStarted.current = false;
        setMigStep(-1);
        return;
      }
      if (cancelled) return;
      
      setSchemaReady(connTest.schemaReady);

      // The anon key cannot execute DDL. Schema installation must be run in
      // Supabase SQL Editor, then verified from this screen.
      setMigStep(1);
      await wait(500);
      setMigStep(2);
      initSupabase(url, key);
      await wait(300);
      
      if (!cancelled) window.setTimeout(() => !cancelled && setStep(3), 350);
    })();
    return () => { cancelled = true; migStarted.current = false; };
  }, [step, url, key]);

  if (!db || !supa) return null;

  // connected state
  if (supa.status === "connected") {
    return (
      <div className="a-fadein space-y-3">
        <div className="card relative overflow-hidden p-4">
          <div className="absolute inset-x-0 top-0 h-1 bg-ok" />
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ok/12 text-ok"><Cloud size={20} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="ttl text-[15px] font-bold text-ink">{t("dp.connected")}</p>
                <LiveDot />
              </div>
              <p className="truncate font-mono text-[11px] text-faint">{supa.url}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="card2 px-3 py-2"><p className="text-faint">connected</p><p className="mt-0.5 text-ink">{supa.connectedAt ? relTime(supa.connectedAt) : "—"}</p></div>
            <div className="card2 px-3 py-2"><p className="text-faint">{t("dp.lastSync").toLowerCase()}</p><p className="mt-0.5 text-ink">{supa.lastSync ? relTime(supa.lastSync) : "never"}</p></div>
          </div>
          <div className="mt-3 space-y-2">
            <p className="rounded-lg border border-amber/30 bg-amber/8 px-3 py-2 font-mono text-[10.5px] leading-relaxed text-mut">
              Cloud credentials are saved, but application data is not synchronized yet. Do not use this deployment for production attendance until the Supabase data layer is enabled.
            </p>
            <Btn variant="ghost" className="w-full" onClick={() => setConfirmOff(true)}><LogOut size={14} /> {t("dp.disconnect")}</Btn>
          </div>
        </div>

        <div className="card p-4">
          <button onClick={() => setShowSql((s) => !s)} className="flex w-full items-center justify-between text-left">
            <SectionTitle>{t("dp.schema")}</SectionTitle>
            {showSql ? <ChevronUp size={15} className="text-faint" /> : <ChevronDown size={15} className="text-faint" />}
          </button>
          {showSql && (
            <div className="a-fadein mt-2">
              <p className="mb-2 font-mono text-[11px] text-faint">Schema is managed through the Supabase migrations in this repository:</p>
              <pre className="no-scrollbar max-h-56 overflow-auto rounded-xl border border-line bg-[#0b0e12] p-3 font-mono text-[10.5px] leading-relaxed text-[#9fb3c8]">001_production_foundation.sql\n002_feature_domains.sql\n003_workspace_settings_write.sql</pre>
              <Btn variant="ghost" className="mt-2 w-full" onClick={async () => { 
                const sql = "Run `npx supabase db push` from the project root to apply the checked-in migrations.";
                navigator.clipboard?.writeText(sql).catch(() => {}); 
                toast("SQL instructions copied"); 
              }}><Copy size={13} /> {t("dp.copy")}</Btn>
            </div>
          )}
        </div>
        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint">local store = offline cache · RLS enforced per role</p>

        <Confirm open={confirmOff} onClose={() => setConfirmOff(false)} danger title={t("dp.disconnect") + "?"}
          body="The workspace returns to local-only mode. No data is lost." yesLabel={t("dp.disconnect")}
          onYes={() => { disconnectSupabase(); toast("Disconnected", "info"); }} />
      </div>
    );
  }

  // wizard
  return (
    <div className="a-fadein space-y-3">
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cool/12 text-cool"><Globe size={20} /></span>
          <div>
            <p className="ttl text-[16px] font-bold text-ink">{t("dp.title")}</p>
            <p className="font-mono text-[10.5px] uppercase tracking-widest text-faint">production deployment</p>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-mut">{t("dp.body")}</p>
        {/* steps */}
        <div className="mt-3 flex items-center gap-1.5">
          {([t("dp.step1"), t("dp.step2"), t("dp.step3")] as const).map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1 rounded-full ${step > i ? "bg-cool" : "bg-line"}`} />
              <p className={`ttl mt-1 text-[9.5px] font-bold ${step === i + 1 ? "text-cool" : "text-faint"}`}>{i + 1}. {s}</p>
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="card space-y-3.5 p-4">
          <Field label={t("dp.url")}>
            <input className="inp font-mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xyzcompany.supabase.co" />
          </Field>
          <Field label={t("dp.key")}>
            <input className="inp font-mono" value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIs…" />
          </Field>
          <Btn className="w-full" onClick={() => {
            if (!/^https:\/\/[\w-]+\.supabase\.co$/.test(url.trim())) { toast(t("dp.invalid"), "err"); return; }
            if (key.trim().length < 12) { toast("Anon key looks too short", "err"); return; }
            setStep(2);
          }}>{t("dp.next")} →</Btn>
        </div>
      )}

      {step === 2 && (
        <div className="card p-4">
          <p className="ttl text-[14px] font-bold text-ink">{t("dp.migrating")}</p>
          <ul className="mt-3 space-y-2">
            {MIGRATIONS.map((m, i) => (
              <li key={m} className="flex items-center gap-2.5 font-mono text-[11.5px]">
                {migStep > i ? <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ok/20 text-ok"><Check size={10} /></span>
                  : migStep === i ? <Loader2 size={13} className="animate-spin text-cool" />
                  : <span className="h-[13px] w-[13px] rounded-full border border-line" />}
                <span className={migStep >= i ? "text-ink" : "text-faint"}>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-3.5 p-4">
          <div className="card2 flex items-center justify-between px-3.5 py-3">
            <div>
              <p className="font-mono text-[11px] text-faint">{t("dp.url")}</p>
              <p className="truncate font-mono text-[12px] text-ink">{url}</p>
            </div>
            <Chip tone="cool">v1 schema</Chip>
          </div>
          <Btn variant="ghost" className="w-full" busy={testing} onClick={async () => {
            setTesting(true);
            const result = await testSupabaseConnection(url, key);
            setTesting(false);
            if (result.success) {
              setSchemaReady(result.schemaReady);
              toast(result.schemaReady ? `Connection OK · schema ready` : `Project reachable · schema not installed`, result.schemaReady ? "ok" : "info");
            } else {
              toast(result.error || "Connection failed", "err");
            }
          }}><Activity size={14} /> {testing ? t("dp.testing") : t("dp.test")}</Btn>
          {!schemaReady && <p className="rounded-lg border border-amber/30 bg-amber/8 px-3 py-2 text-[11.5px] leading-relaxed text-mut">The project is reachable, but the production workspace schema is not ready. Apply the checked-in migrations, then test again.</p>}
          <Btn className="w-full" disabled={!schemaReady} onClick={() => { connectSupabase(url.trim(), key.trim()); toast(`${t("dp.connected")} ✓`, "ok"); }}>
            <Cloud size={15} /> {t("dp.saveConnect")}
          </Btn>
          <button onClick={() => { setStep(1); migStarted.current = false; setMigStep(-1); }} className="tap w-full text-center font-mono text-[11px] text-faint hover:text-mut">← {t("c.back")}</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- config ---------------- */
function ConfigPanel() {
  const db = getDB();
  const t = useT();
  const [confirmSetup, setConfirmSetup] = useState(false);
  const [geofenceOpen, setGeofenceOpen] = useState(false);
  if (!db) return null;
  const s = db.settings;
  return (
    <div className="a-fadein space-y-3">
      <SectionTitle><span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-amber" /> {t("a.geo")}</span></SectionTitle>
      <div className="card space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-ink">{t("a.geofenceEditor")}</p>
            <p className="font-mono text-[10.5px] text-faint">{s.lat.toFixed(6)}, {s.lng.toFixed(6)} · R: {s.radius}m</p>
          </div>
          <Btn variant="primary" onClick={() => setGeofenceOpen(true)}><MapPin size={14} /> {t("a.editGeo")}</Btn>
        </div>
        <Field label={`${t("a.radius")} — ${s.radius} m`}>
          <input type="range" min={50} max={500} step={10} value={s.radius} onChange={(e) => updateSettings({ radius: Number(e.target.value) })} className="w-full accent-[var(--amber)]" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("a.lateThresh")} hint={t("a.lateHint")}>
            <input className="inp w-full font-mono" type="time" value={s.lateTime} onChange={(e) => e.target.value && updateSettings({ lateTime: e.target.value })} />
          </Field>
          <Field label={t("a.otRate")} hint={fmtIDRFull(s.otRate)}>
            <input className="inp w-full font-mono" type="number" step={1000} min={0} value={s.otRate} onChange={(e) => updateSettings({ otRate: Math.max(0, Number(e.target.value)) })} />
          </Field>
        </div>

        <div className="border-t border-line2 pt-4">
          <p className="ttl text-[12px] font-bold text-ink mb-3">⏰ Shift Creator Settings</p>
          <div className="space-y-3">
            <Field label="Default Shift Duration (hours)" hint="When only start time is set">
              <input className="inp w-full font-mono" type="number" step={0.5} min={1} max={24} value={s.defaultShiftDuration || 9} onChange={(e) => { const val = Number(e.target.value); if (!isNaN(val)) updateSettings({ defaultShiftDuration: val }); }} />
            </Field>
            <Field label="OT Alert Threshold (minutes)" hint="Notify staff if working N minutes past shift">
              <input className="inp w-full font-mono" type="number" step={5} min={0} max={480} value={s.otAlertThreshold || 30} onChange={(e) => { const val = Number(e.target.value); if (!isNaN(val)) updateSettings({ otAlertThreshold: val }); }} />
            </Field>
            <div className="flex items-center gap-2.5">
              <input type="checkbox" id="autoLogOT" checked={s.autoLogOT || false} onChange={(e) => updateSettings({ autoLogOT: e.target.checked })} className="w-4 h-4 accent-amber" />
              <label htmlFor="autoLogOT" className="text-[12.5px] font-medium text-ink cursor-pointer">Auto-log OT if working more than 60 minutes past shift</label>
            </div>
          </div>
        </div>

        <p className="font-mono text-[10.5px] text-faint">ℹ {t("a.piketPtsHint")}</p>
      </div>

      <SectionTitle><span className="inline-flex items-center gap-1.5"><Settings2 size={14} className="text-amber" /> {t("a.appearance")}</span></SectionTitle>
      <div className="card divide-y divide-line2">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            {s.theme === "dark" ? <Moon size={15} className="text-cool" /> : <Sun size={15} className="text-amber" />}
            <div>
              <p className="text-[13px] font-semibold text-ink">{t("a.night")}</p>
              <p className="font-mono text-[10.5px] text-faint">{s.theme === "dark" ? t("a.darkOn") : t("a.darkOff")}</p>
            </div>
          </div>
          <Toggle on={s.theme === "dark"} onChange={(v) => updateSettings({ theme: v ? "dark" : "light" })} />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Globe size={15} className="text-amber" />
            <p className="text-[13px] font-semibold text-ink">{t("a.lang")}</p>
          </div>
          <Seg small options={[{ id: "en", label: "English" }, { id: "id", label: "Indonesia" }]}
            value={s.language} onChange={(v) => updateSettings({ language: v as Lang })} />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Database size={15} className="text-ok" />
            <div>
              <p className="text-[13px] font-semibold text-ink">{t("a.localData")}</p>
              <p className="font-mono text-[10.5px] text-faint">{t("a.localHint")}</p>
            </div>
          </div>
          <Chip tone={s.supabase.status === "connected" ? "cool" : "ok"}>{s.supabase.status === "connected" ? "cloud+local" : t("a.synced")}</Chip>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <RefreshCw size={15} className="text-faint" />
            <p className="text-[13px] font-semibold text-ink">{t("a.rerun")}</p>
          </div>
          <Btn variant="ghost" className="!px-3 !py-1.5 text-[12px]" onClick={() => setConfirmSetup(true)}>{t("a.restart")}</Btn>
        </div>
      </div>
      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint">
        {s.appName} · {s.company} · {s.siteName}
      </p>

      <Confirm open={confirmSetup} onClose={() => setConfirmSetup(false)} danger
        title={t("a.rerunQ")} body={t("a.rerunBody")} yesLabel={t("a.wipe")} onYes={() => rerunSetup()} />
      <GeofenceStudio open={geofenceOpen} onClose={() => setGeofenceOpen(false)} />
    </div>
  );
}

/* ---------------- manual points ---------------- */
function PointsPanel({ admin }: { admin: User }) {
  const db = getDB();
  const t = useT();
  const [targetUser, setTargetUser] = useState("");
  const [delta, setDelta] = useState(5);
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<NonNullable<import("../types").PointEvent["category"]>>("bonus");
  if (!db) return null;
  const staff = db.users.filter((u) => u.active);
  const selected = db.users.find((u) => u.id === targetUser);
  const recent = db.pointEvents.slice(0, 12);

  return (
    <div className="a-fadein space-y-3">
      <div className="card p-4 space-y-3">
        <div>
          <p className="ttl text-[15px] font-bold text-ink">Manual point adjustment</p>
          <p className="font-mono text-[10.5px] text-faint">Reward staff, correct mistakes, and keep the reason in the ledger.</p>
        </div>

        <Field label="Staff user">
          <select className="inp" value={targetUser} onChange={(e) => setTargetUser(e.target.value)}>
            <option value="">Select staff</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>{u.name} · {u.department}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Points (+ / -)"><input className="inp font-mono" type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} /></Field>
          <Field label="Category">
            <select className="inp" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              <option value="attendance">Attendance</option>
              <option value="piket">Piket</option>
              <option value="initiative">Initiative</option>
              <option value="quality">Quality</option>
              <option value="bonus">Bonus</option>
              <option value="discipline">Discipline</option>
              <option value="reward">Reward</option>
            </select>
          </Field>
        </div>

        <Field label="Label"><input className="inp" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Excellent problem report" /></Field>
        <Field label="Reason"><textarea className="inp min-h-[72px] resize-none" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this adjustment is being made" /></Field>

        <Btn className="w-full" onClick={async () => {
          if (!targetUser) { toast("Select a staff user", "err"); return; }
          if (!label.trim() || !reason.trim()) { toast("Label and reason are required", "err"); return; }
          if (!delta || Number.isNaN(delta)) { toast("Points cannot be zero", "err"); return; }
            let result;
            try {
              await addPointEventRemote({ userId: targetUser, delta, label: label.trim(), reason: reason.trim(), adminId: admin.id, category });
              result = { ok: true, msg: `${delta > 0 ? "+" : ""}${delta} pts saved to Supabase.` };
            } catch (e: any) {
              console.error("Supabase manual point insert failed, trying local fallback", e);
              result = addPointEventLocal({ userId: targetUser, delta, label: label.trim(), reason: reason.trim(), adminId: admin.id, category });
            }
          if (!result.ok) { toast(result.msg, "err"); return; }
          await refreshProductionData();
          toast(result.msg, "ok");
          setLabel("");
          setReason("");
          setDelta(5);
        }}><Plus size={15} /> Save point event</Btn>

        {selected && <p className="font-mono text-[10.5px] text-faint">Target: {selected.name} · current balance {selected.points} pts</p>}
      </div>

      <div className="card p-4">
        <SectionTitle>Recent point activity</SectionTitle>
        <div className="space-y-2">
          {recent.map((p) => {
            const u = db.users.find((x) => x.id === p.userId);
            return (
              <div key={p.id} className="card2 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">{p.label}</p>
                    <p className="font-mono text-[10.5px] text-faint">{u?.name ?? p.userId} · {p.source ?? "auto"}{p.category ? ` · ${p.category}` : ""}</p>
                    {p.reason && <p className="mt-0.5 text-[11.5px] leading-relaxed text-mut">{p.reason}</p>}
                  </div>
                  <span className={`font-mono text-[13px] font-semibold ${p.delta > 0 ? "text-ok" : "text-bad"}`}>{p.delta > 0 ? "+" : ""}{p.delta}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SmtpPanel() {
  const [host, setHost] = useState("smtp.gmail.com");
  const [port, setPort] = useState(587);
  const [userName, setUserName] = useState("");
  const [pass, setPass] = useState("");
  const [sender, setSender] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const { productionClient } = await import("../lib/production");
        const client = productionClient();
        if (!client) return;
        const { data } = await client.from("smtp_settings").select("*").maybeSingle();
        if (data) {
          setHost(data.host ?? "smtp.gmail.com");
          setPort(data.port ?? 587);
          setUserName(data.user_name ?? "");
          setPass(data.pass_encrypted ?? "");
          setSender(data.sender ?? "");
        }
      } finally { setLoading(false); }
    })();
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      const { productionClient } = await import("../lib/production");
      const client = productionClient();
      if (!client) throw new Error("Supabase not configured");
      const { data: { user } } = await client.auth.getUser();
      const ws = await client.from("profiles").select("workspace_id").eq("id", user!.id).maybeSingle();
      const wid = (ws.data as any)?.workspace_id;
      if (!wid) throw new Error("Workspace not found");
      const cleanPass = pass.replace(/\s/g, "");
      if (cleanPass.length < 16) throw new Error("App Password must be 16 chars (no spaces)");
      const { error } = await client.from("smtp_settings").upsert({ workspace_id: wid, host: host.trim(), port, user_name: userName.trim(), pass_encrypted: cleanPass, sender: sender.trim(), updated_at: new Date().toISOString(), updated_by: user!.id }, { onConflict: "workspace_id" });
      if (error) throw new Error(error.message);
      toast("SMTP saved — now Test", "ok");
    } catch (e) { toast(e instanceof Error ? e.message : "Could not save SMTP", "err"); }
    finally { setSaving(false); }
  };
  const test = async () => {
    setTesting(true);
    try {
      const { productionClient } = await import("../lib/production");
      const client = productionClient();
      if (!client) throw new Error("Supabase not configured");
      const { data, error } = await client.functions.invoke("send-gmail-test", { body: { to: userName.trim() } });
      if (error) {
        const msg = (data as any)?.error || error.message || "Edge error";
        throw new Error(msg);
      }
      toast((data as any)?.message ?? "Test email queued via Gmail", "ok");
    } catch (e) { toast(e instanceof Error ? e.message : "Test failed - check Gmail App Password", "err"); }
    finally { setTesting(false); }
  };
  if (loading) return <div className="card p-4 font-mono text-[11px] text-faint">Loading SMTP…</div>;
  return (
    <div className="a-fadein space-y-3">
      <div className="card p-4">
        <p className="ttl text-[13px] font-bold text-ink">Gmail SMTP — Super Admin only</p>
        <p className="mt-1 font-mono text-[10.5px] text-faint">Host smtp.gmail.com:587 • App Password 16-char • Sender noreply@</p>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Host"><input className="inp font-mono" value={host} onChange={(e) => setHost(e.target.value)} /></Field>
            <Field label="Port"><input className="inp font-mono" type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} /></Field>
          </div>
          <Field label="Gmail User"><input className="inp font-mono" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="warehouse@gmail.com" /></Field>
          <Field label="App Password (16-char)"><input className="inp font-mono" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="abcd efgh ijkl mnop" /></Field>
          <Field label="Sender"><input className="inp font-mono" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="noreply@shiftgate.warehouse" /></Field>
          <div className="flex gap-2">
            <Btn className="flex-1" busy={saving} onClick={save}><Check size={14} /> Save SMTP</Btn>
            <Btn variant="ghost" className="flex-1" busy={testing} onClick={test}><Send size={14} /> Test</Btn>
          </div>
          <p className="font-mono text-[10px] text-faint">Get App Password: myaccount.google.com → Security → 2-Step → App passwords → smtp 16-char. Forgot + Admin Reset will use this Gmail.</p>
        </div>
      </div>
    </div>
  );
}
