import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bell, Boxes, CalendarDays, CheckCheck, Home, ShieldCheck, Timer, User } from "lucide-react";
import { getDB, getSessionUser, isSetupDone, logout, markNotisRead, notisFor, unreadCount, useDB } from "./lib/store";
import { fmtClock, relTime } from "./lib/util";
import { Avatar, Chip, Empty, LiveDot, Sheet, Toaster, toast } from "./components/ui";
import type { User as TUser } from "./types";
import SetupWizard from "./features/setup";
import Login from "./features/auth";
import Dashboard from "./features/dashboard";
import Schedule from "./features/schedule";
import Performance from "./features/performance";
import Overtime from "./features/overtime";
import Admin from "./features/admin";
import Me from "./features/me";

type Tab = "home" | "piket" | "stats" | "ot" | "fifth";

export default function App() {
  const db = useDB();
  const [booting, setBooting] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(() => getSessionUser()?.id ?? null);
  const [tab, setTab] = useState<Tab>("home");
  const [bellOpen, setBellOpen] = useState(false);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 950);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (db) document.title = `${db.settings.appName} · Warehouse Attendance`;
  }, [db]);

  const user: TUser | null = useMemo(
    () => (sessionId && db ? db.users.find((u) => u.id === sessionId) ?? null : null),
    [sessionId, db]
  );

  if (booting) return <Splash />;
  if (!isSetupDone()) return <><SetupWizard /><Toaster /></>;
  if (!user) return <><Login onLogin={(u) => { setSessionId(u.id); setTab("home"); }} /><Toaster /></>;

  const isAdmin = user.role !== "staff";
  const unread = unreadCount(user.id);
  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "piket", label: "Piket", icon: CalendarDays },
    { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "ot", label: "Overtime", icon: Timer },
    { id: "fifth", label: isAdmin ? "Admin" : "Me", icon: isAdmin ? ShieldCheck : User },
  ];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md">
      {/* header */}
      <header className="sticky top-0 z-50 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="hazard h-[3px] w-full opacity-90" />
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line"
            style={{ background: `linear-gradient(135deg, hsl(${db!.settings.hue} 70% 45%), hsl(${db!.settings.hue + 30} 65% 28%))` }}>
            {db!.settings.logo ? <img src={db!.settings.logo} alt="" className="h-full w-full object-cover" /> : <Boxes size={18} className="text-white" />}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="ttl truncate text-[15px] font-bold text-ink">{db!.settings.appName}</p>
            <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider text-faint">
              <LiveDot /> {db!.settings.siteName}
            </p>
          </div>
          <span className="font-mono text-[11.5px] tabular-nums text-mut">{fmtClock(clock)}</span>
          <button onClick={() => { setBellOpen(true); markNotisRead(user.id); }}
            className="tap relative rounded-[10px] border border-line bg-panel2 p-2 text-mut hover:text-ink" aria-label="Notifications">
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 font-mono text-[9px] font-bold text-[#191203]">{unread}</span>
            )}
          </button>
          <Avatar user={user} size={32} />
        </div>
      </header>

      {/* page */}
      <main className="px-4 pb-28 pt-4">
        <div key={tab} className="a-fadein">
          {tab === "home" && <Dashboard user={user} goTab={(t) => setTab(t as Tab)} />}
          {tab === "piket" && <Schedule user={user} />}
          {tab === "stats" && <Performance user={user} />}
          {tab === "ot" && <Overtime user={user} />}
          {tab === "fifth" && (isAdmin ? <Admin user={user} /> : <Me user={user} onLogout={() => { setSessionId(null); }} />)}
        </div>
      </main>

      {/* bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto max-w-md border-t border-line bg-panel/92 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 backdrop-blur-md">
          <div className="flex">
            {TABS.map((t) => {
              const Ic = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`tap relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 ${active ? "text-amber" : "text-faint hover:text-mut"}`}>
                  <span className={`absolute -top-1.5 h-[3px] w-7 rounded-full bg-amber transition-opacity ${active ? "opacity-100" : "opacity-0"}`} />
                  <Ic size={20} className={active ? "drop-shadow-[0_0_8px_rgba(255,178,36,0.5)]" : ""} />
                  <span className="ttl text-[9.5px] font-bold tracking-wide">{t.label}</span>
                  {t.id === "ot" && isAdmin && (getDB()?.ot.filter((o) => o.status === "pending").length ?? 0) > 0 && (
                    <span className="absolute right-[22%] top-0.5 h-1.5 w-1.5 rounded-full bg-bad" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* notification center */}
      <Sheet open={bellOpen} onClose={() => setBellOpen(false)} title="Notifications"
        wide>
        <NotiList userId={user.id} />
      </Sheet>

      <Toaster />
    </div>
  );
}

function NotiList({ userId }: { userId: string }) {
  const list = notisFor(userId);
  if (!list.length) return <Empty icon={<Bell size={26} />} title="All clear" sub="Approvals, roster changes and broadcasts land here." />;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10.5px] uppercase tracking-widest text-faint">{list.length} notifications</p>
        <button onClick={() => { markNotisRead(userId); toast("Marked all as read", "info"); }}
          className="tap flex items-center gap-1 font-mono text-[11px] text-amber"><CheckCheck size={12} /> mark read</button>
      </div>
      {list.map((n) => (
        <div key={n.id} className="card2 flex items-start gap-2.5 p-3">
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.kind === "ok" ? "bg-ok" : n.kind === "warn" ? "bg-amber" : "bg-cool"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] leading-relaxed text-ink">{n.text}</p>
            <p className="mt-0.5 font-mono text-[10px] text-faint">{relTime(n.date + "T09:00:00")}</p>
          </div>
          {!n.readBy.includes(userId) && <Chip tone="amber">new</Chip>}
        </div>
      ))}
    </div>
  );
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5">
      <div className="a-pop flex h-20 w-20 items-center justify-center rounded-3xl border border-line bg-gradient-to-br from-[hsl(38_70%_45%)] to-[hsl(68_65%_28%)] shadow-[0_16px_50px_rgba(255,178,36,0.2)]">
        <Boxes size={38} className="text-white" />
      </div>
      <div className="text-center">
        <p className="ttl text-2xl font-bold tracking-wide text-ink">ShiftGate</p>
        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.25em] text-faint">warehouse attendance OS</p>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-amber" style={{ animation: `pulsedot 1s ${i * 0.18}s ease-in-out infinite` }} />
        ))}
      </div>
      <p className="blinkc font-mono text-[11px] text-mut">arming geofence & face models</p>
    </div>
  );
}
