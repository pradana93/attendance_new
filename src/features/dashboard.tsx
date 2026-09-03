import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import {
  CameraOff, ChevronRight, Clock3, MapPin, Megaphone, QrCode, ScanFace, Star, Timer, XCircle,
} from "lucide-react";
import type { Attendance, User } from "../types";
import { getDB, leaderboard, punch, selfReport, statsFor, todayRecord } from "../lib/store";
import { fmtClock, fmtDateLong, fmtTime, haversineM, hoursBetween, locateWithFallback, qrMatrix, randInt, todayKey } from "../lib/util";
import { Btn, Chip, LiveDot, SectionTitle, Sheet, toast } from "../components/ui";
import { Spark } from "../components/charts";

type Kind = "in" | "out" | "done";

/* =============== dashboard =============== */
export default function Dashboard({ user, goTab }: { user: User; goTab: (t: string) => void }) {
  const db = getDB();
  const [now, setNow] = useState(new Date());
  const [flowOpen, setFlowOpen] = useState(false);
  const rec = todayRecord(user.id);
  const stats = useMemo(() => statsFor(user.id), [user.id, now.getMinutes()]); // eslint-disable-line react-hooks/exhaustive-deps
  const todaySched = db?.schedules.find((s) => s.userId === user.id && s.date === todayKey());
  const shift = db?.shifts.find((s) => s.id === todaySched?.shiftId);
  const kind: Kind = rec?.checkIn && rec?.checkOut ? "done" : rec?.checkIn ? "out" : "in";
  const hour = now.getHours();
  const greet = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 19 ? "Sore" : "Malam";
  const isAdmin = user.role !== "staff";
  const onDuty = db?.attendance.filter((a) => a.date === todayKey() && a.checkIn && !a.checkOut) ?? [];
  const pinned = db?.announcements.filter((a) => a.pinned) ?? [];
  const recent = db?.announcements.filter((a) => !a.pinned).slice(0, 2) ?? [];

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="stagger space-y-3">
      {/* greeting */}
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-faint">{fmtDateLong(todayKey())}</p>
          <h1 className="ttl text-[26px] font-bold leading-tight text-ink">
            {greet}, {user.name.split(" ")[0]} <span className="text-amber">·</span>
          </h1>
        </div>
        <Chip tone="amber">{user.employeeId}</Chip>
      </div>

      {/* clock + punch card */}
      <div className="card overflow-hidden">
        <div className="hazard h-1.5 w-full" />
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[38px] font-semibold leading-none tracking-tight text-ink tabular-nums">{fmtClock(now)}</p>
              <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">
                {db?.settings.siteName} · gate beacon active
              </p>
            </div>
            <div className="text-right">
              <LiveDot tone={kind === "out" ? "ok" : "amber"} />
              <p className="ttl mt-1.5 text-[12px] font-bold text-mut">
                {kind === "done" ? "Shift complete" : kind === "out" ? "On duty" : "Not checked in"}
              </p>
              {shift && <Chip tone={shift.tone === "night" ? "cool" : shift.tone === "morning" ? "amber" : "mut"}>{shift.name} piket</Chip>}
            </div>
          </div>

          {kind === "done" ? (
            <div className="card2 mt-4 flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ok/15 text-ok"><Clock3 size={16} /></span>
                <div>
                  <p className="ttl text-[14px] font-bold text-ink">Day logged</p>
                  <p className="font-mono text-[11px] text-mut">{fmtTime(rec?.checkIn)} → {fmtTime(rec?.checkOut)} · {rec && rec.checkIn && rec.checkOut ? hoursBetween(fmtTime(rec.checkIn), fmtTime(rec.checkOut)) : 0}h</p>
                </div>
              </div>
              <Chip tone="ok">done</Chip>
            </div>
          ) : (
            <button onClick={() => setFlowOpen(true)}
              className="tap group mt-4 block w-full overflow-hidden rounded-xl bg-amber text-left shadow-[0_10px_30px_rgba(255,178,36,0.25)] hover:brightness-110">
              <div className="flex items-center justify-between px-4 py-4">
                <div>
                  <p className="ttl text-[22px] font-extrabold leading-none text-[#191203]">
                    {kind === "in" ? "Check in" : "Check out"}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-[#5c4305]">
                    face + GPS verification · ±{db?.settings.radius}m geofence
                  </p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#191203]/10 text-[#191203] transition-transform group-active:scale-90">
                  <ScanFace size={22} />
                </span>
              </div>
              {kind === "out" && (
                <div className="border-t border-[#191203]/15 bg-[#191203]/8 px-4 py-1.5 font-mono text-[11px] text-[#3d2e03]">
                  on duty since {fmtTime(rec?.checkIn)} · {rec?.late ? "late arrival logged" : "on time"}
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      {/* stats strip — asymmetric */}
      <div className="grid grid-cols-5 gap-3">
        <button onClick={() => goTab("piket")} className="tap card col-span-2 p-3.5 text-left hover:border-amber/40">
          <Star size={15} className="text-amber" />
          <p className="mt-2 font-mono text-[24px] font-semibold leading-none text-ink">{user.points}</p>
          <p className="ttl mt-1 text-[11px] font-bold text-mut">Piket points</p>
        </button>
        <button onClick={() => goTab("stats")} className="tap card col-span-3 p-3.5 text-left hover:border-amber/40">
          <div className="flex items-center justify-between">
            <Timer size={15} className="text-cool" />
            <span className="font-mono text-[10px] text-faint">this month</span>
          </div>
          <div className="mt-2 flex items-end gap-3">
            <p className="font-mono text-[24px] font-semibold leading-none text-ink">
              {isAdmin ? Math.round(leaderboard().reduce((s, b) => s + b.pct, 0) / Math.max(1, leaderboard().length)) : stats?.monthPct ?? 0}%
            </p>
            {!isAdmin && <div className="mb-0.5 flex-1 opacity-90"><Spark values={(stats?.weeks ?? [0, 0]).slice(-6)} height={30} /></div>}
          </div>
          <p className="ttl mt-1 text-[11px] font-bold text-mut">{isAdmin ? "Team attendance avg" : "Attendance · 8-wk trend"}</p>
        </button>
      </div>

      {/* admin live pulse */}
      {isAdmin && (
        <button onClick={() => goTab("admin")} className="tap card flex w-full items-center justify-between p-3.5 text-left hover:border-amber/40">
          <div className="flex items-center gap-3">
            <LiveDot />
            <div>
              <p className="ttl text-[14px] font-bold text-ink">{onDuty.length} on duty right now</p>
              <p className="font-mono text-[11px] text-faint">tap for live floor board</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-faint" />
        </button>
      )}

      {/* announcements */}
      <div>
        <SectionTitle right={<button onClick={() => goTab(isAdmin ? "admin" : "me")} className="tap font-mono text-[11px] text-amber">all →</button>}>
          <span className="inline-flex items-center gap-1.5"><Megaphone size={14} className="text-amber" /> Notice board</span>
        </SectionTitle>
        <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
          {[...pinned, ...recent].slice(0, 4).map((a) => (
            <div key={a.id} className="card min-w-[240px] max-w-[280px] shrink-0 p-3.5">
              <div className="flex items-center gap-2">
                {a.pinned && <Chip tone="amber">pinned</Chip>}
                <span className="font-mono text-[10px] text-faint">{a.date}</span>
              </div>
              <p className="ttl mt-1.5 text-[15px] font-bold leading-tight text-ink">{a.title}</p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-mut">{a.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* today detail */}
      {rec?.checkIn && (
        <div className="card p-3.5">
          <p className="ttl mb-2.5 text-[12px] font-bold text-mut">Today's log</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ["In", fmtTime(rec.checkIn), rec.late ? "bad" : "ok"],
              ["Out", rec.checkOut ? fmtTime(rec.checkOut) : "—", "mut"],
              ["Match", rec.inScore ? rec.inScore + "%" : "—", "cool"],
              ["Gate", rec.distance ? rec.distance + "m" : "—", "mut"],
            ].map(([l, v, tone]) => (
              <div key={l as string} className="card2 py-2.5">
                <p className="font-mono text-[15px] font-semibold text-ink">{v}</p>
                <Chip tone={tone as "ok"} className="mt-1.5">{l}</Chip>
              </div>
            ))}
          </div>
          {rec.selfReport && <p className="mt-2 text-center font-mono text-[11px] text-amber">⚠ self-reported — awaiting admin review</p>}
        </div>
      )}

      <CheckFlow user={user} open={flowOpen} onClose={() => setFlowOpen(false)} onDone={() => setNow(new Date())} />
    </div>
  );
}

/* =============== check-in/out flow =============== */
function CheckFlow({ user, open, onClose, onDone }: { user: User; open: boolean; onClose: () => void; onDone: () => void }) {
  const db = getDB();
  const [stage, setStage] = useState<"prep" | "scan" | "qr" | "result">("prep");
  const [mode, setMode] = useState<"face" | "qr">("face");
  const [gps, setGps] = useState<{ state: "busy" | "ok"; dist: number; simulated: boolean }>({ state: "busy", dist: 0, simulated: false });
  const [cam, setCam] = useState<"busy" | "ok" | "denied">("busy");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; kind: Kind; score?: number; dist: number; method: string; reason?: string; rec?: Attendance } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timers = useRef<number[]>([]);
  const openRef = useRef(open);

  // reset + preflight on open
  useEffect(() => {
    openRef.current = open;
    if (!open) {
      setStage("prep"); setProgress(0); setResult(null);
      return;
    }
    if (!db) return;
    setStage("prep"); setMode("face"); setProgress(0); setResult(null);
    setGps({ state: "busy", dist: 0, simulated: false }); setCam("busy");
    let cancelled = false;

    (async () => {
      const pos = await locateWithFallback({ lat: db.settings.lat, lng: db.settings.lng });
      const dist = haversineM(pos.lat, pos.lng, db.settings.lat, db.settings.lng);
      if (!cancelled) setGps({ state: "ok", dist, simulated: pos.simulated });
    })();

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCam("ok");
      } catch {
        if (!cancelled) setCam("denied");
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // re-attach stream when video mounts in scan stage
  useEffect(() => {
    if (stage === "scan" && videoRef.current && streamRef.current && cam === "ok") {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [stage, cam]);

  // auto-advance prep → scan
  useEffect(() => {
    if (!open || stage !== "prep" || gps.state !== "ok" || cam === "busy") return;
    const t = window.setTimeout(() => setStage(mode === "qr" ? "qr" : "scan"), 500);
    return () => clearTimeout(t);
  }, [open, stage, gps, cam, mode]);

  // scan progression
  useEffect(() => {
    if (stage !== "scan") return;
    const iv = window.setInterval(() => {
      setProgress((p) => {
        const n = p + 1.7 + Math.random() * 1.3;
        if (n >= 100) {
          clearInterval(iv);
          window.setTimeout(() => finish("face"), 350);
          return 100;
        }
        return n;
      });
    }, 42);
    return () => clearInterval(iv);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // qr countdown
  useEffect(() => {
    if (stage !== "qr") return;
    const t = window.setTimeout(() => finish("qr"), 2100);
    return () => clearTimeout(t);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (method: "face" | "qr") => {
    if (!db || !openRef.current) return;
    const rec = todayRecord(user.id);
    const kind: Kind = rec?.checkIn && rec?.checkOut ? "done" : rec?.checkIn ? "out" : "in";
    const score = method === "face" ? randInt(88, 99) : undefined;
    const within = gps.dist <= db.settings.radius;
    if (kind === "done") {
      setResult({ ok: true, kind, dist: gps.dist, method, rec });
      setStage("result");
      return;
    }
    if (!within) {
      setResult({ ok: false, kind, score, dist: gps.dist, method, reason: `You are ${gps.dist}m from the gate beacon — outside the ${db.settings.radius}m geofence.` });
      setStage("result");
      return;
    }
    const punched = punch(user.id, kind, { score, distance: gps.dist, method });
    setResult({ ok: true, kind, score, dist: gps.dist, method, rec: punched ?? undefined });
    setStage("result");
    onDone();
    if (method === "face" || method === "qr") {
      confetti({ particleCount: kind === "in" ? 90 : 60, spread: 75, origin: { y: 0.65 }, colors: ["#ffb224", "#3ed598", "#5ac8e8", "#e8edf3"], disableForReducedMotion: true });
    }
    toast(kind === "in" ? `Checked in at ${fmtTime(punched?.checkIn)} — ${punched?.late ? "late arrival" : "on time"}` : `Checked out — shift logged`, kind === "in" && punched?.late ? "info" : "ok");
  };

  const doSelfReport = () => {
    selfReport(user.id);
    toast("Self-report submitted — pending admin review", "info");
    onClose();
  };

  const scanLabel = progress < 30 ? "Detecting face…" : progress < 62 ? "Aligning 68 landmarks…" : progress < 88 ? "Matching descriptor…" : "Verifying geofence…";

  return (
    <Sheet open={open} onClose={onClose} title={stage === "result" ? "Verification result" : mode === "qr" ? "QR check-in" : "Face verification"}>
      {/* mode switch */}
      {stage !== "result" && (
        <div className="mb-3 flex gap-2">
          {(["face", "qr"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); if (stage !== "prep") setStage(m === "qr" ? "qr" : "scan"); }}
              className={`tap ttl flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-bold ${mode === m ? "border-amber/50 bg-amber/12 text-amber" : "border-line bg-panel2 text-mut"}`}>
              {m === "face" ? <ScanFace size={14} /> : <QrCode size={14} />} {m === "face" ? "Face scan" : "QR badge"}
            </button>
          ))}
        </div>
      )}

      {/* prep */}
      {stage === "prep" && (
        <div className="space-y-2.5 py-1">
          <PreflightRow icon={<MapPin size={15} />} label="GPS lock" state={gps.state === "busy" ? "busy" : "ok"}
            detail={gps.state === "ok" ? `${gps.dist}m from beacon${gps.simulated ? " · simulated" : ""}` : "acquiring…"} />
          <PreflightRow icon={cam === "denied" ? <CameraOff size={15} /> : <ScanFace size={15} />} label="Camera"
            state={cam === "busy" ? "busy" : "ok"}
            detail={cam === "busy" ? "requesting permission…" : cam === "ok" ? "live feed ready" : "unavailable — synthetic viewfinder"} />
          <p className="pt-1 text-center font-mono text-[10.5px] uppercase tracking-widest text-faint">
            threshold 80% match · radius {db?.settings.radius}m
          </p>
        </div>
      )}

      {/* scan */}
      {stage === "scan" && (
        <div className="a-pop">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-2xl border border-line bg-[#0b0e12]">
            <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${cam === "ok" ? "" : "hidden"}`} />
            {cam !== "ok" && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "radial-gradient(120% 90% at 50% 20%, #1d2733 0%, #0b0e12 70%)" }}>
                <svg viewBox="0 0 100 120" className="w-3/5 opacity-60">
                  <circle cx="50" cy="42" r="21" fill="none" stroke="var(--mut)" strokeWidth="2" />
                  <path d="M14 112c4-24 16-34 36-34s32 10 36 34" fill="none" stroke="var(--mut)" strokeWidth="2" />
                </svg>
              </div>
            )}
            {/* oval guide */}
            <div className="absolute left-1/2 top-[42%] h-[54%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-amber/70 shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
            {/* scan beam */}
            <div className="scanbeam absolute inset-x-4 top-0 h-20" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,178,36,0.16) 60%, rgba(255,178,36,0.55) 98%, transparent)" }} />
            {/* corner brackets */}
            {[["left-2 top-2 border-l-2 border-t-2", ""], ["right-2 top-2 border-r-2 border-t-2", ""], ["left-2 bottom-2 border-l-2 border-b-2", ""], ["right-2 bottom-2 border-r-2 border-b-2", ""]].map(([c], i) => (
              <span key={i} className={`absolute h-6 w-6 rounded-sm border-amber ${c}`} />
            ))}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-amber transition-[width] duration-100" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-center font-mono text-[11px] text-white/90">{scanLabel} {Math.floor(progress)}%</p>
            </div>
          </div>
          <p className="mt-3 text-center text-[12px] text-mut">Hold still inside the oval · {user.name}</p>
        </div>
      )}

      {/* qr */}
      {stage === "qr" && (
        <div className="a-pop flex flex-col items-center py-2">
          <FakeQR seed={user.id + user.employeeId} />
          <p className="ttl mt-3 text-[14px] font-bold text-ink">{user.employeeId}</p>
          <p className="mt-1 font-mono text-[11px] text-mut">Hold under the gate scanner…</p>
          <div className="mt-3 h-1 w-40 overflow-hidden rounded-full bg-line2">
            <div className="h-full rounded-full bg-cool" style={{ animation: "shimmer 1.2s linear infinite", width: "45%", background: "var(--cool)" }} />
          </div>
        </div>
      )}

      {/* result */}
      {stage === "result" && result && (
        <div className="a-pop pb-1 text-center">
          {result.ok ? (
            <>
              <svg viewBox="0 0 120 120" className="mx-auto h-24 w-24">
                <circle cx="60" cy="60" r="50" fill="none" stroke={result.kind === "done" ? "var(--cool)" : "var(--ok)"} strokeWidth="6" strokeLinecap="round" className="draw-ring" transform="rotate(-90 60 60)" />
                <path d="M38 62l16 15 28-32" fill="none" stroke={result.kind === "done" ? "var(--cool)" : "var(--ok)"} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" className="draw-check" />
              </svg>
              <p className="ttl mt-2 text-2xl font-extrabold text-ink">
                {result.kind === "done" ? "Already logged" : result.kind === "in" ? "Checked in" : "Checked out"}
              </p>
              <p className="mt-1 font-mono text-[12px] text-mut">
                {result.kind === "done" ? "You have completed today's shift — see you tomorrow." : `${result.kind === "in" ? "In" : "Out"} at ${fmtTime(new Date().toISOString())} · ${result.rec?.late && result.kind === "in" ? "late arrival" : result.kind === "in" ? "on time" : "logged"}`}
              </p>
            </>
          ) : (
            <>
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-bad/50 bg-bad/10 text-bad"><XCircle size={38} /></span>
              <p className="ttl mt-3 text-2xl font-extrabold text-ink">Outside geofence</p>
              <p className="mx-auto mt-1 max-w-[30ch] text-[12.5px] leading-relaxed text-mut">{result.reason}</p>
            </>
          )}

          {result.ok && result.kind !== "done" && (
            <div className="mx-auto mt-4 grid max-w-[300px] grid-cols-3 gap-2">
              {[
                ["Method", result.method === "face" ? "FACE" : "QR"],
                ["Match", result.score ? `${result.score}%` : "SCAN"],
                ["Gate", `${result.dist}m`],
              ].map(([l, v]) => (
                <div key={l} className="card2 py-2.5">
                  <p className="font-mono text-[15px] font-semibold text-ink">{v}</p>
                  <p className="ttl mt-1 text-[10px] font-bold text-faint">{l}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex justify-center gap-2.5">
            {!result.ok && <Btn variant="ghost" onClick={doSelfReport}>Self-report entry</Btn>}
            <Btn onClick={onClose} className="min-w-32">{result.ok ? "Done" : "Close"}</Btn>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function PreflightRow({ icon, label, state, detail }: { icon: React.ReactNode; label: string; state: "busy" | "ok"; detail: string }) {
  return (
    <div className="card2 flex items-center gap-3 px-3.5 py-3">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${state === "ok" ? "bg-ok/12 text-ok" : "bg-amber/12 text-amber"}`}>{icon}</span>
      <div className="flex-1">
        <p className="ttl text-[13px] font-bold text-ink">{label}</p>
        <p className="font-mono text-[11px] text-mut">{detail}</p>
      </div>
      {state === "busy" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber border-t-transparent" /> : <LiveDot />}
    </div>
  );
}

function FakeQR({ seed }: { seed: string }) {
  const m = useMemo(() => qrMatrix(seed), [seed]);
  return (
    <div className="a-pop rounded-xl border border-line bg-white p-3 shadow-[0_0_40px_rgba(90,200,232,0.15)]">
      <svg viewBox="0 0 21 21" className="h-44 w-44">
        {m.map((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill="#101418" /> : null)))}
      </svg>
    </div>
  );
}
