import { useMemo, useState } from "react";
import {
  Banknote, CalendarPlus, Camera, Check, Clock3, Download, Filter, History, Search, Timer, X,
} from "lucide-react";
import type { Overtime, User } from "../types";
import { cancelOvertime, decideOvertime, getDB, otHours, submitOvertime, userName } from "../lib/store";
import { downloadCSV, fmtDate, fmtIDR, fmtIDRFull, hoursBetween, relTime, todayKey } from "../lib/util";
import { useT } from "../lib/i18n";
import { Avatar, Btn, Chip, Confirm, Empty, Field, Reveal, SectionTitle, Seg, Sheet, toast } from "../components/ui";
import { CaptureSheet, Lightbox } from "../components/capture";

const TONE: Record<Overtime["status"], "amber" | "ok" | "bad"> = { pending: "amber", approved: "ok", rejected: "bad" };

export default function Overtime({ user }: { user: User }) {
  const db = getDB();
  const t = useT();
  const isAdmin = user.role !== "staff";
  const [scope, setScope] = useState<"mine" | "all">(isAdmin ? "all" : "mine");
  const [status, setStatus] = useState<"all" | Overtime["status"]>("all");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ id: string; approve: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [viewPhoto, setViewPhoto] = useState<{ src: string; caption: string } | null>(null);

  const month = todayKey().slice(0, 7);
  const approvedMonth = useMemo(() => (db?.ot ?? []).filter((o) => o.status === "approved" && o.date.startsWith(month)), [db, month]);
  const approvedHours = approvedMonth.reduce((s, o) => s + otHours(o), 0);
  const pending = (db?.ot ?? []).filter((o) => o.status === "pending");
  const rate = db?.settings.otRate ?? 0;

  const list = useMemo(() => {
    let rows = db?.ot ?? [];
    if (scope === "mine" || !isAdmin) rows = rows.filter((o) => o.userId === user.id);
    if (status !== "all") rows = rows.filter((o) => o.status === status);
    if (query.trim()) rows = rows.filter((o) => userName(o.userId).toLowerCase().includes(query.toLowerCase()));
    return [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [db, scope, status, query, isAdmin, user.id]);

  if (!db) return null;
  const detailRow = db.ot.find((o) => o.id === detail);

  const exportCsv = () => {
    downloadCSV("overtime-report", [
      ["Date", "Employee", "Dept", "Start", "End", "Hours", "Reason", "Status", "Note", "Est. payout (IDR)"],
      ...list.map((o) => {
        const u = db.users.find((x) => x.id === o.userId);
        return [o.date, userName(o.userId), u?.department ?? "", o.start, o.end, String(otHours(o)), o.reason, o.status, o.note ?? "", String(otHours(o) * rate)];
      }),
    ]);
    toast("CSV downloaded");
  };

  return (
    <div className="a-fadein space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-faint">{t("o.title")}</p>
          <h1 className="ttl text-[24px] font-bold leading-tight text-ink">{isAdmin ? "OT console" : t("o.title")}</h1>
        </div>
        <Btn onClick={() => setShowNew(true)}><CalendarPlus size={15} /> {t("o.newRequest")}</Btn>
      </div>

      {/* summary chips */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 text-amber"><Clock3 size={12} /><span className="ttl text-[10px] font-bold text-mut">{t("o.pendingQ")}</span></div>
          <p className="mt-1.5 font-mono text-[20px] font-semibold leading-none text-ink">{isAdmin ? pending.length : pending.filter((o) => o.userId === user.id).length}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 text-cool"><Timer size={12} /><span className="ttl text-[10px] font-bold text-mut">{t("o.approvedH")}</span></div>
          <p className="mt-1.5 font-mono text-[20px] font-semibold leading-none text-ink">{approvedHours}h</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 text-ok"><Banknote size={12} /><span className="ttl text-[10px] font-bold text-mut">{t("o.estPayout")}</span></div>
          <p className="mt-1.5 font-mono text-[15px] font-semibold leading-none text-ink">{fmtIDR(approvedHours * rate)}</p>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && (
          <Seg small options={[{ id: "all", label: t("o.allStaff") }, { id: "mine", label: t("o.mine") }]} value={scope} onChange={setScope} />
        )}
        <div className="flex gap-1.5">
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`tap ttl rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${status === s ? "border-amber/55 bg-amber/12 text-amber" : "border-line bg-panel2 text-mut"}`}>
              {s === "all" ? t("c.all") : s}
            </button>
          ))}
        </div>
        {isAdmin && scope === "all" && (
          <div className="relative ml-auto">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input className="inp !w-32 !py-1.5 pl-7 text-[12px]" placeholder={t("o.filterStaff")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        )}
        {isAdmin && <button onClick={exportCsv} className="tap ml-auto flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-2.5 py-1.5 font-mono text-[11px] text-mut hover:text-ink"><Download size={12} /> {t("o.export")}</button>}
      </div>

      {/* list */}
      <Reveal delay={50}>
      {list.length === 0 ? (
        <Empty icon={<History size={26} />} title={t("o.noOt")} sub={t("o.noOtSub")} />
      ) : (
        <div className="space-y-2">
          {list.map((o) => {
            const u = db.users.find((x) => x.id === o.userId);
            const h = otHours(o);
            return (
              <button key={o.id} onClick={() => setDetail(o.id)} className="tap card w-full p-3.5 text-left hover:border-amber/40">
                <div className="flex items-center gap-3">
                  {isAdmin && scope === "all" && u && <Avatar user={u} size={32} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[13.5px] font-semibold text-ink">{fmtDate(o.date)}</p>
                      <Chip tone={TONE[o.status]}>{o.status}</Chip>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-mut">
                      <span className="truncate">{isAdmin && scope === "all" ? `${userName(o.userId)} · ` : ""}{o.start}–{o.end} · {h}h · {o.reason}</span>
                      {o.photo && <Camera size={11} className="shrink-0 text-cool" />}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[13px] font-semibold text-ink">{fmtIDR(h * rate)}</p>
                    <p className="font-mono text-[9.5px] uppercase text-faint">{relTime(o.createdAt)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      </Reveal>

      <NewRequest user={user} open={showNew} onClose={() => setShowNew(false)} />

      {/* detail sheet */}
      <Sheet open={!!detailRow} onClose={() => setDetail(null)} title={t("o.requestDetail")}>
        {detailRow && (() => {
          const h = otHours(detailRow);
          return (
            <div className="space-y-4">
              <div className="card2 space-y-2 p-3.5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[15px] font-semibold text-ink">{fmtDate(detailRow.date)} · {detailRow.start}–{detailRow.end}</p>
                  <Chip tone={TONE[detailRow.status]}>{detailRow.status}</Chip>
                </div>
                <p className="text-[13px] text-mut">{detailRow.reason}</p>
                {detailRow.photo && (
                  <button onClick={() => setViewPhoto({ src: detailRow.photo!, caption: `${t("o.title")} · ${fmtDate(detailRow.date)} · ${userName(detailRow.userId)}` })}
                    className="tap flex w-full items-center gap-3 rounded-lg border border-line bg-panel p-2 text-left hover:border-amber/50">
                    <img src={detailRow.photo} alt="" className="h-14 w-[76px] rounded-md border border-line object-cover" />
                    <div>
                      <p className="ttl text-[12px] font-bold text-ink">{t("a.photo")} · {t("c.optional")}</p>
                      <p className="font-mono text-[10.5px] text-faint">tap to view full size</p>
                    </div>
                  </button>
                )}
                <div className="flex items-center justify-between border-t border-line2 pt-2 font-mono text-[12px]">
                  <span className="text-faint">{userName(detailRow.userId)} · {h}h</span>
                  <span className="text-ok">{fmtIDRFull(h * rate)}</span>
                </div>
              </div>

              {/* timeline */}
              <div>
                <p className="ttl mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">{t("o.timeline")}</p>
                <div className="space-y-0">
                  <TimelineRow icon={<CalendarPlus size={12} />} label={t("o.submitted")} value={`${relTime(detailRow.createdAt)} · ${userName(detailRow.userId)}`} tone="text-mut" />
                  {detailRow.status !== "pending" && (
                    <TimelineRow last icon={detailRow.status === "approved" ? <Check size={12} /> : <X size={12} />}
                      label={`${t("o.decided")} — ${detailRow.status}`}
                      value={`${detailRow.decidedAt ? relTime(detailRow.decidedAt) : ""}${detailRow.note ? ` · "${detailRow.note}"` : ""}`}
                      tone={detailRow.status === "approved" ? "text-ok" : "text-bad"} />
                  )}
                  {detailRow.status === "pending" && <TimelineRow last icon={<Clock3 size={12} />} label={t("o.pendingQ")} value="—" tone="text-amber" />}
                </div>
              </div>

              {isAdmin && detailRow.status === "pending" && (
                <div className="flex gap-2.5">
                  <Btn variant="ok" className="flex-1" onClick={() => { setDeciding({ id: detailRow.id, approve: true }); setNote(""); }}><Check size={15} /> {t("o.approve")}</Btn>
                  <Btn variant="danger" className="flex-1" onClick={() => { setDeciding({ id: detailRow.id, approve: false }); setNote(""); }}><X size={15} /> {t("o.reject")}</Btn>
                </div>
              )}
              {!isAdmin && detailRow.status === "pending" && detailRow.userId === user.id && (
                <Btn variant="ghost" className="w-full" onClick={() => setCancelId(detailRow.id)}><X size={14} /> {t("o.cancelReq")}</Btn>
              )}
            </div>
          );
        })()}
      </Sheet>

      {/* decide sheet */}
      <Sheet open={!!deciding} onClose={() => setDeciding(null)} title={deciding?.approve ? t("o.approve") : t("o.reject")}>
        <div className="space-y-3.5">
          <Field label={`${t("o.note")} (${t("c.optional").toLowerCase()})`}>
            <textarea className="inp min-h-[64px] resize-none" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={deciding?.approve ? "Approved — good work." : "Reason for rejection…"} />
          </Field>
          <Btn variant={deciding?.approve ? "ok" : "danger"} className="w-full" onClick={() => {
            if (!deciding) return;
            decideOvertime(deciding.id, deciding.approve, note.trim(), user.name);
            toast(deciding.approve ? "Overtime approved" : "Overtime rejected", deciding.approve ? "ok" : "info");
            setDeciding(null); setDetail(null);
          }}>
            {deciding?.approve ? <Check size={15} /> : <X size={15} />} {deciding?.approve ? t("o.approve") : t("o.reject")}
          </Btn>
        </div>
      </Sheet>

      <Confirm open={!!cancelId} onClose={() => setCancelId(null)} danger title={t("o.cancelReq") + "?"}
        body="The pending request will be removed." yesLabel={t("c.cancel")}
        onYes={() => { if (cancelId) { cancelOvertime(cancelId); toast("Request cancelled", "info"); setDetail(null); } }} />

      <Lightbox src={viewPhoto?.src ?? null} onClose={() => setViewPhoto(null)} caption={viewPhoto?.caption} />
    </div>
  );
}

function TimelineRow({ icon, label, value, tone, last }: { icon: React.ReactNode; label: string; value: string; tone: string; last?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full border border-line bg-panel2 ${tone}`}>{icon}</span>
        {!last && <span className="w-px flex-1 bg-line2" />}
      </div>
      <div className={`pb-3 ${last ? "" : ""}`}>
        <p className="text-[12.5px] font-semibold text-ink">{label}</p>
        <p className="font-mono text-[11px] text-faint">{value}</p>
      </div>
    </div>
  );
}

/* ---------------- submit ---------------- */
function NewRequest({ user, open, onClose }: { user: User; open: boolean; onClose: () => void }) {
  const db = getDB();
  const t = useT();
  const [date, setDate] = useState(todayKey());
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("19:00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  if (!db) return null;
  const h = hoursBetween(start, end);
  const overlap = db.ot.some((o) => o.userId === user.id && o.date === date && o.status !== "rejected" && !(end <= o.start || start >= o.end));
  const rate = db.settings.otRate;

  return (
    <Sheet open={open} onClose={onClose} title={t("o.newRequest")}>
      <div className="space-y-3.5">
        <Field label={t("o.date")}><input className="inp font-mono" type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("o.start")}><input className="inp font-mono" type="time" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} /></Field>
          <Field label={t("o.end")}><input className="inp font-mono" type="time" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} /></Field>
        </div>
        <Field label={t("o.reason")}><textarea className="inp min-h-[64px] resize-none" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Container unloading overflow…" /></Field>

        {/* supporting photo (optional) */}
        <button onClick={() => setCapturing(true)}
          className={`tap flex w-full items-center gap-3 rounded-xl border p-2.5 text-left ${photo ? "border-ok/40 bg-ok/6" : "border-dashed border-line bg-panel2/50 hover:border-amber/50"}`}>
          {photo ? (
            <img src={photo} alt="" className="h-12 w-16 rounded-lg border border-line object-cover" />
          ) : (
            <span className="flex h-12 w-16 items-center justify-center rounded-lg border border-line bg-panel text-faint"><Camera size={17} /></span>
          )}
          <div className="flex-1">
            <p className="ttl text-[12.5px] font-bold text-ink">{photo ? "Supporting photo attached" : "Attach supporting photo"}</p>
            <p className="font-mono text-[10.5px] text-faint">{photo ? "tap to replace · visible to admin" : `${t("c.optional")} · visible to admin`}</p>
          </div>
          <Chip tone={photo ? "ok" : "mut"}>{photo ? "✓" : "＋"}</Chip>
        </button>

        <div className="card2 flex items-center justify-between px-3.5 py-3">
          <div>
            <p className="font-mono text-[16px] font-semibold text-ink">{h > 0 ? `${h}h` : "—"} <span className="text-[11px] text-mut">· {t("o.estPayout").toLowerCase()}</span></p>
            <p className="mt-0.5 font-mono text-[11px] text-ok">{h > 0 ? fmtIDRFull(h * rate) : "—"} <span className="text-faint">({t("o.estNote", { r: fmtIDR(rate) })})</span></p>
          </div>
          <Timer size={20} className="text-cool" />
        </div>

        {overlap && (
          <div className="flex items-center gap-2 rounded-xl border border-bad/35 bg-bad/8 px-3.5 py-2.5">
            <Filter size={13} className="shrink-0 text-bad" />
            <p className="text-[12px] text-ink">{t("o.overlap")}</p>
          </div>
        )}

        <Btn className="w-full" busy={busy} disabled={h <= 0 || overlap || !reason.trim()} onClick={() => {
          setBusy(true);
          setTimeout(() => {
            const res = submitOvertime(user.id, date, start, end, reason.trim(), photo ?? undefined);
            setBusy(false);
            if (res.ok) { toast(res.msg, "ok"); setReason(""); setPhoto(null); onClose(); }
            else toast(res.msg, "err");
          }, 500);
        }}>
          <CalendarPlus size={15} /> {t("m.submit")}
        </Btn>
      </div>
      <CaptureSheet open={capturing} onClose={() => setCapturing(false)} title={t("o.newRequest")} onSave={setPhoto} />
    </Sheet>
  );
}
