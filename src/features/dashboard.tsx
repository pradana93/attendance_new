import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import confetti from "canvas-confetti";
import {
  Camera, Check, ChevronRight, Clock3, ClipboardList, MapPin, Megaphone, QrCode,
  ScanFace, Star, Timer, XCircle,
} from "lucide-react";
import type { Announcement, Attendance, PiketLog, PiketTask, User } from "../types";
import { completePiket, getDB, leaderboard, myPiketToday, punch, selfReport, statsFor, todayRecord } from "../lib/store";
import { fmtClock, fmtDate, fmtDateLong, fmtTime, haversineM, hoursBetween, locateWithFallback, qrMatrix, randInt, todayKey, wait } from "../lib/util";
import { useT } from "../lib/i18n";
import { CaptureSheet } from "../components/capture";
import { Btn, Chip, LiveDot, Reveal, SectionTitle, Sheet, toast, useCountUp } from "../components/ui";
import { Spark } from "../components/charts";

type Kind = "in" | "out" | "done";

/* =============== dashboard =============== */
export default function Dashboard({ user, goTab }: { user: User; goTab: (t: string) => void }) {
  const db = getDB();
  const t = useT();
  const [now, setNow] = useState(new Date());
  const [flowOpen, setFlowOpen] = useState(false);
  const [annList, setAnnList] = useState(false);
  const [ann, setAnn] = useState<Announcement | null>(null);
  const [geo, setGeo] = useState<{ dist: number; simulated: boolean } | null>(null);
  const [proofTask, setProofTask] = useState<{ task: PiketTask; date: string } | null>(null);
  const rec = todayRecord(user.id);
  const stats = useMemo(() => statsFor(user.id), [user.id, now.getMinutes()]); // eslint-disable-line react-hooks/exhaustive-deps
  const kind: Kind = rec?.checkIn && rec?.checkOut ? "done" : rec?.checkIn ? "out" : "in";
  const hour = now.getHours();
  const greetKey = hour < 11 ? "d.greet0" : hour < 15 ? "d.greet1" : hour < 19 ? "d.greet2" : "d.greet3";
  const isAdmin = user.role !== "staff";
  const onDuty = db?.attendance.filter((a) => a.date === todayKey() && a.checkIn && !a.checkOut) ?? [];
  const pinned = db?.announcements.filter((a) => a.pinned) ?? [];
  const recent = db?.announcements.filter((a) => !a.pinned).slice(0, 2) ?? [];
  const myTasks = useMemo(() => myPiketToday(user.id), [user.id, db?.piketLog.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const floorDone = db?.piketLog.filter((l) => l.date === todayKey()).length ?? 0;
  const teamAvg = useMemo(() => {
    const lb = leaderboard();
    return lb.length ? Math.round(lb.reduce((s, b) => s + b.stats.monthPct, 0) / lb.length) : 0;
  }, [now.getDate()]); // eslint-disable-line react-hooks/exhaustive-deps
  const inside = geo ? geo.dist <= (db?.settings.radius ?? 100) : null;
  const ptsAnim = useCountUp(user.points);
  const pctAnim = useCountUp(isAdmin ? teamAvg : stats?.monthPct ?? 0);

  useEffect(() => {
    const t1 = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t1);
  }, []);

  // ambient geofence status
  useEffect(() => {
    if (!db) return;
    let stop = false;
    locateWithFallback({ lat: db.settings.lat, lng: db.settings.lng }).then((p) => {
      if (!stop) setGeo({ dist: haversineM(p.lat, p.lng, db.settings.lat, db.settings.lng), simulated: p.simulated });
    });
    return () => { stop = true; };
  }, [db?.settings.lat, db?.settings.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishTask = (task: PiketTask, photo?: string) => {
    const res = completePiket(todayKey(), task.id, user.id, photo);
    if (res.ok) {
      toast(`${task.name} · ${res.msg}`, "ok");
      confetti({ particleCount: 46, spread: 62, origin: { y: 0.72 }, colors: ["#ffb224", "#3ed598"], disableForReducedMotion: true });
    } else toast(res.msg, "err");
  };

  return (
    <div className="stagger space-y-3">
      {/* greeting */}
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-faint">{fmtDateLong(todayKey())}</p>
          <h1 className="ttl text-[26px] font-bold leading-tight text-ink">
            {t(greetKey as "d.greet0")}, {user.name.split(" ")[0]} <span className="text-amber">·</span>
          </h1>
        </div>
        <Chip tone="amber">{user.employeeId}</Chip>
      </div>

      {/* geofence status strip */}
      <button onClick={() => setFlowOpen(true)}
        className={`tap card flex w-full items-center gap-3 border-l-[3px] p-3 text-left ${inside === false ? "border-l-bad" : "border-l-ok"}`}>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${inside === false ? "bg-bad/12 text-bad" : "bg-ok/12 text-ok"}`}><MapPin size={17} /></span>
        <div className="flex-1">
          <p className="ttl text-[13px] font-bold text-ink">{t("d.gpsLive")}</p>
          <p className="font-mono text-[11px] text-mut">
            {geo ? `${geo.dist}m ${t("d.fromBeacon")}${geo.simulated ? ` · ${t("f.simNote")}` : ""}` : t("f.locating")}
          </p>
        </div>
        {geo === null ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber border-t-transparent" />
          : inside ? <Chip tone="ok">{t("f.inside")}</Chip> : <Chip tone="bad">{t("f.outside")}</Chip>}
      </button>

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
                {kind === "done" ? t("d.shiftcomplete") : kind === "out" ? t("d.onduty") : t("d.notin")}
              </p>
            </div>
          </div>

          {kind === "done" ? (
            <div className="card2 mt-4 flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ok/15 text-ok"><Clock3 size={16} /></span>
                <div>
                  <p className="ttl text-[14px] font-bold text-ink">{t("d.daylogged")}</p>
                  <p className="font-mono text-[11px] text-mut">{fmtTime(rec?.checkIn)} → {fmtTime(rec?.checkOut)} · {rec && rec.checkIn && rec.checkOut ? hoursBetween(fmtTime(rec.checkIn), fmtTime(rec.checkOut)) : 0}h</p>
                </div>
              </div>
              <Chip tone="ok">{t("c.done").toLowerCase()}</Chip>
            </div>
          ) : (
            <button onClick={() => setFlowOpen(true)}
              className="tap group mt-4 block w-full overflow-hidden rounded-xl bg-amber text-left shadow-[0_10px_30px_rgba(255,178,36,0.25)] hover:brightness-110">
              <div className="flex items-center justify-between px-4 py-4">
                <div>
                  <p className="ttl text-[22px] font-extrabold leading-none text-[#191203]">
                    {kind === "in" ? t("d.checkin") : t("d.checkout")}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-[#5c4305]">
                    {t("d.facegps")} · ±{db?.settings.radius}m {t("d.geofence")}
                  </p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#191203]/10 text-[#191203] transition-transform group-active:scale-90">
                  <ScanFace size={22} />
                </span>
              </div>
              {kind === "out" && (
                <div className="border-t border-[#191203]/15 bg-[#191203]/8 px-4 py-1.5 font-mono text-[11px] text-[#3d2e03]">
                  {fmtTime(rec?.checkIn)} → · {rec?.late ? t("f.late") : t("f.onTime")}
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      {/* stats strip */}
      <div className="grid grid-cols-5 gap-3">
        <button onClick={() => goTab("piket")} className="tap card col-span-2 p-3.5 text-left hover:border-amber/40">
          <Star size={15} className="text-amber" />
          <p className="mt-2 font-mono text-[24px] font-semibold leading-none text-ink">{ptsAnim}</p>
          <p className="ttl mt-1 text-[11px] font-bold text-mut">{t("d.points")}</p>
        </button>
        <button onClick={() => goTab("stats")} className="tap card col-span-3 p-3.5 text-left hover:border-amber/40">
          <div className="flex items-center justify-between">
            <Timer size={15} className="text-cool" />
            <span className="font-mono text-[10px] text-faint">{t("c.today").toLowerCase()} ±30d</span>
          </div>
          <div className="mt-2 flex items-end gap-3">
            <p className="font-mono text-[24px] font-semibold leading-none text-ink">{pctAnim}%</p>
            {!isAdmin && <div className="mb-0.5 flex-1 opacity-90"><Spark values={(stats?.weeks ?? [0, 0]).slice(-6)} height={30} /></div>}
          </div>
          <p className="ttl mt-1 text-[11px] font-bold text-mut">{isAdmin ? t("d.teamAvg") : t("d.attendMonth")}</p>
        </button>
      </div>

      {/* my piket today (staff) / floor piket pulse (admin) */}
      {!isAdmin ? (
        <div className="card p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <SectionTitle><span className="inline-flex items-center gap-1.5"><ClipboardList size={14} className="text-amber" /> {t("d.myPiket")}</span></SectionTitle>
            <button onClick={() => goTab("piket")} className="tap font-mono text-[11px] text-amber">{t("c.all")} →</button>
          </div>
          {myTasks.length === 0 ? (
            <p className="py-2 text-center font-mono text-[11.5px] text-faint">{t("d.noPiket")}</p>
          ) : myTasks.every((m) => m.log) ? (
            <div className="card2 flex items-center gap-2.5 px-3.5 py-3 text-ok">
              <Check size={16} /> <p className="ttl text-[13px] font-bold">{t("d.piketAllDone")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myTasks.map(({ task, log }) => (
                <div key={task.id} className={`card2 flex items-center gap-3 px-3.5 py-2.5 ${log ? "opacity-60" : ""}`}>
                  <TaskIcon icon={task.icon} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{task.name}</p>
                    <p className="font-mono text-[10.5px] text-faint">{task.area} · +{task.points} {t("c.pts")}{task.requiresProof ? ` · ${t("p.photoProof").toLowerCase()}` : ""}</p>
                  </div>
                  {log ? (
                    <span className="flex items-center gap-1.5">
                      {log.proof && <img src={log.proof} alt="" className="h-7 w-9 rounded-md border border-line object-cover" />}
                      <Chip tone="ok"><Check size={10} /> {fmtTime(log.doneAt)}</Chip>
                    </span>
                  ) : <Btn className="!px-3 !py-1.5 text-[12px]" onClick={() => task.requiresProof ? setProofTask({ task, date: todayKey() }) : finishTask(task)}>{t("p.complete")}</Btn>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => goTab("fifth")} className="tap card flex w-full items-center justify-between p-3.5 text-left hover:border-amber/40">
          <div className="flex items-center gap-3">
            <LiveDot />
            <div>
              <p className="ttl text-[14px] font-bold text-ink">{onDuty.length} {t("d.onDutyNow")}</p>
              <p className="font-mono text-[11px] text-faint">{floorDone} {t("d.piketDoneCount")} · {t("d.floorBoard")}</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-faint" />
        </button>
      )}

      {/* announcements */}
      <Reveal delay={60}>
      <div>
        <SectionTitle right={
          <button onClick={() => setAnnList(true)} className="tap font-mono text-[11px] text-amber">{t("c.all")} →</button>
        }>
          <span className="inline-flex items-center gap-1.5"><Megaphone size={14} className="text-amber" /> {t("d.notice")}</span>
        </SectionTitle>
        <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
          {[...pinned, ...recent].slice(0, 4).map((a) => (
            <button key={a.id} onClick={() => setAnn(a)}
              className="tap card min-w-[240px] max-w-[280px] shrink-0 p-3.5 text-left hover:border-amber/40">
              <div className="flex items-center gap-2">
                {a.pinned && <Chip tone="amber">{t("a.pinned")}</Chip>}
                <span className="font-mono text-[10px] text-faint">{a.date}</span>
              </div>
              <p className="ttl mt-1.5 text-[15px] font-bold leading-tight text-ink">{a.title}</p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-mut">{a.body}</p>
            </button>
          ))}
        </div>
      </div>
      </Reveal>

      {/* today detail */}
      {rec?.checkIn && (
        <div className="card p-3.5">
          <p className="ttl mb-2.5 text-[12px] font-bold text-mut">{t("d.todayLog")}</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              [t("d.in"), fmtTime(rec.checkIn), rec.late ? "bad" : "ok"],
              [t("d.out"), rec.checkOut ? fmtTime(rec.checkOut) : "—", "mut"],
              [t("d.match"), rec.inScore ? rec.inScore + "%" : "—", "cool"],
              [t("d.gate"), rec.distance ? rec.distance + "m" : "—", "mut"],
            ].map(([l, v, tone]) => (
              <div key={l as string} className="card2 py-2.5">
                <p className="font-mono text-[15px] font-semibold text-ink">{v}</p>
                <Chip tone={tone as "ok"} className="mt-1.5">{l}</Chip>
              </div>
            ))}
          </div>
          {rec.selfReport && <p className="mt-2 text-center font-mono text-[11px] text-amber">⚠ {t("d.selfReportNote")}</p>}
        </div>
      )}

      <CheckFlow user={user} open={flowOpen} onClose={() => setFlowOpen(false)} onDone={() => setNow(new Date())} />

      {/* announcement list */}
      <Sheet open={annList} onClose={() => setAnnList(false)} title={t("d.notice")}>
        <div className="space-y-2">
          {(db?.announcements ?? []).map((a) => (
            <button key={a.id} onClick={() => { setAnn(a); setAnnList(false); }}
              className="tap card w-full p-3.5 text-left hover:border-amber/40">
              <div className="flex items-center gap-2">
                {a.pinned && <Chip tone="amber">{t("a.pinned")}</Chip>}
                <span className="font-mono text-[10px] text-faint">{a.date} · {a.author}</span>
              </div>
              <p className="ttl mt-1 text-[14.5px] font-bold text-ink">{a.title}</p>
              <p className="mt-0.5 line-clamp-1 text-[12px] text-mut">{a.body}</p>
            </button>
          ))}
        </div>
      </Sheet>

      {/* announcement detail */}
      <Sheet open={!!ann} onClose={() => setAnn(null)} title={ann?.title ?? ""}>
        {ann && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {ann.pinned && <Chip tone="amber">{t("a.pinned")}</Chip>}
              <span className="font-mono text-[11px] text-faint">{fmtDate(ann.date)} · {ann.author}</span>
            </div>
            <p className="text-[14px] leading-relaxed text-ink">{ann.body}</p>
            <Btn variant="ghost" className="w-full" onClick={() => setAnn(null)}>{t("c.close")}</Btn>
          </div>
        )}
      </Sheet>

      {/* real camera proof capture */}
      <CaptureSheet
        open={!!proofTask}
        onClose={() => setProofTask(null)}
        required={proofTask?.task.requiresProof}
        title={proofTask ? `${proofTask.task.name} — ${t("p.takeProof")}` : ""}
        onSave={(photo) => proofTask && finishTask(proofTask.task, photo)}
      />
    </div>
  );
}

function TaskIcon({ icon }: { icon: PiketTask["icon"] }) {
  const map: Record<PiketTask["icon"], string> = {
    broom: "M4 20l6-6m2-8l6 6-8 8-6-6 8-8zm-2 14l2 2",
    mop: "M5 20l4-9m3-7l2 2-7 14m8-4l4-8",
    door: "M4 20V6a2 2 0 012-2h12a2 2 0 012 2v14M4 20h16M8 8h8M8 12h8M8 16h5",
    thermo: "M12 4a2 2 0 00-2 2v7.3a4 4 0 104 0V6a2 2 0 00-2-2zm0 12v-5",
    box: "M4 8l8-4 8 4v8l-8 4-8-4V8zm0 0l8 4m0 0l8-4m-8 4v8",
    clip: "M8 5V4a2 2 0 012-2h4a2 2 0 012 2v1m-9 0h10a1 1 0 011 1v13a1 1 0 01-1 1H7a1 1 0 01-1-1V6a1 1 0 011-1zm2 6h6m-6 4h4",
  };
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber/12 text-amber">
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={map[icon]} /></svg>
    </span>
  );
}

/* =============== leaflet geofence map =============== */
export function GeofenceMap({ lat, lng, radius, pos, inside }: {
  lat: number; lng: number; radius: number;
  pos: { lat: number; lng: number } | null; inside: boolean | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMk = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      zoomControl: false, attributionControl: false, dragging: false,
      scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false,
    });
    map.setView([lat, lng], 17);
    // geofence circle
    L.circle([lat, lng], {
      radius, color: "#ffb224", weight: 2, dashArray: "6 6", fillColor: "#ffb224", fillOpacity: 0.1,
    }).addTo(map);
    // warehouse footprint
    const dLat = radius / 111000 * 0.7, dLng = radius / (111000 * Math.cos((lat * Math.PI) / 180)) * 0.9;
    L.rectangle([[lat - dLat, lng - dLng], [lat + dLat, lng + dLng]], {
      color: "#5ac8e8", weight: 1.5, fillColor: "#5ac8e8", fillOpacity: 0.07, dashArray: "3 5",
    }).addTo(map);
    // beacon
    L.circleMarker([lat, lng], { radius: 5, color: "#ffb224", weight: 2, fillColor: "#ffb224", fillOpacity: 1 }).addTo(map);
    L.marker([lat, lng], {
      icon: L.divIcon({ className: "", html: '<div class="mk-label" style="transform:translate(-50%,-190%)">beacon</div>', iconSize: [0, 0] }),
      interactive: false,
    }).addTo(map);
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 280);
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; userMk.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pos) return;
    const icon = L.divIcon({ className: "", html: `<div class="mk-user ${inside === false ? "bad" : ""}"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
    if (!userMk.current) userMk.current = L.marker([pos.lat, pos.lng], { icon }).addTo(map);
    else { userMk.current.setLatLng([pos.lat, pos.lng]); userMk.current.setIcon(icon); }
  }, [pos, inside]);

  return <div ref={ref} className="h-full w-full" />;
}

/* =============== check-in/out flow =============== */
function CheckFlow({ user, open, onClose, onDone }: { user: User; open: boolean; onClose: () => void; onDone: () => void }) {
  const db = getDB();
  const t = useT();
  const [stage, setStage] = useState<"gps" | "verify" | "result">("gps");
  const [mode, setMode] = useState<"face" | "qr">("face");
  const [gps, setGps] = useState<{ state: "busy" | "ok"; pos: { lat: number; lng: number } | null; dist: number; simulated: boolean }>({ state: "busy", pos: null, dist: 0, simulated: false });
  const [cam, setCam] = useState<"busy" | "ok" | "denied">("busy");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; kind: Kind; score?: number; dist: number; method: string; reason?: string; rec?: Attendance } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const openRef = useRef(open);

  const inside = gps.state === "ok" && db ? gps.dist <= db.settings.radius : null;

  // reset + GPS preflight on open
  useEffect(() => {
    openRef.current = open;
    if (!open) {
      setStage("gps"); setProgress(0); setResult(null); setMode("face");
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      return;
    }
    if (!db) return;
    setStage("gps"); setProgress(0); setResult(null); setMode("face"); setCam("busy");
    setGps({ state: "busy", pos: null, dist: 0, simulated: false });
    let cancelled = false;
    (async () => {
      const p = await locateWithFallback({ lat: db.settings.lat, lng: db.settings.lng });
      if (cancelled) return;
      setGps({ state: "ok", pos: { lat: p.lat, lng: p.lng }, dist: haversineM(p.lat, p.lng, db.settings.lat, db.settings.lng), simulated: p.simulated });
    })();
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        streamRef.current = stream;
        setCam("ok");
      } catch {
        if (!cancelled) setCam("denied");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // attach stream when entering verify
  useEffect(() => {
    if (stage === "verify" && videoRef.current && streamRef.current && cam === "ok") {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [stage, cam]);

  // scan progression
  useEffect(() => {
    if (stage !== "verify" || mode !== "face") return;
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
  }, [stage, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // qr countdown
  useEffect(() => {
    if (stage !== "verify" || mode !== "qr") return;
    const to = window.setTimeout(() => finish("qr"), 2100);
    return () => clearTimeout(to);
  }, [stage, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (method: "face" | "qr") => {
    if (!db || !openRef.current) return;
    const rec = todayRecord(user.id);
    const kind: Kind = rec?.checkIn && rec?.checkOut ? "done" : rec?.checkIn ? "out" : "in";
    const score = method === "face" ? randInt(88, 99) : undefined;
    if (kind === "done") {
      setResult({ ok: true, kind, dist: gps.dist, method, rec });
      setStage("result");
      return;
    }
    const punched = punch(user.id, kind, { score, distance: gps.dist, method });
    setResult({ ok: true, kind, score, dist: gps.dist, method, rec: punched ?? undefined });
    setStage("result");
    onDone();
    confetti({ particleCount: kind === "in" ? 90 : 60, spread: 75, origin: { y: 0.65 }, colors: ["#ffb224", "#3ed598", "#5ac8e8", "#e8edf3"], disableForReducedMotion: true });
    toast(kind === "in" ? `${t("f.checkedIn")} · ${fmtTime(punched?.checkIn)}` : `${t("f.checkedOut")}`, "ok");
  };

  const doSelfReport = () => {
    selfReport(user.id);
    toast(t("d.selfReportNote"), "info");
    onClose();
  };

  const scanLabel = progress < 30 ? t("f.detect") : progress < 62 ? t("f.align") : progress < 88 ? t("f.matching") : t("f.verifyGps");
  const title = stage === "result" ? t("f.result") : stage === "gps" ? t("f.gpsTitle") : mode === "qr" ? t("f.qrCheckin") : t("f.faceVerif");

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {/* GPS stage */}
      {stage === "gps" && db && (
        <div className="space-y-3">
          <p className="text-[12.5px] leading-relaxed text-mut">{t("f.gpsBody")}</p>
          <div className="relative h-56 overflow-hidden rounded-xl border border-line">
            <GeofenceMap lat={db.settings.lat} lng={db.settings.lng} radius={db.settings.radius} pos={gps.pos} inside={inside} />
            <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-lg border border-line bg-panel/90 px-2 py-1 backdrop-blur">
              {gps.state === "busy"
                ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber border-t-transparent" />
                : inside ? <LiveDot /> : <LiveDot tone="bad" />}
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink">
                {gps.state === "busy" ? "GPS…" : `${gps.dist}m`}
              </span>
            </div>
          </div>

          <div className="card2 flex items-center justify-between px-3.5 py-3">
            <div>
              <p className="ttl text-[13px] font-bold text-ink">{db.settings.siteName}</p>
              <p className="font-mono text-[11px] text-faint">{t("a.radius").toLowerCase()} ±{db.settings.radius}m{gps.simulated ? ` · ${t("f.simNote")}` : ""}</p>
            </div>
            {gps.state === "busy"
              ? <Chip tone="amber">{t("f.locating")}</Chip>
              : inside ? <Chip tone="ok">{t("f.inside")}</Chip> : <Chip tone="bad">{t("f.outside")}</Chip>}
          </div>

          {inside === false && (
            <div className="rounded-xl border border-bad/35 bg-bad/8 px-3.5 py-3">
              <p className="text-[12.5px] leading-relaxed text-ink">{t("f.cannotPunch", { r: db.settings.radius })}</p>
            </div>
          )}

          <div className="flex gap-2.5">
            <Btn variant="ghost" onClick={onClose}>{t("c.cancel")}</Btn>
            {inside === false ? (
              <>
                <Btn variant="ghost" onClick={() => {
                  setGps({ state: "busy", pos: null, dist: 0, simulated: false });
                  locateWithFallback({ lat: db.settings.lat, lng: db.settings.lng }).then((p) =>
                    setGps({ state: "ok", pos: { lat: p.lat, lng: p.lng }, dist: haversineM(p.lat, p.lng, db.settings.lat, db.settings.lng), simulated: p.simulated }));
                }}>{t("f.retryGps")}</Btn>
                <Btn onClick={doSelfReport}>{t("f.selfReport")}</Btn>
              </>
            ) : (
              <Btn className="flex-1" disabled={inside !== true} onClick={() => setStage("verify")}>
                <ScanFace size={15} /> {t("f.proceed")}
              </Btn>
            )}
          </div>
        </div>
      )}

      {/* verify stage */}
      {stage === "verify" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["face", "qr"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setProgress(0); }}
                className={`tap ttl flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-bold ${mode === m ? "border-amber/50 bg-amber/12 text-amber" : "border-line bg-panel2 text-mut"}`}>
                {m === "face" ? <ScanFace size={14} /> : <QrCode size={14} />} {m === "face" ? t("f.face") : t("f.qr")}
              </button>
            ))}
          </div>

          {mode === "face" ? (
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
                <div className="absolute left-1/2 top-[42%] h-[54%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-amber/70 shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
                <div className="scanbeam absolute inset-x-4 top-0 h-20" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,178,36,0.16) 60%, rgba(255,178,36,0.55) 98%, transparent)" }} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-amber transition-[width] duration-100" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-2 text-center font-mono text-[11px] text-white/90">{scanLabel} {Math.floor(progress)}%</p>
                </div>
              </div>
              <p className="mt-3 text-center font-mono text-[10.5px] uppercase tracking-widest text-faint">
                {t("f.threshold", { r: db?.settings.radius ?? 100 })} · {user.name}
              </p>
            </div>
          ) : (
            <div className="a-pop flex flex-col items-center py-2">
              <FakeQR seed={user.id + user.employeeId} />
              <p className="ttl mt-3 text-[14px] font-bold text-ink">{user.employeeId}</p>
              <p className="mt-1 font-mono text-[11px] text-mut">{t("f.qrHold")}</p>
              <div className="mt-3 h-1 w-40 overflow-hidden rounded-full bg-line2">
                <div className="h-full w-[45%] rounded-full" style={{ background: "var(--cool)", animation: "shimmer 1.2s linear infinite" }} />
              </div>
            </div>
          )}
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
                {result.kind === "done" ? t("f.already") : result.kind === "in" ? t("f.checkedIn") : t("f.checkedOut")}
              </p>
              <p className="mt-1 font-mono text-[12px] text-mut">
                {result.kind === "done" ? t("f.alreadyBody")
                  : `${fmtTime(new Date().toISOString())} · ${result.rec?.late && result.kind === "in" ? t("f.late") : t("f.onTime")}`}
              </p>
            </>
          ) : (
            <>
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-bad/50 bg-bad/10 text-bad"><XCircle size={38} /></span>
              <p className="ttl mt-3 text-2xl font-extrabold text-ink">{t("f.outTitle")}</p>
              <p className="mx-auto mt-1 max-w-[30ch] text-[12.5px] leading-relaxed text-mut">{result.reason}</p>
            </>
          )}

          {result.ok && result.kind !== "done" && (
            <div className="mx-auto mt-4 grid max-w-[300px] grid-cols-3 gap-2">
              {[
                [t("f.method"), result.method === "face" ? "FACE" : "QR"],
                [t("d.match"), result.score ? `${result.score}%` : "SCAN"],
                [t("f.gateL"), `${result.dist}m`],
              ].map(([l, v]) => (
                <div key={l} className="card2 py-2.5">
                  <p className="font-mono text-[15px] font-semibold text-ink">{v}</p>
                  <p className="ttl mt-1 text-[10px] font-bold text-faint">{l}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex justify-center gap-2.5">
            {!result.ok && <Btn variant="ghost" onClick={doSelfReport}>{t("f.selfReport")}</Btn>}
            <Btn onClick={onClose} className="min-w-32">{result.ok ? t("c.done") : t("c.close")}</Btn>
          </div>
        </div>
      )}
    </Sheet>
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
