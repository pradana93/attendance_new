import { useMemo, useState } from "react";
import {
  Activity, Check, Clock3, Database, MapPin, Megaphone, Moon, Plus, Radio,
  RefreshCw, ScanFace, Settings2, Sun, Trash2, UserPlus, Users, X,
} from "lucide-react";
import type { Role, User } from "../types";
import {
  addAnnouncement, addStaff, deleteAnnouncement, enrollFace, getDB, manualLog,
  rerunSetup, resetDemoData, reviewSelfReport, toggleActive, updateSettings, updateShiftPoints, userName,
} from "../lib/store";
import { fmtTime, todayKey } from "../lib/util";
import { Avatar, Btn, Chip, Confirm, Empty, Field, LiveDot, SectionTitle, Seg, Sheet, Toggle, toast } from "../components/ui";

type Sec = "live" | "staff" | "notice" | "settings";
const DEPTS = ["Inbound", "Outbound", "Inventory", "Packing", "QA", "Forklift", "Operations"];

export default function Admin({ user }: { user: User }) {
  const db = getDB();
  const [sec, setSec] = useState<Sec>("live");
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
        options={[
          { id: "live", label: "Live" }, { id: "staff", label: "Staff" },
          { id: "notice", label: "Notice" }, { id: "settings", label: "Settings" },
        ]}
        value={sec} onChange={setSec}
      />
      {sec === "live" && <LiveBoard admin={user} />}
      {sec === "staff" && <StaffPanel admin={user} />}
      {sec === "notice" && <NoticePanel admin={user} />}
      {sec === "settings" && <SettingsPanel />}
    </div>
  );
}

/* ---------------- live board ---------------- */
function LiveBoard({ admin }: { admin: User }) {
  const db = getDB();
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
          <div className="flex items-center gap-1.5 text-ok"><LiveDot /><span className="ttl text-[10.5px] font-bold text-mut">On duty</span></div>
          <p className="mt-1.5 font-mono text-[22px] font-semibold leading-none text-ink">{onDuty.length}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 text-amber"><Clock3 size={12} /><span className="ttl text-[10.5px] font-bold text-mut">Checked in</span></div>
          <p className="mt-1.5 font-mono text-[22px] font-semibold leading-none text-ink">{rows.filter((r) => r.checkIn).length}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 text-bad"><Activity size={12} /><span className="ttl text-[10.5px] font-bold text-mut">Late</span></div>
          <p className="mt-1.5 font-mono text-[22px] font-semibold leading-none text-ink">{rows.filter((r) => r.late).length}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-mono text-[10.5px] uppercase tracking-widest text-faint">auto-refreshes · {today}</p>
        <div className="flex gap-2">
          <button onClick={() => setTick((t) => t + 1)} className="tap flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-2.5 py-1.5 font-mono text-[11px] text-mut hover:text-ink">
            <RefreshCw size={12} /> refresh
          </button>
          <Btn variant="ghost" className="!px-2.5 !py-1.5 text-[12px]" onClick={() => setShowManual(true)}><Plus size={13} /> Manual log</Btn>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty icon={<Radio size={26} />} title="Floor is quiet" sub="No attendance recorded yet today — it will appear here live." />
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
                      {u.department} · in {fmtTime(r.checkIn)}{r.checkOut ? ` · out ${fmtTime(r.checkOut)}` : " · still on floor"}
                      {r.distance ? ` · ${r.distance}m` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {r.inScore && <Chip tone="cool"><ScanFace size={10} />{r.inScore}%</Chip>}
                    <Chip tone={r.method === "manual" ? "mut" : r.method === "qr" ? "cool" : "ok"}>{r.method}</Chip>
                    {r.late && <Chip tone="bad">late</Chip>}
                  </div>
                </div>
                {r.selfReport && (
                  <div className="mt-2.5 flex gap-2 border-t border-line2 pt-2.5">
                    <Btn variant="ok" className="flex-1 !py-2 text-[12.5px]" onClick={() => { reviewSelfReport(r.id, true); toast(`Approved ${u.name}'s self-report`); }}><Check size={14} /> Approve</Btn>
                    <Btn variant="danger" className="flex-1 !py-2 text-[12.5px]" onClick={() => { reviewSelfReport(r.id, false); toast("Self-report rejected", "info"); }}><X size={14} /> Reject</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {selfReports.length > 0 && (
        <p className="text-center font-mono text-[11px] text-amber">{selfReports.length} self-report{selfReports.length > 1 ? "s" : ""} awaiting your review</p>
      )}

      {/* manual log */}
      <Sheet open={showManual} onClose={() => setShowManual(false)} title="Manual attendance override">
        <div className="space-y-3.5">
          <Field label="Employee">
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
          <Field label="Date"><input className="inp font-mono" type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check-in"><input className="inp font-mono" type="time" value={mIn} onChange={(e) => setMIn(e.target.value)} /></Field>
            <Field label="Check-out (optional)"><input className="inp font-mono" type="time" value={mOut} onChange={(e) => setMOut(e.target.value)} /></Field>
          </div>
          <Btn className="w-full" onClick={() => {
            if (!mUser) { toast("Pick an employee first", "err"); return; }
            manualLog(mUser, mDate, mIn, mOut || undefined);
            toast(`Manual log saved for ${userName(mUser)}`);
            setShowManual(false);
          }}>Save attendance record</Btn>
          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint">admin override · audited in history</p>
        </div>
      </Sheet>
    </div>
  );
}

/* ---------------- staff ---------------- */
function StaffPanel({ admin }: { admin: User }) {
  const db = getDB();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState(DEPTS[0]);
  const [role, setRole] = useState<Role>("staff");
  const [pw, setPw] = useState(genPw());
  const [saving, setSaving] = useState(false);
  if (!db) return null;
  const isSuper = admin.role === "superadmin";
  const nextId = "WMS-0" + (20 + db.users.length);

  const save = () => {
    if (!name.trim() || !email.includes("@")) { toast("Name and valid email required", "err"); return; }
    setSaving(true);
    setTimeout(() => {
      const res = addStaff({ name: name.trim(), email: email.trim(), employeeId: nextId, role, department: dept, password: pw });
      setSaving(false);
      if (!res.ok) { toast(res.msg, "err"); return; }
      toast(res.msg, "ok");
      setShowAdd(false); setName(""); setEmail(""); setPw(genPw());
    }, 500);
  };

  return (
    <div className="a-fadein space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-faint">{db.users.length} accounts · {db.users.filter((u) => u.active).length} active</p>
        <Btn className="!px-3 !py-2" onClick={() => setShowAdd(true)}><UserPlus size={15} /> Add</Btn>
      </div>
      <div className="space-y-2">
        {db.users.map((u) => (
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
                ? <Chip tone="ok"><ScanFace size={10} /> face</Chip>
                : u.role === "staff" && (
                  <button onClick={() => { enrollFace(u.id); toast(`Face enrolled for ${u.name}`); }}
                    className="tap rounded-lg border border-amber/40 bg-amber/10 px-2 py-1.5 font-mono text-[10px] uppercase text-amber">enroll</button>
                )}
              {u.id !== admin.id && u.role !== "superadmin" && <Toggle on={u.active} onChange={() => { toggleActive(u.id); toast(`${u.name} ${u.active ? "deactivated" : "reactivated"}`, "info"); }} />}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Create account">
        <div className="space-y-3.5">
          <Field label="Full name"><input className="inp" value={name} onChange={(e) => { setName(e.target.value); if (!email) setEmail(e.target.value.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/).join(".") + "@nusalogistik.id"); }} placeholder="Sari Rahma" /></Field>
          <Field label="Email"><input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employee ID"><input className="inp font-mono" value={nextId} readOnly /></Field>
            <Field label="Department">
              <select className="inp" value={dept} onChange={(e) => setDept(e.target.value)}>
                {DEPTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Role" hint={isSuper ? "Super Admin can also create Admin accounts." : "Only Super Admin can create Admin accounts."}>
            <div className="flex gap-2">
              {(["staff", "admin"] as Role[]).map((r) => (
                <button key={r} disabled={r === "admin" && !isSuper} onClick={() => setRole(r)}
                  className={`tap ttl flex-1 rounded-lg border px-2 py-2 text-[12.5px] font-bold disabled:opacity-35 ${role === r ? "border-amber/60 bg-amber/12 text-amber" : "border-line bg-panel2 text-mut"}`}>{r}</button>
              ))}
            </div>
          </Field>
          <Field label="Temporary password">
            <div className="flex gap-2">
              <input className="inp font-mono" value={pw} onChange={(e) => setPw(e.target.value)} />
              <Btn variant="ghost" onClick={() => setPw(genPw())}><RefreshCw size={14} /></Btn>
            </div>
          </Field>
          <Btn className="w-full" busy={saving} onClick={save}><Plus size={15} /> Create account</Btn>
        </div>
      </Sheet>
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
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  if (!db) return null;
  const list = [...db.announcements].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));
  return (
    <div className="a-fadein space-y-3">
      <div className="card space-y-3 p-4">
        <Field label="Title"><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Forklift maintenance — Friday" /></Field>
        <Field label="Message">
          <textarea className="inp min-h-[68px] resize-none" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Broadcast to every device on the floor…" />
        </Field>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[12.5px] text-mut"><Toggle on={pinned} onChange={setPinned} /> Pin to dashboard</label>
          <Btn onClick={() => {
            if (!title.trim() || !body.trim()) { toast("Title and message required", "err"); return; }
            addAnnouncement({ title: title.trim(), body: body.trim(), author: admin.name, pinned });
            toast("Announcement broadcast to all staff");
            setTitle(""); setBody(""); setPinned(false);
          }}><Megaphone size={14} /> Broadcast</Btn>
        </div>
      </div>

      {list.length === 0 ? (
        <Empty icon={<Megaphone size={26} />} title="No announcements" sub="Broadcasts appear on every staff dashboard." />
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className="card p-3.5">
              <div className="flex items-center gap-2">
                {a.pinned && <Chip tone="amber">pinned</Chip>}
                <span className="font-mono text-[10px] text-faint">{a.date} · {a.author}</span>
                <button onClick={() => { deleteAnnouncement(a.id); toast("Announcement removed", "info"); }}
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

/* ---------------- settings ---------------- */
function SettingsPanel() {
  const db = getDB();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmSetup, setConfirmSetup] = useState(false);
  if (!db) return null;
  const s = db.settings;
  return (
    <div className="a-fadein space-y-3">
      <SectionTitle><span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-amber" /> Geofence & rules</span></SectionTitle>
      <div className="card space-y-4 p-4">
        <Field label={`Check-in radius — ${s.radius} m`}>
          <input type="range" min={50} max={500} step={10} value={s.radius} onChange={(e) => updateSettings({ radius: Number(e.target.value) })} className="w-full accent-[var(--amber)]" />
        </Field>
        <Field label="Late threshold" hint="Check-ins after this time are flagged late.">
          <input className="inp w-36 font-mono" type="time" value={s.lateTime} onChange={(e) => e.target.value && updateSettings({ lateTime: e.target.value })} />
        </Field>
        <div>
          <p className="ttl mb-1.5 text-[11.5px] font-bold text-mut">Piket points per shift</p>
          <div className="grid grid-cols-3 gap-2">
            {db.shifts.map((sh) => (
              <div key={sh.id} className="card2 p-2.5 text-center">
                <p className="ttl text-[11px] font-bold text-mut">{sh.name}</p>
                <input
                  className="inp mt-1.5 !px-2 !py-1.5 text-center font-mono"
                  type="number" min={1} value={sh.points}
                  onChange={(e) => updateShiftPoints(sh.id, Math.max(1, Number(e.target.value)))}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <SectionTitle><span className="inline-flex items-center gap-1.5"><Settings2 size={14} className="text-amber" /> Appearance & data</span></SectionTitle>
      <div className="card divide-y divide-line2">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            {s.theme === "dark" ? <Moon size={15} className="text-cool" /> : <Sun size={15} className="text-amber" />}
            <div>
              <p className="text-[13px] font-semibold text-ink">Night-shift mode</p>
              <p className="font-mono text-[10.5px] text-faint">{s.theme === "dark" ? "dark theme active" : "light theme active"}</p>
            </div>
          </div>
          <Toggle on={s.theme === "dark"} onChange={(v) => updateSettings({ theme: v ? "dark" : "light" })} />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Database size={15} className="text-ok" />
            <div>
              <p className="text-[13px] font-semibold text-ink">Local-first storage</p>
              <p className="font-mono text-[10.5px] text-faint">SQLite-shaped · works offline · Supabase-ready</p>
            </div>
          </div>
          <Chip tone="ok">synced</Chip>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Users size={15} className="text-faint" />
            <p className="text-[13px] font-semibold text-ink">Reset demo data</p>
          </div>
          <Btn variant="danger" className="!px-3 !py-1.5 text-[12px]" onClick={() => setConfirmReset(true)}>Reset</Btn>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <RefreshCw size={15} className="text-faint" />
            <p className="text-[13px] font-semibold text-ink">Re-run setup wizard</p>
          </div>
          <Btn variant="ghost" className="!px-3 !py-1.5 text-[12px]" onClick={() => setConfirmSetup(true)}>Restart</Btn>
        </div>
      </div>
      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint">
        {s.appName} · {s.company} · {s.siteName}
      </p>

      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} danger
        title="Reset demo data" body="Attendance, schedules, overtime and points will be re-seeded. Accounts and settings are kept."
        yesLabel="Reset" onYes={() => { resetDemoData(); toast("Demo data re-seeded", "info"); }} />
      <Confirm open={confirmSetup} onClose={() => setConfirmSetup(false)} danger
        title="Re-run setup wizard" body="This wipes the local database and returns to first-run setup. You will need to create the admin account again."
        yesLabel="Wipe & restart" onYes={() => { rerunSetup(); }} />
    </div>
  );
}
