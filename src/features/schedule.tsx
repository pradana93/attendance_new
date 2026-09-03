import { useMemo, useState } from "react";
import confetti from "canvas-confetti";
import {
  Camera, Check, ChevronLeft, ChevronRight, ClipboardList, Coffee, Cookie, Gift, Grid3x3,
  History, Package, Pencil, Plus, RefreshCw, RotateCw, Shield, Sparkles, Ticket, Trash2, Wallet,
} from "lucide-react";
import type { PiketTask, User } from "../types";
import {
  addItem, completePiket, deleteTask, getDB, grantBonus, piketForDate, redeem,
  rotateTemplate, saveTask, setAssignment,
} from "../lib/store";
import { addDays, dayKey, fmtDate, mondayOf, parseKey, todayKey, wait } from "../lib/util";
import { useT } from "../lib/i18n";
import { Avatar, Btn, Chip, Confirm, Empty, Field, SectionTitle, Seg, Sheet, Toggle, toast } from "../components/ui";

const AREAS = ["Depan", "Tengah", "Belakang", "Gudang", "Umum"];
const DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_ID = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const ITEM_ICON: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  package: Package, wallet: Wallet, shield: Shield, cup: Coffee, ticket: Ticket, snack: Cookie,
};
const TASK_PATH: Record<PiketTask["icon"], string> = {
  broom: "M4 20l6-6m2-8l6 6-8 8-6-6 8-8zm-2 14l2 2",
  mop: "M5 20l4-9m3-7l2 2-7 14m8-4l4-8",
  door: "M4 20V6a2 2 0 012-2h12a2 2 0 012 2v14M4 20h16M8 8h8M8 12h8M8 16h5",
  thermo: "M12 4a2 2 0 00-2 2v7.3a4 4 0 104 0V6a2 2 0 00-2-2zm0 12v-5",
  box: "M4 8l8-4 8 4v8l-8 4-8-4V8zm0 0l8 4m0 0l8-4m-8 4v8",
  clip: "M8 5V4a2 2 0 012-2h4a2 2 0 012 2v1m-9 0h10a1 1 0 011 1v13a1 1 0 01-1 1H7a1 1 0 01-1-1V6a1 1 0 011-1zm2 6h6m-6 4h4",
};

export function TaskGlyph({ icon, size = 15 }: { icon: PiketTask["icon"]; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={TASK_PATH[icon]} />
    </svg>
  );
}

export default function Schedule({ user }: { user: User }) {
  const t = useT();
  const [tab, setTab] = useState<"roster" | "points" | "redeem">("roster");
  return (
    <div className="space-y-3">
      <Seg
        options={[{ id: "roster", label: t("nav.piket") }, { id: "points", label: t("p.points") }, { id: "redeem", label: t("p.rewards") }]}
        value={tab} onChange={setTab}
      />
      {tab === "roster" && <Roster user={user} />}
      {tab === "points" && <Points user={user} />}
      {tab === "redeem" && <Redeem user={user} />}
    </div>
  );
}

/* ---------------- roster ---------------- */
function Roster({ user }: { user: User }) {
  const db = getDB();
  const t = useT();
  const isAdmin = user.role !== "staff";
  const [adminView, setAdminView] = useState<"week" | "template">("week");
  const [selDay, setSelDay] = useState(() => { const g = new Date().getDay(); return g === 0 ? 6 : g; }); // Mon=1…Sat=6, Sunday → Saturday
  const [editing, setEditing] = useState<PiketTask | "new" | null>(null);
  const [assignFor, setAssignFor] = useState<{ taskId: string; taskName: string } | null>(null);
  const [delTask, setDelTask] = useState<PiketTask | null>(null);
  const [proofFor, setProofFor] = useState<{ task: PiketTask; date: string; userId: string } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const monday = useMemo(() => mondayOf(new Date()), []);
  if (!db) return null;
  const dayLabels = db.settings.language === "id" ? DAY_LABELS_ID : DAY_LABELS_EN;
  const dateForDay = (day: number) => dayKey(addDays(monday, day - 1));
  const rows = piketForDate(dateForDay(Math.min(6, Math.max(1, selDay))));
  const staff = db.users.filter((u) => u.role === "staff" && u.active);
  const myWeek = useMemo(() => {
    let done = 0, total = 0, earned = 0;
    for (let d = 1; d <= 6; d++) {
      for (const r of piketForDate(dateForDay(d))) {
        if (r.assign.userId !== user.id) continue;
        total++;
        if (r.log) { done++; earned += r.task.points; }
      }
    }
    return { done, total, earned };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, db?.piketLog.length, db?.template.length]);

  const doComplete = async (task: PiketTask, date: string, userId: string, withProof: boolean) => {
    if (withProof) {
      setCapturing(true);
      await wait(850);
      setCapturing(false);
      setProofFor(null);
    }
    const res = completePiket(date, task.id, userId, withProof);
    if (res.ok) {
      toast(`${task.name} · ${res.msg}`, "ok");
      confetti({ particleCount: 40, spread: 58, origin: { y: 0.7 }, colors: ["#ffb224", "#3ed598"], disableForReducedMotion: true });
    } else toast(res.msg, "err");
  };

  return (
    <div className="a-fadein space-y-3">
      {isAdmin && (
        <Seg options={[{ id: "week", label: t("p.week") }, { id: "template", label: t("p.template") }]} value={adminView} onChange={setAdminView} />
      )}

      {/* ---------- staff week view ---------- */}
      {!isAdmin && (
        <>
          <div className="card relative overflow-hidden p-4">
            <div className="hazard absolute inset-x-0 top-0 h-1" />
            <div className="flex items-center justify-between">
              <div>
                <p className="ttl text-[12px] font-bold text-mut">{t("p.myWeek")} · {fmtDate(dayKey(monday))} – {fmtDate(dayKey(addDays(monday, 5)))}</p>
                <p className="mt-1 font-mono text-[26px] font-semibold leading-none text-ink">{myWeek.done}<span className="text-[15px] text-mut">/{myWeek.total} {t("p.doneThisWeek")}</span></p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[22px] font-semibold leading-none text-amber">+{myWeek.earned}</p>
                <p className="ttl mt-1 text-[10.5px] font-bold text-mut">{t("p.earnedWeek")}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => i + 1).map((day) => {
              const k = dateForDay(day);
              const mine = piketForDate(k).filter((r) => r.assign.userId === user.id);
              const isToday = k === todayKey();
              if (!mine.length) return null;
              return (
                <div key={day} className={`card p-3.5 ${isToday ? "border-amber/50 shadow-[0_0_24px_rgba(255,178,36,0.08)]" : ""}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`ttl flex h-6 w-9 items-center justify-center rounded-md text-[11px] font-bold ${isToday ? "bg-amber text-[#191203]" : "bg-panel2 text-mut"}`}>{dayLabels[day - 1]}</span>
                    <span className="font-mono text-[11px] text-faint">{fmtDate(k)}</span>
                    {isToday && <Chip tone="amber">{t("p.today")}</Chip>}
                  </div>
                  <div className="space-y-1.5">
                    {mine.map(({ task, log }) => (
                      <div key={task.id} className={`flex items-center gap-2.5 rounded-lg border border-line2 bg-panel2/60 px-3 py-2 ${log ? "opacity-55" : ""}`}>
                        <span className="text-amber"><TaskGlyph icon={task.icon} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-semibold text-ink">{task.name}</p>
                          <p className="font-mono text-[10px] text-faint">+{task.points} {t("c.pts")}{task.requiresProof ? " · 📷" : ""}</p>
                        </div>
                        {log ? <Chip tone="ok"><Check size={10} /></Chip>
                          : k <= todayKey() ? (
                            <button onClick={() => task.requiresProof ? setProofFor({ task, date: k, userId: user.id }) : doComplete(task, k, user.id, false)}
                              className="tap rounded-lg border border-amber/45 bg-amber/10 px-2.5 py-1 font-mono text-[10.5px] uppercase text-amber hover:bg-amber/20">{t("p.complete")}</button>
                          ) : <span className="font-mono text-[10px] uppercase text-faint">—</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {myWeek.total === 0 && <Empty icon={<ClipboardList size={26} />} title={t("d.noPiket")} sub={t("p.noLedgerSub")} />}
          </div>
        </>
      )}

      {/* ---------- admin week view ---------- */}
      {isAdmin && adminView === "week" && (
        <>
          <DayChips sel={selDay} setSel={setSelDay} labels={dayLabels} monday={monday} />
          <div className="space-y-2">
            {rows.length === 0 && <Empty icon={<ClipboardList size={26} />} title={t("p.unassigned")} sub={`${t("p.template")} →`} />}
            {rows.map(({ task, assign, log }) => {
              const u = db.users.find((x) => x.id === assign.userId);
              const k = dateForDay(selDay);
              return (
                <div key={assign.id} className="card flex items-center gap-3 p-3">
                  {u ? <Avatar user={u} size={34} /> : <span className="h-[34px] w-[34px] rounded-full border border-dashed border-line" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-amber"><TaskGlyph icon={task.icon} size={13} /></span>
                      <p className="truncate text-[13px] font-semibold text-ink">{task.name}</p>
                    </div>
                    <p className="mt-0.5 font-mono text-[10.5px] text-faint">{u?.name ?? t("p.unassigned")} · {task.area} · +{task.points} {t("c.pts")}</p>
                  </div>
                  {log ? <Chip tone="ok"><Check size={10} /> {t("c.done").toLowerCase()}</Chip>
                    : u && k <= todayKey() ? (
                      <button onClick={() => task.requiresProof ? setProofFor({ task, date: k, userId: u.id }) : doComplete(task, k, u.id, false)}
                        className="tap rounded-lg border border-ok/35 bg-ok/10 px-2.5 py-1.5 font-mono text-[10.5px] uppercase text-ok hover:bg-ok/20">{t("p.complete")}</button>
                    ) : <Chip tone="mut">—</Chip>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ---------- admin template editor ---------- */}
      {isAdmin && adminView === "template" && (
        <>
          <div className="flex gap-2">
            <Btn variant="ghost" className="flex-1" onClick={() => { rotateTemplate(); toast(t("p.rotated")); }}>
              <RotateCw size={14} /> {t("p.rotate")}
            </Btn>
            <Btn className="flex-1" onClick={() => setEditing("new")}><Plus size={14} /> {t("p.addTask")}</Btn>
          </div>

          <SectionTitle><span className="inline-flex items-center gap-1.5"><Grid3x3 size={14} className="text-amber" /> {t("p.weeklyTemplate")}</span></SectionTitle>
          <DayChips sel={selDay} setSel={setSelDay} labels={dayLabels} monday={monday} />

          <div className="space-y-2">
            {db.tasks.filter((x) => x.active).map((task) => {
              const a = db.template.find((x) => x.taskId === task.id && x.day === selDay);
              const u = a ? db.users.find((x) => x.id === a.userId) : undefined;
              return (
                <div key={task.id} className="card flex items-center gap-3 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber/12 text-amber"><TaskGlyph icon={task.icon} size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-ink">{task.name}</p>
                      <Chip tone="mut">{task.area}</Chip>
                      {task.requiresProof && <Chip tone="cool">📷</Chip>}
                    </div>
                    <p className="mt-0.5 font-mono text-[10.5px] text-faint">+{task.points} {t("c.pts")} · {dayLabels[selDay - 1]}</p>
                  </div>
                  <button onClick={() => setAssignFor({ taskId: task.id, taskName: task.name })}
                    className={`tap flex items-center gap-2 rounded-xl border px-2 py-1.5 ${u ? "border-line bg-panel2 hover:border-amber/50" : "border-dashed border-amber/50 bg-amber/6 text-amber"}`}>
                    {u ? (<><Avatar user={u} size={24} /><span className="max-w-[64px] truncate text-[11.5px] font-medium text-ink">{u.name.split(" ")[0]}</span></>)
                      : <span className="flex items-center gap-1 px-1 font-mono text-[11px] uppercase"><Plus size={12} />{t("p.assign")}</span>}
                  </button>
                  <button onClick={() => setEditing(task)} className="tap rounded-lg border border-line bg-panel2 p-2 text-faint hover:text-ink" aria-label={t("p.editTask")}><Pencil size={13} /></button>
                </div>
              );
            })}
          </div>

          <SectionTitle><span className="inline-flex items-center gap-1.5"><ClipboardList size={14} className="text-amber" /> {t("p.tasksCatalog")}</span></SectionTitle>
          <div className="card divide-y divide-line2">
            {db.tasks.map((task) => (
              <div key={task.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${!task.active ? "opacity-50" : ""}`}>
                <span className="text-amber"><TaskGlyph icon={task.icon} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{task.name}</p>
                  <p className="font-mono text-[10.5px] text-faint">{task.area} · +{task.points} {t("c.pts")}{task.requiresProof ? " · proof" : ""}{!task.active ? " · hidden" : ""}</p>
                </div>
                <button onClick={() => setEditing(task)} className="tap rounded-lg border border-line bg-panel2 p-1.5 text-mut hover:text-ink" aria-label="edit"><Pencil size={13} /></button>
                <button onClick={() => setDelTask(task)} className="tap rounded-lg border border-line bg-panel2 p-1.5 text-mut hover:text-bad" aria-label="delete"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      <AssignSheet assignFor={assignFor} onClose={() => setAssignFor(null)} day={selDay} staff={staff} current={db} />
      <TaskEditor editing={editing} onClose={() => setEditing(null)} onDelete={(tk) => setDelTask(tk)} />

      <Confirm open={!!delTask} onClose={() => setDelTask(null)} danger title={`${t("c.delete")}: ${delTask?.name ?? ""}?`}
        body="The task and all its weekly assignments will be removed. History is kept."
        yesLabel={t("c.delete")} onYes={() => { if (delTask) { deleteTask(delTask.id); toast(`${delTask.name} removed`, "info"); } }} />

      {/* proof capture */}
      <Sheet open={!!proofFor} onClose={() => !capturing && setProofFor(null)} title={proofFor?.task.name ?? ""}>
        {proofFor && (
          <div className="space-y-3.5">
            <div className="relative mx-auto flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-[#0b0e12]">
              <Camera size={30} className={capturing ? "animate-pulse text-amber" : "text-faint"} />
              <p className="absolute bottom-2 font-mono text-[10.5px] uppercase tracking-widest text-white/70">
                {capturing ? "capturing…" : `${proofFor.task.area} · ${fmtDate(proofFor.date)}`}
              </p>
            </div>
            <p className="text-center text-[12px] text-mut">{proofFor.task.desc}</p>
            <Btn className="w-full" busy={capturing} onClick={() => doComplete(proofFor.task, proofFor.date, proofFor.userId, true)}>
              <Camera size={15} /> {t("p.takeProof")}
            </Btn>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function DayChips({ sel, setSel, labels, monday }: { sel: number; setSel: (n: number) => void; labels: string[]; monday: Date }) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {labels.map((l, i) => {
        const k = dayKey(addDays(monday, i));
        const isToday = k === todayKey();
        return (
          <button key={l} onClick={() => setSel(i + 1)}
            className={`tap rounded-lg border py-1.5 text-center ${sel === i + 1 ? "border-amber/60 bg-amber/12" : "border-transparent bg-panel2"} `}>
            <p className={`ttl text-[10px] font-bold ${sel === i + 1 ? "text-amber" : "text-faint"}`}>{l}</p>
            <p className={`font-mono text-[12px] font-semibold ${sel === i + 1 ? "text-ink" : "text-mut"} ${isToday ? "text-amber" : ""}`}>{parseKey(k).getDate()}</p>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- assign sheet ---------------- */
function AssignSheet({ assignFor, onClose, day, staff, current }: {
  assignFor: { taskId: string; taskName: string } | null; onClose: () => void; day: number; staff: User[]; current: ReturnType<typeof getDB>;
}) {
  const t = useT();
  if (!current) return null;
  const cur = current.template.find((a) => a.taskId === assignFor?.taskId && a.day === day);
  return (
    <Sheet open={!!assignFor} onClose={onClose} title={`${t("p.assign")} · ${assignFor?.taskName ?? ""}`}>
      <div className="space-y-1.5">
        {cur && (
          <button onClick={() => { setAssignment(assignFor!.taskId, day, null); toast(t("p.unassign"), "info"); onClose(); }}
            className="tap flex w-full items-center gap-3 rounded-xl border border-dashed border-bad/40 bg-bad/6 px-3.5 py-2.5 text-left">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-bad/40 text-bad"><Trash2 size={13} /></span>
            <span className="text-[13px] font-medium text-bad">{t("p.unassign")}</span>
          </button>
        )}
        {staff.map((u) => (
          <button key={u.id} onClick={() => { setAssignment(assignFor!.taskId, day, u.id); toast(`${u.name.split(" ")[0]} → ${assignFor?.taskName}`); onClose(); }}
            className={`tap flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left ${cur?.userId === u.id ? "border-amber/60 bg-amber/10" : "border-line bg-panel2 hover:border-faint"}`}>
            <Avatar user={u} size={30} />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-ink">{u.name}</p>
              <p className="font-mono text-[10.5px] text-faint">{u.department} · {u.employeeId}</p>
            </div>
            {cur?.userId === u.id && <Chip tone="amber">✓</Chip>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------------- task editor ---------------- */
function TaskEditor({ editing, onClose, onDelete }: { editing: PiketTask | "new" | null; onClose: () => void; onDelete: (t: PiketTask) => void }) {
  const t = useT();
  const isNew = editing === "new";
  const base = isNew || !editing ? { name: "", area: AREAS[0], points: 10, requiresProof: false, desc: "", icon: "broom" as PiketTask["icon"], active: true } : editing;
  const [f, setF] = useState(base);
  // re-sync when target changes
  const key = isNew ? "new" : editing?.id ?? "none";
  useMemo(() => setF(base), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={!!editing} onClose={onClose} title={isNew ? t("p.addTask") : t("p.editTask")}>
      <div className="space-y-3.5">
        <Field label={t("p.taskName")}><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Foto Suhu Container 40ft" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("p.area")}>
            <select className="inp" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
              {AREAS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </Field>
          <Field label={`${t("p.cost").replace(" (pts)", "")} (${t("c.pts")})`}>
            <input className="inp font-mono" type="number" min={1} value={f.points} onChange={(e) => setF({ ...f, points: Math.max(1, Number(e.target.value)) })} />
          </Field>
        </div>
        <Field label="Icon">
          <div className="flex gap-2">
            {(Object.keys(TASK_PATH) as PiketTask["icon"][]).map((ic) => (
              <button key={ic} onClick={() => setF({ ...f, icon: ic })}
                className={`tap flex h-9 w-9 items-center justify-center rounded-lg border ${f.icon === ic ? "border-amber/60 bg-amber/12 text-amber" : "border-line bg-panel2 text-mut"}`}>
                <TaskGlyph icon={ic} />
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("p.desc")}><textarea className="inp min-h-[60px] resize-none" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></Field>
        <label className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-3.5 py-3">
          <span className="text-[13px] font-medium text-ink">{t("p.photoProof")}</span>
          <Toggle on={f.requiresProof} onChange={(v) => setF({ ...f, requiresProof: v })} />
        </label>
        {!isNew && (
          <label className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-3.5 py-3">
            <span className="text-[13px] font-medium text-ink">Active on roster</span>
            <Toggle on={f.active} onChange={(v) => setF({ ...f, active: v })} />
          </label>
        )}
        <Btn className="w-full" onClick={() => {
          if (!f.name.trim()) { toast("Task name required", "err"); return; }
          saveTask({ ...(isNew ? {} : { id: (editing as PiketTask).id }), ...f, name: f.name.trim() });
          toast(isNew ? `${f.name.trim()} added to catalog` : `${f.name.trim()} updated`);
          onClose();
        }}><Check size={15} /> {t("c.save")}</Btn>
        {!isNew && editing && (
          <Btn variant="ghost" className="w-full" onClick={() => { onClose(); onDelete(editing as PiketTask); }}>
            <Trash2 size={14} /> {t("c.delete")}
          </Btn>
        )}
      </div>
    </Sheet>
  );
}

/* ---------------- points ---------------- */
function Points({ user }: { user: User }) {
  const db = getDB();
  const t = useT();
  if (!db) return null;
  const ledger = db.pointEvents.filter((p) => p.userId === user.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  const earned = ledger.filter((p) => p.delta > 0).reduce((s, p) => s + p.delta, 0);
  const spent = -ledger.filter((p) => p.delta < 0).reduce((s, p) => s + p.delta, 0);
  return (
    <div className="a-fadein space-y-3">
      <div className="card relative overflow-hidden p-4">
        <div className="hazard absolute inset-x-0 top-0 h-1" />
        <div className="flex items-center justify-between">
          <div>
            <p className="ttl text-[12px] font-bold text-mut">{t("p.balance")}</p>
            <p className="mt-1 font-mono text-[36px] font-semibold leading-none text-amber">{user.points}<span className="text-[15px] text-mut"> {t("c.pts")}</span></p>
          </div>
          <Gift size={34} className="text-amber/30" />
        </div>
        <div className="mt-3 flex gap-4 font-mono text-[11.5px] text-mut">
          <span><span className="text-ok">+{earned}</span> {t("p.earned")}</span>
          <span><span className="text-bad">−{spent}</span> {t("p.redeemed")}</span>
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-faint">{t("p.expires", { m: db.settings.pointsExpiryMonths })}</p>
      </div>

      <SectionTitle right={<Sparkles size={13} className="text-faint" />}>{t("p.ledger")}</SectionTitle>
      {ledger.length === 0 ? (
        <Empty icon={<Gift size={26} />} title={t("p.noLedger")} sub={t("p.noLedgerSub")} />
      ) : (
        <div className="card divide-y divide-line2">
          {ledger.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-3.5 py-2.5">
              <div>
                <p className="text-[13px] font-medium text-ink">{p.label}</p>
                <p className="font-mono text-[10.5px] text-faint">{fmtDate(p.date)}</p>
              </div>
              <span className={`font-mono text-[14px] font-semibold ${p.delta > 0 ? "text-ok" : "text-bad"}`}>{p.delta > 0 ? "+" : ""}{p.delta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- redeem ---------------- */
function Redeem({ user }: { user: User }) {
  const db = getDB();
  const t = useT();
  const [target, setTarget] = useState<string | null>(null);
  const [confirmBonus, setConfirmBonus] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [nName, setNName] = useState(""); const [nCost, setNCost] = useState(100); const [nStock, setNStock] = useState(10);
  const [nCat, setNCat] = useState<"Essentials" | "Voucher" | "Gear">("Essentials");
  if (!db) return null;
  const isAdmin = user.role !== "staff";
  const item = db.items.find((i) => i.id === target);
  const history = db.redemptions.filter((r) => r.userId === user.id);

  const doRedeem = () => {
    if (!target) return;
    const res = redeem(user.id, target);
    if (res.ok) {
      toast(`${res.msg} — ${t("p.collect")}`, "ok");
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#ffb224", "#3ed598", "#5ac8e8"], disableForReducedMotion: true });
    } else toast(res.msg, "err");
    setTarget(null);
  };

  return (
    <div className="a-fadein space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[12px] text-mut">{t("p.balance")}: <span className="font-semibold text-amber">{user.points} {t("c.pts")}</span></p>
        {isAdmin && <Btn variant="ghost" className="!px-3 !py-1.5 text-[12px]" onClick={() => setShowAdd(true)}><Plus size={13} /> {t("p.addTask").split(" ")[0]}</Btn>}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {db.items.map((i) => {
          const Ic = ITEM_ICON[i.icon] ?? Package;
          const afford = user.points >= i.cost;
          const out = i.stock <= 0;
          return (
            <div key={i.id} className={`card p-3.5 ${out ? "opacity-55" : ""}`}>
              <div className="flex items-start justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/12 text-amber"><Ic size={17} /></span>
                <Chip tone="mut">{i.cat}</Chip>
              </div>
              <p className="mt-2 text-[13.5px] font-semibold leading-tight text-ink">{i.name}</p>
              <p className="mt-0.5 font-mono text-[10.5px] text-faint">{i.stock} {t("p.inStock")}</p>
              <button onClick={() => !out && setTarget(i.id)} disabled={out}
                className={`tap mt-2.5 flex w-full items-center justify-between rounded-lg border px-2.5 py-2 ${afford && !out ? "border-amber/40 bg-amber/10 text-amber hover:bg-amber/18" : "border-line bg-panel2 text-faint"}`}>
                <span className="font-mono text-[13px] font-semibold">{i.cost} {t("c.pts")}</span>
                <span className="ttl text-[11px] font-bold">{out ? t("p.empty") : t("p.redeem")}</span>
              </button>
            </div>
          );
        })}
      </div>

      <SectionTitle right={<History size={14} className="text-faint" />}>{t("p.yourRedemptions")}</SectionTitle>
      {history.length === 0 ? (
        <Empty icon={<Ticket size={26} />} title={t("p.noRedemptions")} sub={t("p.noRedemptionsSub")} />
      ) : (
        <div className="card divide-y divide-line2">
          {history.map((r) => {
            const it = db.items.find((i) => i.id === r.itemId);
            return (
              <div key={r.id} className="flex items-center justify-between px-3.5 py-2.5">
                <div>
                  <p className="text-[13px] font-medium text-ink">{it?.name ?? "Item"}</p>
                  <p className="font-mono text-[10.5px] text-faint">{fmtDate(r.date)} · {t("p.collect")}</p>
                </div>
                <span className="font-mono text-[13px] font-semibold text-bad">−{r.cost}</span>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={!!item} onClose={() => setTarget(null)} title={t("p.confirmRedeem")}>
        {item && (
          <div className="space-y-4">
            <div className="card2 flex items-center gap-3 p-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber/12 text-amber"><Gift size={20} /></span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-ink">{item.name}</p>
                <p className="font-mono text-[11px] text-faint">{item.cost} {t("c.pts")} · {item.stock} left</p>
              </div>
              <Chip tone={user.points >= item.cost ? "ok" : "bad"}>{user.points >= item.cost ? t("p.afford") : t("p.short")}</Chip>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-dashed border-line px-3.5 py-2.5 font-mono text-[12px] text-mut">
              <span>{t("p.balanceAfter")}</span>
              <span className="text-ink">{Math.max(0, user.points - item.cost)} {t("c.pts")}</span>
            </div>
            <Btn className="w-full" disabled={user.points < item.cost} onClick={doRedeem}>
              <Ticket size={15} /> {t("p.redeemFor", { n: item.cost })}
            </Btn>
          </div>
        )}
      </Sheet>

      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title={t("p.newItem")}>
        <div className="space-y-3.5">
          <Field label={t("p.name")}><input className="inp" value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Rain jacket" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("p.cost")}><input className="inp font-mono" type="number" value={nCost} onChange={(e) => setNCost(Number(e.target.value))} /></Field>
            <Field label={t("p.stock")}><input className="inp font-mono" type="number" value={nStock} onChange={(e) => setNStock(Number(e.target.value))} /></Field>
          </div>
          <Field label={t("p.category")}>
            <div className="flex gap-2">
              {(["Essentials", "Voucher", "Gear"] as const).map((c) => (
                <button key={c} onClick={() => setNCat(c)} className={`tap ttl flex-1 rounded-lg border px-2 py-2 text-[12px] font-bold ${nCat === c ? "border-amber/60 bg-amber/12 text-amber" : "border-line bg-panel2 text-mut"}`}>{c}</button>
              ))}
            </div>
          </Field>
          <Btn className="w-full" onClick={() => {
            if (!nName.trim() || nCost <= 0) { toast("Name and positive cost required", "err"); return; }
            addItem({ name: nName.trim(), cost: nCost, stock: nStock, cat: nCat });
            toast(`${nName.trim()} + catalog`);
            setShowAdd(false); setNName("");
          }}><Plus size={15} /> {t("p.addToCatalog")}</Btn>
          <Btn variant="ghost" className="w-full" onClick={() => setConfirmBonus(true)}><RefreshCw size={14} /> +50 bonus pts (demo)</Btn>
        </div>
      </Sheet>

      <Confirm open={confirmBonus} onClose={() => setConfirmBonus(false)} danger={false}
        title="+50 pts" body={`Grant +50 bonus points to ${user.name}? Logged in the ledger.`}
        yesLabel="Grant" onYes={() => { grantBonus(user.id, 50, "Admin bonus"); toast("+50 pts ✓"); }} />
    </div>
  );
}
