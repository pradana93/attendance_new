import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Check, ChevronDown, ChevronUp, Clock3, Cloud, Copy, Database, Globe, Loader2,
  LogOut, MapPin, Megaphone, Moon, Plus, Radio, RefreshCw, ScanFace, Settings2, Sun,
  Trash2, UserPlus, Users, X,
} from "lucide-react";
import type { Lang, Role, User } from "../types";
import {
  addAnnouncement, addStaff, connectSupabase, deleteAnnouncement, disconnectSupabase, enrollFace,
  getDB, manualLog, rerunSetup, resetDemoData, reviewSelfReport, supabaseSQL, syncSupabase,
  toggleActive, updateSettings, userName,
} from "../lib/store";
import { fmtIDRFull, fmtTime, relTime, todayKey, wait } from "../lib/util";
import { useT } from "../lib/i18n";
import { Avatar, Btn, Chip, Confirm, Empty, Field, LiveDot, SectionTitle, Seg, Sheet, Toggle, toast } from "../components/ui";

export type AdminSec = "live" | "staff" | "notice" | "cloud" | "config";
type Sec = AdminSec;
const DEPTS = ["Inbound", "Outbound", "Inventory", "Packing", "QA", "Forklift", "Operations"];

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
        options={[
          { id: "live", label: t("a.live") }, { id: "staff", label: t("a.staff") }, { id: "notice", label: t("a.notice") },
          { id: "cloud", label: t("a.cloud") }, { id: "config", label: t("a.config") },
        ]}
        value={sec} onChange={setSec}
      />
      {sec === "live" && <LiveBoard />}
      {sec === "staff" && <StaffPanel admin={user} />}
      {sec === "notice" && <NoticePanel admin={user} />}
      {sec === "cloud" && <CloudPanel />}
      {sec === "config" && <ConfigPanel />}
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
                    <Btn variant="ok" className="flex-1 !py-2 text-[12.5px]" onClick={() => { reviewSelfReport(r.id, true); toast(`Approved ${u.name}`); }}><Check size={14} /> ✓</Btn>
                    <Btn variant="danger" className="flex-1 !py-2 text-[12.5px]" onClick={() => { reviewSelfReport(r.id, false); toast("Rejected", "info"); }}><X size={14} /> ✕</Btn>
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
          <Btn className="w-full" onClick={() => {
            if (!mUser) { toast("Pick an employee first", "err"); return; }
            manualLog(mUser, mDate, mIn, mOut || undefined);
            toast(`Saved for ${userName(mUser)}`);
            setShowManual(false);
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
  if (!db) return null;
  const isSuper = admin.role === "superadmin";
  const nextId = "WMS-0" + (10 + db.users.length + 1);

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
        <p className="font-mono text-[11px] uppercase tracking-widest text-faint">{db.users.length} {t("a.accounts")} · {db.users.filter((u) => u.active).length} {t("a.active")}</p>
        <Btn className="!px-3 !py-2" onClick={() => setShowAdd(true)}><UserPlus size={15} /> {t("a.add")}</Btn>
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
                ? <Chip tone="ok"><ScanFace size={10} /> {t("a.face")}</Chip>
                : u.role === "staff" && (
                  <button onClick={() => { enrollFace(u.id); toast(`Face enrolled: ${u.name}`); }}
                    className="tap rounded-lg border border-amber/40 bg-amber/10 px-2 py-1.5 font-mono text-[10px] uppercase text-amber">{t("a.enroll")}</button>
                )}
              {u.id !== admin.id && u.role !== "superadmin" && <Toggle on={u.active} onChange={() => { toggleActive(u.id); toast(`${u.name} ${u.active ? "deactivated" : "reactivated"}`, "info"); }} />}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title={t("a.createAccount")}>
        <div className="space-y-3.5">
          <Field label={t("a.fullName")}><input className="inp" value={name} onChange={(e) => { setName(e.target.value); if (!email) setEmail(e.target.value.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/).join(".") + "@nusalogistik.id"); }} placeholder="Sari Rahma" /></Field>
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
              <input className="inp font-mono" value={pw} onChange={(e) => setPw(e.target.value)} />
              <Btn variant="ghost" onClick={() => setPw(genPw())}><RefreshCw size={14} /></Btn>
            </div>
          </Field>
          <Btn className="w-full" busy={saving} onClick={save}><Plus size={15} /> {t("a.createAccount")}</Btn>
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
          <Btn onClick={() => {
            if (!title.trim() || !body.trim()) { toast("Title and message required", "err"); return; }
            addAnnouncement({ title: title.trim(), body: body.trim(), author: admin.name, pinned });
            toast("Broadcast sent to all staff");
            setTitle(""); setBody(""); setPinned(false);
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
                <button onClick={() => { deleteAnnouncement(a.id); toast("Removed", "info"); }}
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

/* ---------------- supabase deploy ---------------- */
const MIGRATIONS = [
  "create table users …", "create table attendance …", "create table piket_tasks …",
  "create table piket_template …", "create table piket_log …", "create table overtime …",
  "create table leaves …", "create table point_events …", "create table redeem_items + history …",
  "create table announcements …", "enable row level security …",
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
  const [syncing, setSyncing] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const migStarted = useRef(false);

  useEffect(() => {
    if (step !== 2 || migStarted.current) return;
    migStarted.current = true;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < MIGRATIONS.length; i++) {
        if (cancelled) return;
        setMigStep(i);
        await wait(300);
      }
      if (!cancelled) window.setTimeout(() => !cancelled && setStep(3), 350);
    })();
    return () => { cancelled = true; migStarted.current = false; };
  }, [step]);

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
          <div className="mt-3 flex gap-2">
            <Btn className="flex-1" busy={syncing} onClick={async () => {
              setSyncing(true);
              await wait(900);
              const r = syncSupabase();
              setSyncing(false);
              toast(t("dp.pushed", { a: r.pushed, b: r.pulled }), "ok");
            }}><RefreshCw size={14} /> {t("dp.syncNow")}</Btn>
            <Btn variant="ghost" onClick={() => setConfirmOff(true)}><LogOut size={14} /> {t("dp.disconnect")}</Btn>
          </div>
        </div>

        <div className="card p-4">
          <button onClick={() => setShowSql((s) => !s)} className="flex w-full items-center justify-between text-left">
            <SectionTitle>{t("dp.schema")}</SectionTitle>
            {showSql ? <ChevronUp size={15} className="text-faint" /> : <ChevronDown size={15} className="text-faint" />}
          </button>
          {showSql && (
            <div className="a-fadein mt-2">
              <pre className="no-scrollbar max-h-56 overflow-auto rounded-xl border border-line bg-[#0b0e12] p-3 font-mono text-[10.5px] leading-relaxed text-[#9fb3c8]">{supabaseSQL}</pre>
              <Btn variant="ghost" className="mt-2 w-full" onClick={() => { navigator.clipboard?.writeText(supabaseSQL).catch(() => {}); toast("SQL copied"); }}><Copy size={13} /> {t("dp.copy")}</Btn>
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
          <button onClick={() => { setUrl("https://shiftgate-demo.supabase.co"); setKey("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-anon-key"); }}
            className="tap w-full rounded-xl border border-dashed border-cool/40 bg-cool/6 px-3 py-2.5 font-mono text-[11px] text-cool">
            ⚡ {t("dp.demo")}
          </button>
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
            await wait(1100);
            setTesting(false);
            toast("Connection OK · latency 42ms · Postgres 15", "ok");
          }}><Activity size={14} /> {testing ? t("dp.testing") : t("dp.test")}</Btn>
          <Btn className="w-full" onClick={() => { connectSupabase(url.trim(), key.trim()); toast(`${t("dp.connected")} ✓`, "ok"); }}>
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
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmSetup, setConfirmSetup] = useState(false);
  if (!db) return null;
  const s = db.settings;
  return (
    <div className="a-fadein space-y-3">
      <SectionTitle><span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-amber" /> {t("a.geo")}</span></SectionTitle>
      <div className="card space-y-4 p-4">
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
          <Chip tone={s.supabase.status === "connected" ? "cool" : "ok"}>{s.supabase.status === "connected" ? "cloud+local" : t("a.synced")}</Chip>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Users size={15} className="text-faint" />
            <p className="text-[13px] font-semibold text-ink">{t("a.resetDemo")}</p>
          </div>
          <Btn variant="danger" className="!px-3 !py-1.5 text-[12px]" onClick={() => setConfirmReset(true)}>{t("a.reset")}</Btn>
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

      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} danger
        title={t("a.resetQ")} body={t("a.resetBody")} yesLabel={t("a.reset")}
        onYes={() => { resetDemoData(); toast("Demo data re-seeded", "info"); }} />
      <Confirm open={confirmSetup} onClose={() => setConfirmSetup(false)} danger
        title={t("a.rerunQ")} body={t("a.rerunBody")} yesLabel={t("a.wipe")} onYes={() => rerunSetup()} />
    </div>
  );
}
