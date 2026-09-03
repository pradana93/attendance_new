import { useMemo, useState } from "react";
import confetti from "canvas-confetti";
import {
  CalendarDays, Camera, Check, ChevronLeft, ChevronRight, Coffee, Gift, History,
  Package, Plus, Shield, Sparkles, Ticket, Trash2, Wallet, Cookie,
} from "lucide-react";
import type { ScheduleEntry, User } from "../types";
import {
  assignShift, autofillWeek, getDB, grantBonus, markDutyDone, redeem, removeSchedule, addItem,
} from "../lib/store";
import { addDays, dayKey, fmtDate, mondayOf, parseKey, todayKey, wait } from "../lib/util";
import { Avatar, Btn, Chip, Empty, Field, SectionTitle, Seg, Sheet, toast, Confirm } from "../components/ui";

const TONE: Record<string, "amber" | "ok" | "cool"> = { morning: "amber", afternoon: "ok", night: "cool" };
const ITEM_ICON: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  package: Package, wallet: Wallet, shield: Shield, cup: Coffee, ticket: Ticket, snack: Cookie,
};

export default function Schedule({ user }: { user: User }) {
  const [tab, setTab] = useState<"roster" | "points" | "redeem">("roster");
  return (
    <div className="space-y-3">
      <Seg
        options={[{ id: "roster", label: "Roster" }, { id: "points", label: "Points" }, { id: "redeem", label: "Rewards" }]}
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
  const [weekOff, setWeekOff] = useState(0);
  const [selDay, setSelDay] = useState(todayKey());
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null);
  const [assignFor, setAssignFor] = useState<User | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const monday = useMemo(() => addDays(mondayOf(new Date()), weekOff * 7), [weekOff]);
  if (!db) return null;
  const isAdmin = user.role !== "staff";
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const staff = db.users.filter((u) => u.role === "staff" && u.active);
  const weekLabel = `${fmtDate(dayKey(monday))} – ${fmtDate(dayKey(addDays(monday, 6)))}`;

  const uploadProof = async (s: ScheduleEntry) => {
    setUploading(s.id);
    await wait(850);
    markDutyDone(s.id);
    const shift = db.shifts.find((x) => x.id === s.shiftId);
    toast(`Proof uploaded — +${shift?.points ?? 0} pts credited`, "ok");
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ["#ffb224", "#3ed598"], disableForReducedMotion: true });
    setUploading(null);
  };

  return (
    <div className="a-fadein space-y-3">
      {/* week nav */}
      <div className="card p-3">
        <div className="mb-2.5 flex items-center justify-between">
          <button onClick={() => setWeekOff((w) => w - 1)} className="tap rounded-lg border border-line bg-panel2 p-1.5 text-mut hover:text-ink" aria-label="Previous week"><ChevronLeft size={15} /></button>
          <div className="text-center">
            <p className="ttl text-[14px] font-bold text-ink">{weekLabel}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-faint">week {weekOff === 0 ? "· current" : weekOff > 0 ? `+${weekOff}` : weekOff}</p>
          </div>
          <button onClick={() => setWeekOff((w) => w + 1)} className="tap rounded-lg border border-line bg-panel2 p-1.5 text-mut hover:text-ink" aria-label="Next week"><ChevronRight size={15} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const k = dayKey(d);
            const off = d.getDay() === 0;
            const sel = k === selDay;
            const isToday = k === todayKey();
            return (
              <button key={k} disabled={off} onClick={() => setSelDay(k)}
                className={`tap rounded-lg border py-1.5 text-center ${sel ? "border-amber/60 bg-amber/12" : "border-transparent bg-panel2"} ${off ? "opacity-35" : ""}`}>
                <p className={`ttl text-[10px] font-bold ${sel ? "text-amber" : "text-faint"}`}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]}</p>
                <p className={`font-mono text-[13px] font-semibold ${sel ? "text-ink" : "text-mut"} ${isToday ? "text-amber" : ""}`}>{d.getDate()}</p>
              </button>
            );
          })}
        </div>
      </div>

      {isAdmin && (
        <div className="flex gap-2">
          <Btn variant="ghost" className="flex-1" onClick={() => { autofillWeek(monday); toast("Week auto-filled — rotating Morning → Night across crew"); }}>
            <Sparkles size={14} /> Auto-fill week
          </Btn>
        </div>
      )}

      {/* day detail */}
      <div className="space-y-2">
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-amber" /> {fmtDate(selDay)} · {parseKey(selDay).toLocaleDateString("en", { weekday: "long" })}</span>
        </SectionTitle>

        {(() => {
          const rows = db.schedules
            .filter((s) => s.date === selDay && (isAdmin || s.userId === user.id))
            .map((s) => ({ s, u: db.users.find((u) => u.id === s.userId)!, shift: db.shifts.find((x) => x.id === s.shiftId)! }))
            .sort((a, b) => a.shift.start.localeCompare(b.shift.start));
          const scheduledIds = rows.map((r) => r.s.userId);
          const missing = isAdmin ? staff.filter((u) => !scheduledIds.includes(u.id)) : [];
          const isPast = selDay < todayKey();
          const isFuture = selDay > todayKey();

          if (!rows.length && !missing.length)
            return <Empty icon={<CalendarDays size={26} />} title="No piket scheduled" sub="Rest day — no duty entries for this date." />;

          return (
            <>
              {rows.map(({ s, u, shift }) => (
                <div key={s.id} className="card flex items-center gap-3 p-3">
                  <Avatar user={u} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{u.name}</p>
                      <Chip tone={TONE[shift.tone]}>{shift.name}</Chip>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-faint">{shift.window} · +{shift.points} pts{s.proof ? " · proof ✓" : ""}</p>
                  </div>
                  {s.done ? (
                    <Chip tone="ok"><Check size={11} /> done</Chip>
                  ) : isPast && s.userId === user.id ? (
                    <Btn variant="ghost" className="!px-2.5 !py-1.5 text-[12px]" busy={uploading === s.id} onClick={() => uploadProof(s)}>
                      <Camera size={13} /> Proof
                    </Btn>
                  ) : isPast && isAdmin ? (
                    <button onClick={() => { markDutyDone(s.id); toast(`Marked ${u.name} duty complete (+${shift.points} pts)`); }}
                      className="tap rounded-lg border border-ok/30 bg-ok/10 p-2 text-ok" aria-label="Mark done"><Check size={14} /></button>
                  ) : isFuture ? (
                    <Chip tone="mut">upcoming</Chip>
                  ) : (
                    <Chip tone="amber">today</Chip>
                  )}
                  {isAdmin && (
                    <button onClick={() => setEditEntry(s)} className="tap rounded-lg border border-line bg-panel2 px-2 py-1.5 font-mono text-[10px] uppercase text-mut hover:text-ink">edit</button>
                  )}
                </div>
              ))}

              {missing.map((u) => (
                <button key={u.id} onClick={() => setAssignFor(u)}
                  className="tap flex w-full items-center gap-3 rounded-xl border border-dashed border-line bg-panel/40 p-3 text-left hover:border-amber/50">
                  <Avatar user={u} size={32} />
                  <span className="flex-1 text-[13px] text-faint">{u.name} — unscheduled</span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-amber"><Plus size={13} /> assign</span>
                </button>
              ))}
            </>
          );
        })()}
      </div>

      {/* edit entry sheet */}
      <Sheet open={!!editEntry} onClose={() => setEditEntry(null)} title="Edit assignment">
        {editEntry && (() => {
          const u = db.users.find((x) => x.id === editEntry.userId)!;
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar user={u} size={40} />
                <div>
                  <p className="text-[14px] font-semibold text-ink">{u.name}</p>
                  <p className="font-mono text-[11px] text-faint">{fmtDate(editEntry.date)} · {u.department}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {db.shifts.map((sh) => (
                  <button key={sh.id}
                    onClick={() => { assignShift(u.id, editEntry.date, sh.id); toast(`${u.name} → ${sh.name} shift`); setEditEntry(null); }}
                    className={`tap rounded-xl border p-3 text-center ${editEntry.shiftId === sh.id ? "border-amber/60 bg-amber/10" : "border-line bg-panel2 hover:border-faint"}`}>
                    <p className="ttl text-[13px] font-bold text-ink">{sh.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-faint">{sh.window}</p>
                    <Chip tone={TONE[sh.tone]} className="mt-1.5">+{sh.points}</Chip>
                  </button>
                ))}
              </div>
              <Btn variant="danger" className="w-full" onClick={() => { removeSchedule(editEntry.id); toast("Assignment removed", "info"); setEditEntry(null); }}>
                <Trash2 size={14} /> Remove from roster
              </Btn>
            </div>
          );
        })()}
      </Sheet>

      {/* assign sheet */}
      <Sheet open={!!assignFor} onClose={() => setAssignFor(null)} title={`Assign ${assignFor?.name.split(" ")[0] ?? ""}`}>
        <div className="grid grid-cols-3 gap-2">
          {db.shifts.map((sh) => (
            <button key={sh.id}
              onClick={() => { if (assignFor) { assignShift(assignFor.id, selDay, sh.id); toast(`${assignFor.name} → ${sh.name} on ${fmtDate(selDay)}`); } setAssignFor(null); }}
              className="tap rounded-xl border border-line bg-panel2 p-3 text-center hover:border-amber/60">
              <p className="ttl text-[13px] font-bold text-ink">{sh.name}</p>
              <p className="mt-0.5 font-mono text-[10px] text-faint">{sh.window}</p>
              <Chip tone={TONE[sh.tone]} className="mt-1.5">+{sh.points}</Chip>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/* ---------------- points ---------------- */
function Points({ user }: { user: User }) {
  const db = getDB();
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
            <p className="ttl text-[12px] font-bold text-mut">Available balance</p>
            <p className="mt-1 font-mono text-[36px] font-semibold leading-none text-amber">{user.points}<span className="text-[15px] text-mut"> pts</span></p>
          </div>
          <Gift size={34} className="text-amber/30" />
        </div>
        <div className="mt-3 flex gap-4 font-mono text-[11.5px] text-mut">
          <span><span className="text-ok">+{earned}</span> earned (recent)</span>
          <span><span className="text-bad">−{spent}</span> redeemed</span>
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-faint">points expire after {db.settings.pointsExpiryMonths} months</p>
      </div>

      <SectionTitle>Ledger</SectionTitle>
      {ledger.length === 0 ? (
        <Empty icon={<Gift size={26} />} title="No point activity yet" sub="Complete piket duties to start earning points." />
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
  const [target, setTarget] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
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
      toast(res.msg + " — collect at admin office", "ok");
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#ffb224", "#3ed598", "#5ac8e8"], disableForReducedMotion: true });
    } else toast(res.msg, "err");
    setTarget(null);
  };

  return (
    <div className="a-fadein space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[12px] text-mut">Balance: <span className="font-semibold text-amber">{user.points} pts</span></p>
        {isAdmin && <Btn variant="ghost" className="!px-3 !py-1.5 text-[12px]" onClick={() => setShowAdd(true)}><Plus size={13} /> Add item</Btn>}
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
              <p className="mt-0.5 font-mono text-[10.5px] text-faint">{i.stock} in stock</p>
              <button onClick={() => !out && setTarget(i.id)} disabled={out}
                className={`tap mt-2.5 flex w-full items-center justify-between rounded-lg border px-2.5 py-2 ${afford && !out ? "border-amber/40 bg-amber/10 text-amber hover:bg-amber/18" : "border-line bg-panel2 text-faint"}`}>
                <span className="font-mono text-[13px] font-semibold">{i.cost} pts</span>
                <span className="ttl text-[11px] font-bold">{out ? "empty" : "redeem"}</span>
              </button>
            </div>
          );
        })}
      </div>

      <SectionTitle right={<History size={14} className="text-faint" />}>Your redemptions</SectionTitle>
      {history.length === 0 ? (
        <Empty icon={<Ticket size={26} />} title="Nothing redeemed yet" sub="Your reward history will appear here." />
      ) : (
        <div className="card divide-y divide-line2">
          {history.map((r) => {
            const it = db.items.find((i) => i.id === r.itemId);
            return (
              <div key={r.id} className="flex items-center justify-between px-3.5 py-2.5">
                <div>
                  <p className="text-[13px] font-medium text-ink">{it?.name ?? "Item"}</p>
                  <p className="font-mono text-[10.5px] text-faint">{fmtDate(r.date)} · collect at office</p>
                </div>
                <span className="font-mono text-[13px] font-semibold text-bad">−{r.cost}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* redeem confirm */}
      <Sheet open={!!item} onClose={() => setTarget(null)} title="Confirm redemption">
        {item && (
          <div className="space-y-4">
            <div className="card2 flex items-center gap-3 p-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber/12 text-amber"><Gift size={20} /></span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-ink">{item.name}</p>
                <p className="font-mono text-[11px] text-faint">{item.cost} pts · {item.stock} left</p>
              </div>
              <Chip tone={user.points >= item.cost ? "ok" : "bad"}>{user.points >= item.cost ? "afford" : "short"}</Chip>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-dashed border-line px-3.5 py-2.5 font-mono text-[12px] text-mut">
              <span>Balance after</span>
              <span className="text-ink">{Math.max(0, user.points - item.cost)} pts</span>
            </div>
            <Btn className="w-full" disabled={user.points < item.cost} onClick={doRedeem}>
              <Ticket size={15} /> Redeem for {item.cost} pts
            </Btn>
          </div>
        )}
      </Sheet>

      {/* admin add item */}
      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="New reward item">
        <div className="space-y-3.5">
          <Field label="Name"><input className="inp" value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Rain jacket" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost (pts)"><input className="inp font-mono" type="number" value={nCost} onChange={(e) => setNCost(Number(e.target.value))} /></Field>
            <Field label="Stock"><input className="inp font-mono" type="number" value={nStock} onChange={(e) => setNStock(Number(e.target.value))} /></Field>
          </div>
          <Field label="Category">
            <div className="flex gap-2">
              {(["Essentials", "Voucher", "Gear"] as const).map((c) => (
                <button key={c} onClick={() => setNCat(c)} className={`tap ttl flex-1 rounded-lg border px-2 py-2 text-[12px] font-bold ${nCat === c ? "border-amber/60 bg-amber/12 text-amber" : "border-line bg-panel2 text-mut"}`}>{c}</button>
              ))}
            </div>
          </Field>
          <Btn className="w-full" onClick={() => {
            if (!nName.trim() || nCost <= 0) { toast("Name and positive cost required", "err"); return; }
            addItem({ name: nName.trim(), cost: nCost, stock: nStock, cat: nCat });
            toast(`${nName.trim()} added to catalog`);
            setShowAdd(false); setNName("");
          }}><Plus size={15} /> Add to catalog</Btn>
          <Btn variant="ghost" className="w-full" onClick={() => setConfirmReset(true)}>Grant yourself +50 bonus pts (demo)</Btn>
        </div>
      </Sheet>

      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} danger={false}
        title="Grant bonus points" body={`Add +50 bonus points to ${user.name}? This is logged in the ledger.`}
        yesLabel="Grant" onYes={() => { grantBonus(user.id, 50, "Admin bonus"); toast("+50 pts granted"); }} />
    </div>
  );
}
