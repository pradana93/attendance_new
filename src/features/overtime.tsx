import { useMemo, useState } from "react";
import { CalendarDays, Camera, Check, Download, FileText, Plus, X } from "lucide-react";
import type { OTReq, User } from "../types";
import { cancelOT, decideOT, getDB, submitOT, userName } from "../lib/store";
import { downloadCSV, fmtDate, hoursBetween, todayKey, wait } from "../lib/util";
import { Avatar, Btn, Chip, Confirm, Empty, Field, Sheet, toast } from "../components/ui";

type Filter = "all" | "mine" | "pending";

export default function Overtime({ user }: { user: User }) {
  const db = getDB();
  const isAdmin = user.role !== "staff";
  const [filter, setFilter] = useState<Filter>(isAdmin ? "pending" : "all");
  const [showNew, setShowNew] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  // form state
  const [fDate, setFDate] = useState(todayKey());
  const [fStart, setFStart] = useState("17:00");
  const [fEnd, setFEnd] = useState("19:00");
  const [fReason, setFReason] = useState("");
  const [fPhoto, setFPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  // admin decision
  const [decision, setDecision] = useState<{ req: OTReq; approve: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);

  const list = useMemo(() => {
    if (!db) return [];
    let l = [...db.ot].sort((a, b) => b.date.localeCompare(a.date));
    if (!isAdmin) l = l.filter((o) => o.userId === user.id);
    if (filter === "pending") l = l.filter((o) => o.status === "pending");
    if (filter === "mine") l = l.filter((o) => o.userId === user.id);
    return l;
  }, [db, filter, isAdmin, user.id]);

  if (!db) return null;
  const month = todayKey().slice(0, 7);
  const approvedMonth = db.ot.filter((o) => o.status === "approved" && o.date.startsWith(month) && (isAdmin || o.userId === user.id));
  const approvedHrs = Math.round(approvedMonth.reduce((s, o) => s + hoursBetween(o.start, o.end), 0) * 10) / 10;
  const pendingCount = db.ot.filter((o) => o.status === "pending" && (isAdmin || o.userId === user.id)).length;

  const exportCsv = () => {
    const rows: (string | number)[][] = [["Date", "Employee", "ID", "Start", "End", "Hours", "Reason", "Status", "Decided by", "Note"]];
    list.forEach((o) => {
      const u = db.users.find((x) => x.id === o.userId);
      rows.push([o.date, u?.name ?? "", u?.employeeId ?? "", o.start, o.end, hoursBetween(o.start, o.end), o.reason, o.status, o.by ?? "", o.note ?? ""]);
    });
    downloadCSV(`overtime_${month}.csv`, rows);
    toast(`Exported ${list.length} rows to CSV`, "ok");
  };

  const submit = async () => {
    if (!fReason.trim()) { toast("A reason is required", "err"); return; }
    if (hoursBetween(fStart, fEnd) <= 0) { toast("End must be after start", "err"); return; }
    setBusy(true);
    await wait(600);
    submitOT({ userId: user.id, date: fDate, start: fStart, end: fEnd, reason: fReason.trim(), photo: fPhoto });
    setBusy(false);
    setShowNew(false);
    setFReason("");
    toast(`Overtime request submitted — ${hoursBetween(fStart, fEnd)}h on ${fmtDate(fDate)}`, "ok");
  };

  const decide = async () => {
    if (!decision) return;
    setDeciding(true);
    await wait(450);
    decideOT(decision.req.id, decision.approve, note.trim(), user.name);
    setDeciding(false);
    setNote("");
    toast(`Request ${decision.approve ? "approved" : "rejected"} — ${userName(decision.req.userId)} notified`, decision.approve ? "ok" : "info");
    setDecision(null);
  };

  const STATUS: Record<OTReq["status"], "amber" | "ok" | "bad"> = { pending: "amber", approved: "ok", rejected: "bad" };

  return (
    <div className="stagger space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-faint">overtime</p>
          <h1 className="ttl text-[24px] font-bold leading-tight text-ink">{isAdmin ? "Requests & approvals" : "Your overtime"}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="tap flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-2.5 py-2 font-mono text-[11px] text-mut hover:text-ink" title="Export CSV">
            <Download size={13} /> CSV
          </button>
          <Btn className="!px-3 !py-2" onClick={() => setShowNew(true)}><Plus size={15} /> New</Btn>
        </div>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3.5">
          <p className="ttl text-[11px] font-bold text-mut">Approved · {month}</p>
          <p className="mt-1.5 font-mono text-[26px] font-semibold leading-none text-ok">{approvedHrs}<span className="text-[13px] text-mut">h</span></p>
        </div>
        <div className="card p-3.5">
          <p className="ttl text-[11px] font-bold text-mut">Pending review</p>
          <p className="mt-1.5 font-mono text-[26px] font-semibold leading-none text-amber">{pendingCount}</p>
        </div>
      </div>

      {/* filters */}
      <div className="flex gap-2">
        {(isAdmin ? (["pending", "all", "mine"] as Filter[]) : (["all", "pending"] as Filter[])).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`tap ttl rounded-lg border px-3 py-1.5 text-[12px] font-bold ${filter === f ? "border-amber/60 bg-amber/12 text-amber" : "border-line bg-panel2 text-mut"}`}>
            {f === "mine" ? "My team" : f}
          </button>
        ))}
      </div>

      {/* list */}
      {list.length === 0 ? (
        <Empty icon={<FileText size={26} />} title="No overtime requests" sub={isAdmin ? "Nothing awaiting review right now." : "Submit your first request with the New button."} />
      ) : (
        <div className="space-y-2">
          {list.map((o) => {
            const u = db.users.find((x) => x.id === o.userId);
            const hrs = hoursBetween(o.start, o.end);
            return (
              <div key={o.id} className="card p-3.5">
                <div className="flex items-start gap-3">
                  {isAdmin && u && <Avatar user={u} size={34} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isAdmin && <p className="truncate text-[13.5px] font-semibold text-ink">{u?.name}</p>}
                      <Chip tone={STATUS[o.status]}>{o.status}</Chip>
                      {o.photo && <Chip tone="cool"><Camera size={10} /> proof</Chip>}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 font-mono text-[12px] text-mut">
                      <CalendarDays size={12} className="text-faint" /> {fmtDate(o.date)} · {o.start}–{o.end}
                      <span className="text-amber">· {hrs}h</span>
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-mut">{o.reason}</p>
                    {o.note && <p className="mt-1 rounded-lg bg-panel2 px-2.5 py-1.5 text-[11.5px] italic text-faint">“{o.note}” — {o.by}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {o.status === "pending" && isAdmin && (
                      <>
                        <button onClick={() => { setDecision({ req: o, approve: true }); setNote(""); }}
                          className="tap flex items-center justify-center rounded-lg border border-ok/30 bg-ok/10 p-2 text-ok" aria-label="Approve"><Check size={15} /></button>
                        <button onClick={() => { setDecision({ req: o, approve: false }); setNote(""); }}
                          className="tap flex items-center justify-center rounded-lg border border-bad/30 bg-bad/10 p-2 text-bad" aria-label="Reject"><X size={15} /></button>
                      </>
                    )}
                    {o.status === "pending" && !isAdmin && (
                      <button onClick={() => setConfirmCancel(o.id)} className="tap rounded-lg border border-line bg-panel2 px-2 py-1.5 font-mono text-[10px] uppercase text-mut hover:text-bad">cancel</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint">HR report pack · CSV export · department filters</p>

      {/* new request sheet */}
      <Sheet open={showNew} onClose={() => setShowNew(false)} title="New overtime request">
        <div className="space-y-3.5">
          <Field label="Date"><input className="inp font-mono" type="date" value={fDate} max={todayKey()} onChange={(e) => setFDate(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><input className="inp font-mono" type="time" value={fStart} onChange={(e) => setFStart(e.target.value)} /></Field>
            <Field label="End"><input className="inp font-mono" type="time" value={fEnd} onChange={(e) => setFEnd(e.target.value)} /></Field>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-dashed border-line px-3.5 py-2.5">
            <span className="font-mono text-[12px] text-mut">Computed duration</span>
            <span className="font-mono text-[15px] font-semibold text-amber">{hoursBetween(fStart, fEnd)}h</span>
          </div>
          <Field label="Reason / description">
            <textarea className="inp min-h-[76px] resize-none" value={fReason} onChange={(e) => setFReason(e.target.value)} placeholder="e.g. Inbound container backlog — dock 2" />
          </Field>
          <button onClick={() => setFPhoto(!fPhoto)}
            className={`tap flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-3 ${fPhoto ? "border-cool/50 bg-cool/10" : "border-dashed border-line bg-panel2"}`}>
            <Camera size={16} className={fPhoto ? "text-cool" : "text-faint"} />
            <span className={`text-[13px] ${fPhoto ? "text-cool" : "text-mut"}`}>{fPhoto ? "Supporting photo attached ✓" : "Attach supporting photo (optional)"}</span>
          </button>
          <Btn className="w-full" busy={busy} onClick={submit}>Submit for approval</Btn>
        </div>
      </Sheet>

      {/* decision sheet */}
      <Sheet open={!!decision} onClose={() => setDecision(null)} title={decision?.approve ? "Approve overtime" : "Reject overtime"}>
        {decision && (
          <div className="space-y-3.5">
            <div className="card2 p-3.5 font-mono text-[12.5px] text-mut">
              {userName(decision.req.userId)} · {fmtDate(decision.req.date)} · {decision.req.start}–{decision.req.end}
              <span className="text-amber"> ({hoursBetween(decision.req.start, decision.req.end)}h)</span>
              <p className="mt-1.5 font-sans text-[12.5px] italic text-faint">“{decision.req.reason}”</p>
            </div>
            <Field label="Note to employee (optional)">
              <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder={decision.approve ? "Well earned — thanks!" : "Overlaps with scheduled piket"} />
            </Field>
            <div className="flex gap-2.5">
              <Btn variant="ghost" className="flex-1" onClick={() => setDecision(null)}>Back</Btn>
              <Btn variant={decision.approve ? "ok" : "danger"} className="flex-1" busy={deciding} onClick={decide}>
                {decision.approve ? <><Check size={15} /> Approve</> : <><X size={15} /> Reject</>}
              </Btn>
            </div>
          </div>
        )}
      </Sheet>

      <Confirm open={!!confirmCancel} onClose={() => setConfirmCancel(null)} danger
        title="Cancel request" body="Withdraw this pending overtime request? This cannot be undone."
        yesLabel="Withdraw" onYes={() => { if (confirmCancel) { cancelOT(confirmCancel); toast("Request withdrawn", "info"); } }} />

    </div>
  );
}
