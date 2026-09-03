import { useState } from "react";
import { CalendarOff, ChevronRight, Gift, LogOut, Moon, Send, Star, Sun } from "lucide-react";
import type { User } from "../types";
import { getDB, requestLeave, updateSettings, logout } from "../lib/store";
import { fmtDate, todayKey } from "../lib/util";
import { Avatar, Btn, Chip, Field, SectionTitle, Sheet, Toggle, toast } from "../components/ui";

const ALLOWANCE = 12;

export default function Me({ user, onLogout }: { user: User; onLogout: () => void }) {
  const db = getDB();
  const [showLeave, setShowLeave] = useState(false);
  const [from, setFrom] = useState(todayKey());
  const [to, setTo] = useState(todayKey());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!db) return null;

  const approvedDays = db.leaves
    .filter((l) => l.userId === user.id && l.status === "approved")
    .reduce((s, l) => s + Math.max(1, Math.round((new Date(l.to).getTime() - new Date(l.from).getTime()) / 864e5) + 1), 0);
  const remaining = Math.max(0, ALLOWANCE - approvedDays);
  const myLeaves = db.leaves.filter((l) => l.userId === user.id);

  const submit = () => {
    if (!reason.trim()) { toast("A reason is required", "err"); return; }
    if (to < from) { toast("End date before start date", "err"); return; }
    setBusy(true);
    setTimeout(() => {
      requestLeave({ userId: user.id, from, to, reason: reason.trim() });
      setBusy(false);
      setShowLeave(false);
      setReason("");
      toast("Leave request sent to admin for approval", "ok");
    }, 550);
  };

  const LSTATUS = { pending: "amber", approved: "ok", rejected: "bad" } as const;

  return (
    <div className="stagger space-y-3">
      {/* profile */}
      <div className="card relative overflow-hidden">
        <div className="hazard h-1.5 w-full" />
        <div className="flex items-center gap-4 p-4">
          <Avatar user={user} size={56} ring />
          <div className="min-w-0 flex-1">
            <h1 className="ttl truncate text-[22px] font-bold leading-tight text-ink">{user.name}</h1>
            <p className="mt-0.5 font-mono text-[11px] text-faint">{user.employeeId} · {user.department}</p>
            <div className="mt-1.5 flex gap-1.5">
              <Chip tone="amber">{user.role}</Chip>
              {user.faceEnrolled && <Chip tone="ok">face id</Chip>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line2 border-t border-line2 text-center">
          <div className="py-3">
            <p className="font-mono text-[19px] font-semibold text-amber">{user.points}</p>
            <p className="ttl text-[10px] font-bold text-faint">points</p>
          </div>
          <div className="py-3">
            <p className="font-mono text-[19px] font-semibold text-ink">{remaining}d</p>
            <p className="ttl text-[10px] font-bold text-faint">leave left</p>
          </div>
          <div className="py-3">
            <p className="font-mono text-[19px] font-semibold text-ink">{new Date(user.joinedAt).getFullYear()}</p>
            <p className="ttl text-[10px] font-bold text-faint">joined</p>
          </div>
        </div>
      </div>

      {/* leave */}
      <div>
        <SectionTitle right={<Btn className="!px-3 !py-1.5 text-[12px]" onClick={() => setShowLeave(true)}><Send size={13} /> Request</Btn>}>
          <span className="inline-flex items-center gap-1.5"><CalendarOff size={14} className="text-amber" /> Annual leave</span>
        </SectionTitle>
        <div className="card mb-2 p-3.5">
          <div className="flex items-center justify-between font-mono text-[11.5px] text-mut">
            <span>{approvedDays} of {ALLOWANCE} days used</span>
            <span className="text-ok">{Math.round((remaining / ALLOWANCE) * 100)}% remaining</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line2">
            <div className="h-full rounded-full bg-gradient-to-r from-amber to-ok transition-all duration-700" style={{ width: `${(remaining / ALLOWANCE) * 100}%` }} />
          </div>
        </div>
        {myLeaves.length === 0 ? (
          <p className="px-1 font-mono text-[11.5px] text-faint">No leave requests yet.</p>
        ) : (
          <div className="card divide-y divide-line2">
            {myLeaves.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-3.5 py-2.5">
                <div>
                  <p className="font-mono text-[12.5px] font-medium text-ink">{fmtDate(l.from)} → {fmtDate(l.to)}</p>
                  <p className="mt-0.5 text-[11.5px] text-faint">{l.reason}</p>
                </div>
                <Chip tone={LSTATUS[l.status]}>{l.status}</Chip>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* quick links */}
      <div className="card divide-y divide-line2">
        <button className="tap flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => toast(`Piket balance: ${user.points} pts — redeem in the Piket tab`, "info")}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber/12 text-amber"><Star size={15} /></span>
          <span className="flex-1 text-[13px] font-semibold text-ink">Points & rewards</span>
          <ChevronRight size={15} className="text-faint" />
        </button>
        <button className="tap flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => toast("Redeem catalog lives in Piket → Rewards", "info")}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ok/12 text-ok"><Gift size={15} /></span>
          <span className="flex-1 text-[13px] font-semibold text-ink">Reward catalog</span>
          <ChevronRight size={15} className="text-faint" />
        </button>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cool/12 text-cool">
            {db.settings.theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
          </span>
          <span className="flex-1 text-[13px] font-semibold text-ink">Night-shift mode</span>
          <Toggle on={db.settings.theme === "dark"} onChange={(v) => updateSettings({ theme: v ? "dark" : "light" })} />
        </div>
      </div>

      <Btn variant="danger" className="w-full py-3" onClick={() => { logout(); onLogout(); toast("Signed out — session token revoked", "info"); }}>
        <LogOut size={15} /> Sign out
      </Btn>
      <p className="pb-2 text-center font-mono text-[10px] uppercase tracking-widest text-faint">
        {db.settings.appName} v1.0 · session JWT · 1h expiry
      </p>

      {/* leave sheet */}
      <Sheet open={showLeave} onClose={() => setShowLeave(false)} title="Request annual leave">
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><input className="inp font-mono" type="date" min={todayKey()} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><input className="inp font-mono" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-dashed border-line px-3.5 py-2.5">
            <span className="font-mono text-[12px] text-mut">Days requested</span>
            <span className="font-mono text-[15px] font-semibold text-amber">
              {Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 864e5) + 1)}d
            </span>
          </div>
          {remaining === 0 && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[12px] text-bad">Annual allowance exhausted — request will need special approval.</p>}
          <Field label="Reason">
            <textarea className="inp min-h-[70px] resize-none" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Family event — out of town" />
          </Field>
          <Btn className="w-full" busy={busy} onClick={submit}><Send size={14} /> Submit request</Btn>
        </div>
      </Sheet>
    </div>
  );
}
