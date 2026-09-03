import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Award, CalendarDays, ChevronRight,
  Clock3, Hourglass, Medal, Plane, Star, Target, TrendingUp,
} from "lucide-react";
import type { User } from "../types";
import { getDB, leaderboard, statsFor, userName, type UserStats } from "../lib/store";
import { dayKey, fmtDate, parseKey, todayKey } from "../lib/util";
import { useT } from "../lib/i18n";
import { Avatar, Chip, SectionTitle, Seg, Sheet } from "../components/ui";
import { Heatmap, Ring, Spark, YtdBars, type DayStatus } from "../components/charts";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default function Performance({ user }: { user: User }) {
  const t = useT();
  const isAdmin = user.role !== "staff";
  const [view, setView] = useState<"me" | "team">("team");
  return (
    <div className="space-y-3">
      {isAdmin && (
        <Seg options={[{ id: "team", label: t("s.team") }, { id: "me", label: t("nav.me") }]} value={view} onChange={setView} />
      )}
      {isAdmin && view === "team" ? <TeamView admin={user} /> : <MyStats user={user} />}
    </div>
  );
}

/* ================= helpers ================= */
function useHeat(user: User) {
  return useMemo(() => {
    const db = getDB();
    const st = statsFor(user.id);
    if (!db || !st) return { heat: [] as { key: string; status: DayStatus; hours: number }[], label: "" };
    const now = new Date();
    const lang = db.settings.language;
    const months = lang === "id" ? MONTHS_ID : MONTHS_EN;
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const heat: { key: string; status: DayStatus; hours: number }[] = [];
    for (let d = 1; d <= dim; d++) {
      const k = dayKey(new Date(now.getFullYear(), now.getMonth(), d));
      const rec = db.attendance.find((a) => a.userId === user.id && a.date === k);
      let status: DayStatus = st.heat[k] === "out" ? "off" : st.heat[k] === "late" ? "late" : st.heat[k] === "absent" ? "absent" : "present";
      if (k > todayKey()) status = "future";
      else if (rec?.early) status = "early";
      const hours = rec?.checkIn && rec?.checkOut ? Math.round((new Date(rec.checkOut).getTime() - new Date(rec.checkIn).getTime()) / 3600000) : 0;
      heat.push({ key: k, status, hours });
    }
    return { heat, label: `${months[now.getMonth()]} ${now.getFullYear()}` };
  }, [user.id]);
}

function insightLines(user: User, st: UserStats, lang: "en" | "id"): string[] {
  const out: string[] = [];
  const recent = st.weeks.slice(-3).reduce((s, v) => s + v, 0) / 3;
  const before = st.weeks.slice(-6, -3).reduce((s, v) => s + v, 0) / 3;
  if (lang === "id") {
    if (st.lates > 3) out.push(`⏰ ${st.lates} kali terlambat — paling sering hari Senin. Skor Anda turun ~${Math.min(20, st.lates * 2)} poin karenanya.`);
    out.push(recent >= before
      ? `📈 Tren 3 minggu terakhir naik ${Math.max(0, Math.round(recent - before))}% dibanding periode sebelumnya. Pertahankan!`
      : `📉 Tren 3 minggu terakhir turun ${Math.max(0, Math.round(before - recent))}% — perhatikan jadwal piket minggu ini.`);
    if (st.streak >= 5) out.push(`🔥 ${st.streak} hari beruntun hadir tepat waktu. Rekor pribadi!`);
    out.push(`⭐ ${st.points} poin piket terkumpul. Tukar dengan rewards di tab Piket.`);
  } else {
    if (st.lates > 3) out.push(`⏰ ${st.lates} late arrivals — mostly Mondays. They cost you ~${Math.min(20, st.lates * 2)} score points.`);
    out.push(recent >= before
      ? `📈 Last 3 weeks are up ${Math.max(0, Math.round(recent - before))}% vs the previous period. Keep it rolling.`
      : `📉 Last 3 weeks dipped ${Math.max(0, Math.round(before - recent))}% — check this week's piket load.`);
    if (st.streak >= 5) out.push(`🔥 ${st.streak}-day streak of on-time arrivals. Personal best!`);
    out.push(`⭐ ${st.points} piket points banked. Redeem them in the Piket tab.`);
  }
  return out;
}

/* ================= my stats ================= */
function MyStats({ user }: { user: User }) {
  const db = getDB();
  const t = useT();
  const st = statsFor(user.id);
  const { heat, label } = useHeat(user);
  const [selMonth, setSelMonth] = useState(() => new Date().getMonth());
  const lb = useMemo(() => leaderboard(), [db?.piketLog.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!db || !st) return null;
  const months = db.settings.language === "id" ? MONTHS_ID : MONTHS_EN;
  const rank = lb.findIndex((x) => x.user.id === user.id) + 1;
  const teamScore = lb.length ? Math.round(lb.reduce((s, x) => s + x.stats.score, 0) / lb.length) : 0;
  const delta = st.score - teamScore;

  const heatView = useMemo(() => {
    if (selMonth === new Date().getMonth()) return { heat, label };
    const now = new Date();
    const dim = new Date(now.getFullYear(), selMonth + 1, 0).getDate();
    const arr: { key: string; status: DayStatus; hours: number }[] = [];
    for (let d = 1; d <= dim; d++) {
      const k = dayKey(new Date(now.getFullYear(), selMonth, d));
      const s = st.heat[k];
      arr.push({ key: k, status: !s || s === "out" ? "off" : s === "late" ? "late" : s === "absent" ? "absent" : "present", hours: 8 });
    }
    return { heat: arr, label: `${months[selMonth]} ${now.getFullYear()}` };
  }, [selMonth, st, heat, label]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="a-fadein stagger space-y-3">
      {/* ring + rank */}
      <div className="card flex items-center gap-4 p-4">
        <Ring value={st.monthPct} label={t("s.rate")} sub={t("c.today").toLowerCase() + " ±30d"} />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="card2 p-3">
            <p className="ttl text-[10.5px] font-bold uppercase tracking-wider text-faint">{t("s.standing")}</p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-[26px] font-semibold leading-none text-amber">#{rank || "—"}</span>
              <span className="font-mono text-[12px] text-mut">{t("s.of")} {lb.length}</span>
              <span className={`ml-auto inline-flex items-center gap-0.5 font-mono text-[11px] ${delta >= 0 ? "text-ok" : "text-bad"}`}>
                {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(delta)} {t("s.vsTeam")}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line2">
              <div className="h-full rounded-full bg-amber transition-[width] duration-700" style={{ width: `${st.score}%` }} />
            </div>
            <p className="mt-1 font-mono text-[10px] text-faint">{t("s.score")} {st.score}/100 · team {teamScore}</p>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-mut">
            <Spark values={st.weeks.slice(-6)} height={26} />
          </div>
        </div>
      </div>

      {/* metric tiles */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: <Clock3 size={14} />, v: String(st.lates), l: t("s.late"), tone: st.lates > 3 ? "text-bad" : "text-ink" },
          { icon: <Hourglass size={14} />, v: String(st.earlies), l: t("s.early"), tone: "text-ink" },
          { icon: <Target size={14} />, v: `${st.otHours}h`, l: t("s.otHours"), tone: "text-ink" },
          { icon: <Plane size={14} />, v: String(st.leaveDays), l: t("s.leaveDays"), tone: "text-ink" },
          { icon: <Star size={14} />, v: String(st.points), l: t("d.points"), tone: "text-amber" },
          { icon: <TrendingUp size={14} />, v: `${st.streak}d`, l: t("s.streak"), tone: "text-ok" },
        ].map((m) => (
          <div key={m.l} className="card p-3">
            <span className="text-faint">{m.icon}</span>
            <p className={`mt-1.5 font-mono text-[19px] font-semibold leading-none ${m.tone}`}>{m.v}</p>
            <p className="ttl mt-1 text-[10.5px] font-bold text-mut">{m.l}</p>
          </div>
        ))}
      </div>

      {/* YTD */}
      <div className="card p-4">
        <SectionTitle><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-amber" /> {t("s.ytd")}</span></SectionTitle>
        <YtdBars data={st.ytd.map((v, i) => ({ label: months[i], value: v, current: i === new Date().getMonth() }))} />
      </div>

      {/* heatmap */}
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>{t("s.heat")}</SectionTitle>
          <div className="flex gap-1">
            <button onClick={() => setSelMonth((m) => Math.max(0, m - 1))} className="tap rounded-md border border-line bg-panel2 p-1 text-mut">‹</button>
            <span className="ttl w-20 text-center text-[11.5px] font-bold text-ink">{months[selMonth]}</span>
            <button onClick={() => setSelMonth((m) => Math.min(new Date().getMonth(), m + 1))} className="tap rounded-md border border-line bg-panel2 p-1 text-mut">›</button>
          </div>
        </div>
        <Heatmap heat={heatView.heat} monthLabel={heatView.label} />
      </div>

      {/* insights */}
      <div className="card p-4">
        <SectionTitle><span className="inline-flex items-center gap-1.5"><TrendingUp size={14} className="text-amber" /> {t("s.insights")}</span></SectionTitle>
        <div className="space-y-2">
          {insightLines(user, st, db.settings.language).map((line, i) => (
            <p key={i} className="rounded-lg border border-line2 bg-panel2/70 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink">{line}</p>
          ))}
        </div>
      </div>

      {/* mini podium */}
      {lb.length > 1 && (
        <div className="card p-4">
          <SectionTitle><span className="inline-flex items-center gap-1.5"><Award size={14} className="text-amber" /> {t("s.topPerf")}</span></SectionTitle>
          <div className="space-y-1.5">
            {lb.slice(0, 3).map((x, i) => (
              <div key={x.user.id} className="flex items-center gap-3 rounded-lg border border-line2 bg-panel2/60 px-3 py-2">
                <Medal size={15} className={i === 0 ? "text-amber" : i === 1 ? "text-mut" : "text-[#b0764a]"} />
                <Avatar user={x.user} size={26} />
                <span className="flex-1 truncate text-[12.5px] font-medium text-ink">{x.user.name}{x.user.id === user.id && <span className="text-amber"> · you</span>}</span>
                <span className="font-mono text-[12px] text-mut">{x.stats.monthPct}% · <span className="text-ink">{x.stats.score}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= team view ================= */
function TeamView({ admin }: { admin: User }) {
  const db = getDB();
  const t = useT();
  const [sel, setSel] = useState<string | null>(null);
  const lb = useMemo(() => leaderboard(), [db?.attendance.length, db?.piketLog.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!db) return null;
  const avg = lb.length ? Math.round(lb.reduce((s, x) => s + x.stats.monthPct, 0) / lb.length) : 0;
  const avgScore = lb.length ? Math.round(lb.reduce((s, x) => s + x.stats.score, 0) / lb.length) : 0;
  const top3 = lb.slice(0, 3);
  const watch = lb.slice(-2).reverse().filter((x) => x.stats.score < 75 || x.stats.monthPct < 80);
  const selRow = lb.find((x) => x.user.id === sel);

  return (
    <div className="a-fadein stagger space-y-3">
      <div className="card flex items-center gap-4 p-4">
        <Ring value={avg} label={t("d.teamAvg")} sub={`${lb.length} staff`} />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <p className="ttl text-[11px] font-bold uppercase tracking-wider text-faint">{t("s.score")}</p>
            <p className="font-mono text-[20px] font-semibold text-ink">{avgScore}<span className="text-[12px] text-mut">/100</span></p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line2">
            <div className="h-full rounded-full bg-cool transition-[width] duration-700" style={{ width: `${avgScore}%` }} />
          </div>
          <p className="font-mono text-[10.5px] text-faint">{fmtDate(todayKey())} · {parseKey(todayKey()).toLocaleDateString("en", { weekday: "long" })}</p>
        </div>
      </div>

      {/* podium */}
      <SectionTitle><span className="inline-flex items-center gap-1.5"><Award size={14} className="text-amber" /> {t("s.topPerf")}</span></SectionTitle>
      <div className="grid grid-cols-3 items-end gap-2">
        {[top3[1], top3[0], top3[2]].filter(Boolean).map((x) => {
          const i = lb.indexOf(x);
          const first = i === 0;
          return (
            <button key={x.user.id} onClick={() => setSel(x.user.id)}
              className={`tap card relative p-3 pb-4 text-center ${first ? "border-amber/50 shadow-[0_0_28px_rgba(255,178,36,0.12)]" : ""} ${i === 1 ? "translate-y-2" : ""} ${i === 2 ? "translate-y-3" : ""}`}>
              <span className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${first ? "bg-amber text-[#191203]" : "bg-panel2 text-mut border border-line"}`}>#{i + 1}</span>
              <div className="mx-auto w-fit"><Avatar user={x.user} size={first ? 46 : 38} ring={first} /></div>
              <p className="mt-1.5 truncate text-[11.5px] font-semibold text-ink">{x.user.name.split(" ")[0]}</p>
              <p className="font-mono text-[10.5px] text-mut">{x.stats.monthPct}%</p>
              <p className={`mt-0.5 font-mono text-[13px] font-semibold ${first ? "text-amber" : "text-ink"}`}>{x.stats.score}</p>
            </button>
          );
        })}
      </div>

      {/* leaderboard */}
      <div className="card divide-y divide-line2">
        {lb.map((x, i) => (
          <button key={x.user.id} onClick={() => setSel(x.user.id)} className="tap flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-panel2/50">
            <span className={`w-5 text-center font-mono text-[12px] ${i < 3 ? "text-amber" : "text-faint"}`}>{i + 1}</span>
            <Avatar user={x.user} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{x.user.name}</p>
              <p className="font-mono text-[10px] text-faint">{x.user.department}</p>
            </div>
            <div className="w-16">
              <div className="h-1 overflow-hidden rounded-full bg-line2">
                <div className={`h-full rounded-full ${x.stats.score >= 80 ? "bg-ok" : x.stats.score >= 65 ? "bg-amber" : "bg-bad"}`} style={{ width: `${x.stats.score}%` }} />
              </div>
              <p className="mt-0.5 text-right font-mono text-[10px] text-mut">{x.stats.monthPct}%</p>
            </div>
            <span className="w-8 text-right font-mono text-[13px] font-semibold text-ink">{x.stats.score}</span>
            <ChevronRight size={13} className="text-faint" />
          </button>
        ))}
      </div>

      {/* watchlist */}
      {watch.length > 0 && (
        <>
          <SectionTitle><span className="inline-flex items-center gap-1.5"><AlertTriangle size={14} className="text-bad" /> {t("s.watch")}</span></SectionTitle>
          <div className="space-y-2">
            {watch.map((x) => (
              <button key={x.user.id} onClick={() => setSel(x.user.id)} className="tap card w-full border-l-[3px] border-l-bad p-3 text-left">
                <div className="flex items-center gap-3">
                  <Avatar user={x.user} size={32} />
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-ink">{x.user.name}</p>
                    <p className="font-mono text-[10.5px] text-faint">{x.user.department} · {t("s.score")} {x.stats.score}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {x.stats.monthPct < 85 && <Chip tone="bad">{x.stats.monthPct}% {t("s.pctPresent")}</Chip>}
                    {x.stats.lates > 2 && <Chip tone="amber">{x.stats.lates}× {t("s.late").toLowerCase()}</Chip>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* detail sheet */}
      <Sheet open={!!selRow} onClose={() => setSel(null)} title={selRow ? selRow.user.name : ""}>
        {selRow && <DetailBody userId={selRow.user.id} name={userName(selRow.user.id)} />}
      </Sheet>
      <span className="hidden">{admin.id}</span>
    </div>
  );
}

function DetailBody({ userId, name }: { userId: string; name: string }) {
  const t = useT();
  const st = statsFor(userId);
  const u = getDB()?.users.find((x) => x.id === userId);
  if (!st || !u) return null;
  const tiles = [
    [t("s.rate"), `${st.monthPct}%`], [t("s.late"), String(st.lates)], [t("s.early"), String(st.earlies)],
    [t("s.otHours"), `${st.otHours}h`], [t("s.leaveDays"), String(st.leaveDays)], [t("d.points"), String(st.points)],
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar user={u} size={44} ring />
        <div>
          <p className="text-[15px] font-bold text-ink">{name}</p>
          <p className="font-mono text-[11px] text-faint">{u.employeeId} · {u.department}</p>
        </div>
        <Chip tone={st.score >= 80 ? "ok" : st.score >= 65 ? "amber" : "bad"} className="ml-auto">{t("s.score")} {st.score}</Chip>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(([l, v]) => (
          <div key={l} className="card2 py-2.5 text-center">
            <p className="font-mono text-[16px] font-semibold text-ink">{v}</p>
            <p className="ttl mt-0.5 text-[10px] font-bold text-faint">{l}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="ttl mb-1.5 text-[11px] font-bold uppercase tracking-wider text-faint">{t("s.trendUp")} / {t("s.trendDown")} · 8 {t("c.week")}</p>
        <Spark values={st.weeks} height={56} />
      </div>
    </div>
  );
}
