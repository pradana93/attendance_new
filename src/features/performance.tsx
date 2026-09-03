import { useMemo } from "react";
import { AlarmClock, Brain, CalendarOff, Moon, Sun, TrendingUp, Trophy, Users, Wallet } from "lucide-react";
import type { User } from "../types";
import { getDB, leaderboard, statsFor, todayRecord } from "../lib/store";
import { parseKey, todayKey } from "../lib/util";
import { Avatar, Chip, SectionTitle } from "../components/ui";
import { Heatmap, Ring, Spark, YtdBars } from "../components/charts";

export default function Performance({ user }: { user: User }) {
  const db = getDB();
  const isStaff = user.role === "staff";
  const stats = useMemo(() => statsFor(user.id), [user.id, db?.attendance.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const board = useMemo(
    () => (isStaff ? [] : leaderboard()),
    [isStaff, db?.attendance.length] // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (!db || !stats) return null;
  const now = new Date();
  const monthLabel = now.toLocaleDateString("en", { month: "long", year: "numeric" });

  /* ---------- team view (admin / superadmin) ---------- */
  if (!isStaff) {
    const teamAvg = board.length ? Math.round(board.reduce((s, b) => s + b.pct, 0) / board.length) : 0;
    const onDuty = db.attendance.filter((a) => a.date === todayKey() && a.checkIn && !a.checkOut).length;
    const pendingOT = db.ot.filter((o) => o.status === "pending").length;
    const pendingLeave = db.leaves.filter((l) => l.status === "pending").length;
    const totalPts = db.users.reduce((s, u) => s + u.points, 0);
    const top = board[0];
    const lateToday = db.attendance.filter((a) => a.date === todayKey() && a.late).length;

    return (
      <div className="stagger space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-faint">performance</p>
            <h1 className="ttl text-[24px] font-bold leading-tight text-ink">Team analytics</h1>
          </div>
          <Chip tone="amber">{monthLabel}</Chip>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-5">
            <Ring value={teamAvg} label="team avg" sub={`${board.length} active staff`} />
            <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-3">
              {[
                { icon: <Users size={14} />, label: "On duty now", value: String(onDuty), tone: "text-ok" },
                { icon: <AlarmClock size={14} />, label: "Late today", value: String(lateToday), tone: lateToday ? "text-bad" : "text-ink" },
                { icon: <Moon size={14} />, label: "Pending OT", value: String(pendingOT), tone: "text-cool" },
                { icon: <CalendarOff size={14} />, label: "Leave requests", value: String(pendingLeave), tone: "text-ink" },
              ].map((t) => (
                <div key={t.label}>
                  <div className="flex items-center gap-1.5 text-faint">{t.icon}<span className="ttl text-[10.5px] font-bold">{t.label}</span></div>
                  <p className={`mt-0.5 font-mono text-[19px] font-semibold leading-none ${t.tone}`}>{t.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line2 pt-3 font-mono text-[12px] text-mut">
            <span className="flex items-center gap-1.5"><Wallet size={13} /> Points in circulation</span>
            <span className="font-semibold text-amber">{totalPts} pts</span>
          </div>
        </div>

        <div className="card relative overflow-hidden p-3.5">
          <div className="absolute inset-y-0 left-0 w-1 bg-cool/60" />
          <div className="flex items-start gap-2.5 pl-2">
            <Brain size={16} className="mt-0.5 shrink-0 text-cool" />
            <div>
              <p className="ttl text-[12px] font-bold text-cool">Pattern insight</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-mut">
                {top
                  ? `${top.user.name.split(" ")[0]} leads the floor at ${top.pct}% attendance this month. ${lateToday ? `${lateToday} late arrival${lateToday > 1 ? "s" : ""} logged today — consider a gate briefing.` : "No late arrivals today — clean start."}`
                  : "Not enough data yet — check back after the first shift."}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <SectionTitle><span className="inline-flex items-center gap-1.5"><Trophy size={14} className="text-amber" /> Crew leaderboard · {monthLabel}</span></SectionTitle>
          <div className="space-y-1.5">
            {board.map((b, i) => (
              <div key={b.user.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${i === 0 ? "border-amber/40 bg-amber/8" : "border-line2 bg-panel2/60"}`}>
                <span className={`ttl w-6 text-center text-[15px] font-bold ${i === 0 ? "text-amber" : i === 1 ? "text-cool" : i === 2 ? "text-[#c98a4b]" : "text-faint"}`}>{i + 1}</span>
                <Avatar user={b.user} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{b.user.name}</p>
                  <p className="font-mono text-[10px] text-faint">{b.user.department} · {b.user.points} pts{todayRecord(b.user.id)?.checkIn ? " · on floor" : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line2">
                    <div className="h-full rounded-full bg-amber" style={{ width: `${b.pct}%` }} />
                  </div>
                  <span className="w-9 text-right font-mono text-[12.5px] font-semibold text-ink">{b.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- personal view (staff) ---------- */
  const insight = buildInsight(stats);
  const tiles: { icon: React.ReactNode; label: string; value: string; tone: string }[] = [
    { icon: <AlarmClock size={14} />, label: "Late arrivals", value: String(stats.lateMonth), tone: stats.lateMonth > 3 ? "text-bad" : "text-ink" },
    { icon: <Sun size={14} />, label: "Early departures", value: String(stats.earlyMonth), tone: "text-ink" },
    { icon: <Moon size={14} />, label: "Overtime hours", value: stats.otHoursMonth + "h", tone: "text-cool" },
    { icon: <Wallet size={14} />, label: "Hours on floor", value: stats.workHoursMonth + "h", tone: "text-ink" },
    { icon: <CalendarOff size={14} />, label: "Leave used (YTD)", value: stats.leaveUsedYear + "d", tone: "text-ink" },
    { icon: <TrendingUp size={14} />, label: "On-time streak", value: stats.streak + "d", tone: "text-ok" },
  ];

  return (
    <div className="stagger space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-faint">performance</p>
          <h1 className="ttl text-[24px] font-bold leading-tight text-ink">Your dashboard</h1>
        </div>
        <Chip tone="amber">{monthLabel}</Chip>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-5">
          <Ring value={stats.monthPct} label="attendance" sub={`avg in ${stats.avgIn}`} />
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-3">
            {tiles.slice(0, 4).map((t) => (
              <div key={t.label}>
                <div className="flex items-center gap-1.5 text-faint">{t.icon}<span className="ttl text-[10.5px] font-bold">{t.label}</span></div>
                <p className={`mt-0.5 font-mono text-[19px] font-semibold leading-none ${t.tone}`}>{t.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line2 pt-3">
          {tiles.slice(4).map((t) => (
            <div key={t.label} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-faint">{t.icon}<span className="ttl text-[11px] font-bold">{t.label}</span></span>
              <span className={`font-mono text-[15px] font-semibold ${t.tone}`}>{t.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card relative overflow-hidden p-3.5">
        <div className="absolute inset-y-0 left-0 w-1 bg-cool/60" />
        <div className="flex items-start gap-2.5 pl-2">
          <Brain size={16} className="mt-0.5 shrink-0 text-cool" />
          <div>
            <p className="ttl text-[12px] font-bold text-cool">Pattern insight</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-mut">{insight}</p>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <SectionTitle>YTD attendance rate</SectionTitle>
        <YtdBars data={stats.ytd} />
      </div>

      <div className="card p-4">
        <SectionTitle>Monthly heatmap</SectionTitle>
        <Heatmap heat={stats.heat} monthLabel={monthLabel} />
      </div>

      <div className="card p-4">
        <SectionTitle right={<span className="font-mono text-[11px] text-faint">last 8 weeks</span>}>Weekly trend</SectionTitle>
        <Spark values={stats.weeks} height={64} />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-faint">
          <span>-8w</span><span>-4w</span><span className="text-amber">now · {stats.weeks[stats.weeks.length - 1]}%</span>
        </div>
      </div>
    </div>
  );
}

function buildInsight(s: NonNullable<ReturnType<typeof statsFor>>): string {
  const lateDays = s.heat.filter((h) => h.status === "late").map((h) => parseKey(h.key).getDay());
  const freq = new Map<number, number>();
  lateDays.forEach((d) => freq.set(d, (freq.get(d) ?? 0) + 1));
  const worst = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  const dayName = worst ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][worst[0]] : null;
  const recent = s.weeks.slice(-3);
  const avg3 = Math.round(recent.reduce((a, b) => a + b, 0) / (recent.length || 1));
  const parts: string[] = [];
  if (dayName && worst[1] >= 1) parts.push(`Lateness clusters on ${dayName}s (${worst[1]} of ${lateDays.length} late day${lateDays.length > 1 ? "s" : ""} this month).`);
  if (s.streak >= 5) parts.push(`You're on a ${s.streak}-day on-time streak — keep it alive.`);
  parts.push(`At the current pace, expect ≈${Math.min(100, Math.max(avg3, s.monthPct))}% attendance over the next 4 weeks.`);
  if (s.otHoursMonth > 8) parts.push(`${s.otHoursMonth}h overtime logged — consider balancing shifts.`);
  return parts.join(" ");
}
