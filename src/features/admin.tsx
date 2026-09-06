import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Camera, Check, ChevronDown, ChevronUp, ClipboardList, Clock3, Cloud, Copy, Database,
  Download, Globe, Image as ImageIcon, Loader2, LogOut, MapPin, Megaphone, Moon, Pencil, Plus,
  Radio, RefreshCw, ScanFace, Settings2, Sun, Trash2, UserPlus, Users, X,
} from "lucide-react";
import type { Lang, Role, User } from "../types";
import {
  addAnnouncement, addPointEvent, connectSupabase, deleteAnnouncement, disconnectSupabase, enrollFace,
    getDB, manualLog, rerunSetup, reviewSelfReport, addPointEventLocal,
  toggleActive, updateSettings, updateUser, userName,
} from "../lib/store";
import { downloadCSV, fmtDate, fmtIDRFull, fmtTime, relTime, todayKey, wait } from "../lib/util";
import { useT } from "../lib/i18n";
import { Avatar, Btn, Chip, Confirm, Empty, Field, LiveDot, SectionTitle, Seg, Sheet, Toggle, toast } from "../components/ui";
import { Lightbox } from "../components/capture";
import { FeedbackInbox } from "./feedback";
import { GeofenceStudio } from "./geofence";

function FloorRadar({ onDutyIds }: { onDutyIds: string[] }) {
  const db = getDB();
  const t = useT();
  if (!db) return null;
  const { radius } = db.settings;

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
          <circle cx="0" cy="0" r="135" fill="url(#radarGrad)">
            <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="8s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r={radius * 0.3} fill="var(--amber)" fillOpacity="0.08" stroke="var(--amber)" strokeWidth="2" strokeDasharray="6 4" />
          <circle cx="0" cy="0" r="5" fill="var(--amber)" />
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
                      {u.department} · in {fmtTime(r.checkIn)}{r.checkOut ? ` · out ${fmtTime(r.checkOut)}` : " · on floor"}
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
            try { await manualAttendanceRemote({ userId: mUser, date: mDate, checkIn: mIn, checkOut: mOut || undefined, late: mIn > db.settings.lateTime }); await refreshProductionData(); toast(`Saved for ${userName(mUser)}`); setShowManual(false); }
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
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState(DEPTS[0]);
  const [role, setRole] = useState<Role>("staff");
  const [pw, setPw] = useState(genPw());
  const [saving, setSaving] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
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
    const res = await createStaffAccount({ name: name.trim(), email: email.trim(), employeeId: nextId, role: role === "admin" ? "admin" : "staff", department: dept, password: pw });
    setSaving(false);
    if (!res.ok) { toast(res.message, "err"); return; }
    if (res.profile) setProfiles((current) => [...current, res.profile!]);
    toast(`${res.message} Login credentials are ready.`, "ok");
    setShowAdd(false); setName(""); setEmail(""); setPw(genPw());
  };

  return (
    <div className="a-fadein space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-faint">{profiles.length} {t("a.accounts")} · {profiles.filter((u) => u.active).length} {t("a.active")}</p>
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
              <select className="inp" value={dept} onChange={(e) => setDept(e.target.value)}>
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
    </div>
  );
}

/* ---------------- edit existing account ---------------- */
function EditUserSheet({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const db = getDB();
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [empId, setEmpId] = useState("");
  const [dept, setDept] = useState(DEPTS[0]);
  const [role, setRole] = useState<Role>("staff");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name); setEmail(user.email); setEmpId(user.employeeId);
      setDept(DEPTS.includes(user.department) ? user.department : DEPTS[0]);
      setRole(user.role);
      setShiftStart(user.shiftStart ?? db?.settings.lateTime ?? "08:00");
      setShiftEnd(user.shiftEnd ?? "17:00");
    }
  }, [user, db]);
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
              <select className="inp" value={dept} onChange={(e) => setDept(e.target.value)}>
                {DEPTS.map((d) => <option key={d}>{d}</option>)}
                {!DEPTS.includes(user.department) && <option>{user.department}</option>}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shift Start (HH:mm)"><input className="inp font-mono" type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} /></Field>
            <Field label="Shift End (HH:mm)"><input className="inp font-mono" type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} /></Field>
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
            try {
              await updateProfileRemote({ id: user.id, name, email, employeeId: empId, role: isSuper ? "superadmin" : role, department: dept });
              await updateProfileShiftRemote(user.id, shiftStart || null, shiftEnd || null);
              await refreshProductionData();
              await onSaved();
              toast(`${name}'s account updated.`, "ok");
              onClose();
            }
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
  /* ---------------- shifts and user-schedule assignments ---------------- */
  function ShiftsPanel({ admin }: { admin: User }) {
    const db = getDB();
    const t = useT();
    const [profiles, setProfiles] = useState<User[]>([admin]);
    const [loadingShifts, setLoadingShifts] = useState(true);
    const [editingShift, setEditingItem] = useState<{ id: string; name: string; start: string; end: string } | null>(null);

    const fetchProfiles = async () => {
      setLoadingShifts(true);
      try {
        const prs = await workspaceProfiles();
        setProfiles(prs);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not load shift profiles", "err");
      } finally {
        setLoadingShifts(false);
      }
    };

    useEffect(() => {
      void fetchProfiles();
    }, []);

    if (!db) return null;
    const supa = db.settings.supabase;

    return (
      <div className="a-fadein space-y-3">
        {/* Cloud Status Header Strip (Replacing massive CloudPanel) */}
        <div className="card flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${supa.status === "connected" ? "bg-ok/10 text-ok" : "bg-panel2 text-faint"}`}><Cloud size={16} /></span>
            <div>
              <p className="text-[12.5px] font-semibold text-ink">Cloud Data Status</p>
              <p className="font-mono text-[9px] text-faint truncate max-w-[20ch]">{supa.status === "connected" ? supa.url.replace("https://", "") : "Offline mode"}</p>
            </div>
          </div>
          <Chip tone={supa.status === "connected" ? "ok" : "amber"}>{supa.status === "connected" ? "Sync Armed" : "Local"}</Chip>
        </div>

        {/* Shift Creator description and list */}
        <div className="flex items-end justify-between px-1">
          <div>
            <p className="ttl text-[15px] font-bold text-ink">Shift Creator</p>
            <p className="font-mono text-[10.5px] text-faint">Determine custom clock-in/out and late thresholds per person.</p>
          </div>
        </div>

        {loadingShifts ? (
          <div className="card p-4 text-center font-mono text-[11px] text-faint">Loading shift plans…</div>
        ) : (
          <div className="space-y-2">
            {profiles.map((p) => {
              const start = p.shiftStart ?? db.settings.lateTime ?? "08:00";
              const end = p.shiftEnd ?? "17:00";
              return (
                <div key={p.id} className="card flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar user={p} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{p.name}</p>
                      <p className="font-mono text-[10.5px] text-faint">{p.employeeId} · {p.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono">
                      <p className="text-[13px] font-semibold text-ink">{start} – {end}</p>
                      <p className="text-[9.5px] text-ok uppercase tracking-wider">Custom Shift</p>
                    </div>
                    <button onClick={() => setEditingItem({ id: p.id, name: p.name, start, end })}
                      className="tap h-8 w-8 rounded-lg border border-line bg-panel2 flex items-center justify-center text-mut hover:text-amber hover:border-amber/50">
                      <Pencil size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Sheet open={!!editingShift} onClose={() => setEditingItem(null)} title="Configure Shift Interval">
          {editingShift && (
            <div className="space-y-4">
              <div className="card2 flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">{editingShift.name}</p>
                  <p className="font-mono text-[10.5px] text-faint">Setting individual operating hours overrides default thresholds</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Shift Start (Earliest In)">
                  <input className="inp font-mono" type="time" value={editingShift.start} onChange={(e) => setEditingItem({ ...editingShift, start: e.target.value })} />
                </Field>
                <Field label="Shift End (Auto Out)">
                  <input className="inp font-mono" type="time" value={editingShift.end} onChange={(e) => setEditingItem({ ...editingShift, end: e.target.value })} />
                </Field>
              </div>
              <div className="flex gap-2">
                <Btn variant="ghost" className="flex-1" onClick={() => {
                  // Reset to site settings defaults
                  setEditingItem({ ...editingShift, start: db.settings.lateTime, end: "17:00" });
                }}>Use Defaults</Btn>
                <Btn className="flex-1" onClick={async () => {
                  try {
                    await updateProfileShiftRemote(editingShift.id, editingShift.start, editingShift.end);
                    await refreshProductionData();
                    toast(`Shift parameters saved for ${editingShift.name}`);
                    setEditingItem(null);
                    void fetchProfiles();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Error saving shift", "err");
                  }
                }}><Check size={14} /> Save Shift</Btn>
              </div>
            </div>
          )}
        </Sheet>
      </div>
    );
  }
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
  const [confirmOff, setConfirmOff] = useState(false);
  if (!db) return null;
  const s = db.settings;
  const supa = s.supabase;
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
          <div className="flex items-center gap-2">
            {supa.status === "connected" && (
              <button onClick={() => setConfirmOff(true)} className="tap rounded-lg border border-line bg-panel2/60 px-2.5 py-1 font-mono text-[10px] text-bad uppercase hover:bg-bad/5">
                Disconnect
              </button>
            )}
            <Chip tone={s.supabase.status === "connected" ? "cool" : "ok"}>{s.supabase.status === "connected" ? "cloud+local" : t("a.synced")}</Chip>
          </div>
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
      <Confirm open={confirmOff} onClose={() => setConfirmOff(false)} danger title="Disconnect Supabase Sync?"
        body="The workspace will return to local-only first-run mode. No local credentials or cached punches will be compromised." yesLabel="Disconnect"
        onYes={() => { disconnectSupabase(); toast("Cloud synchronization disabled", "info"); }} />
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
