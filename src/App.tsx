import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Bell, Boxes, CalendarDays, ChevronLeft, Home, Settings2, User as UserIcon } from "lucide-react";
import type { User } from "./types";
import { getDB, getSessionUser, hasWorkspace, initStore, markNotisRead, unreadCount, useDB } from "./lib/store";
import { fmtClock, relTime } from "./lib/util";
import { useT } from "./lib/i18n";
import { Avatar, LiveDot, Sheet, handleHardwareBack } from "./components/ui";
import { ChangelogSheet } from "./lib/changelog";
import SetupWizard from "./features/setup";
import Login from "./features/auth";
import Dashboard from "./features/dashboard";
import Schedule from "./features/schedule";
import Performance from "./features/performance";
import Overtime from "./features/overtime";
import Admin, { type AdminSec } from "./features/admin";
import Me from "./features/me";

initStore();

type Tab = "home" | "piket" | "stats" | "ot" | "fifth";
interface NavState { tab: Tab; sec: AdminSec }
const navUrl = (s: NavState) => `#/${s.tab}${s.sec !== "live" ? "/" + s.sec : ""}`;

export default function App() {
  const db = useDB();
  const [booting, setBooting] = useState(true);
  const [sessionTick, setSessionTick] = useState(0);
  const [changelogOpen, setChangelogOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 950);
    return () => clearTimeout(t);
  }, []);

  const cur = useMemo(() => getSessionUser(), [db, sessionTick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (booting) return <Splash />;
  if (!db) return null;
  if (!hasWorkspace()) return <SetupWizard />;
  if (!cur)
    return (
      <>
        <Login onLogin={() => setSessionTick((t) => t + 1)} onChangelog={() => setChangelogOpen(true)} />
        <ChangelogSheet open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      </>
    );
  return (
    <>
      <Shell user={cur} onChangelog={() => setChangelogOpen(true)} />
      <ChangelogSheet open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  );
}

function Splash() {
  const db = getDB();
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="a-floaty flex h-14 w-14 items-center justify-center rounded-2xl border border-line"
          style={{ background: `linear-gradient(135deg, hsl(${db?.settings.hue ?? 38} 70% 45%), hsl(${(db?.settings.hue ?? 38) + 30} 65% 28%))` }}>
          <Boxes size={26} className="text-white" />
        </div>
        <p className="ttl text-lg font-bold text-ink">{db?.settings.appName ?? "ShiftGate"}</p>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-line2">
          <div className="h-full w-1/2 rounded-full bg-amber" style={{ animation: "shimmer 1.1s linear infinite" }} />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">warehouse attendance os</p>
      </div>
    </div>
  );
}

function Shell({ user, onChangelog }: { user: User; onChangelog: () => void }) {
  const db = useDB();
  const t = useT();
  const isAdmin = user.role !== "staff";
  const [nav, setNav] = useState<NavState>({ tab: "home", sec: "live" });
  const [bellOpen, setBellOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const navRef = useRef(nav);
  navRef.current = nav;

  const { tab, sec: adminSec } = nav;

  useEffect(() => {
    const iv = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  /* ---- history-based back navigation (Android hardware back) ---- */
  useEffect(() => {
    window.history.replaceState(navRef.current, "", navUrl(navRef.current));
    const onPop = (e: PopStateEvent) => {
      // 1) an open sheet/dialog gets the back press first
      if (handleHardwareBack()) {
        window.history.pushState(navRef.current, "", navUrl(navRef.current));
        return;
      }
      // 2) otherwise step back through tabs / admin sections
      const st = (e.state ?? {}) as Partial<NavState>;
      const next: NavState = {
        tab: (["home", "piket", "stats", "ot", "fifth"] as Tab[]).includes(st.tab as Tab) ? (st.tab as Tab) : "home",
        sec: (["live", "staff", "notice", "cloud", "config"] as AdminSec[]).includes(st.sec as AdminSec) ? (st.sec as AdminSec) : "live",
      };
      setNav(next);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goTab = (tb: Tab) => {
    const next: NavState = { tab: tb, sec: "live" };
    setNav(next);
    window.history.pushState(next, "", navUrl(next));
    window.scrollTo({ top: 0 });
  };
  const goAdminSec = (s: AdminSec) => {
    const next: NavState = { tab: "fifth", sec: s };
    setNav(next);
    window.history.pushState(next, "", navUrl(next));
    window.scrollTo({ top: 0 });
  };
  const goBack = () => window.history.back();
  const canGoBack = tab !== "home" || adminSec !== "live";

  if (!db) return null;
  const unread = unreadCount(user.id);

  const TABS = [
    { id: "home" as Tab, icon: Home, label: t("nav.home") },
    { id: "piket" as Tab, icon: CalendarDays, label: t("nav.piket") },
    { id: "stats" as Tab, icon: BarChart3, label: t("nav.stats") },
    { id: "ot" as Tab, icon: ClockMini, label: t("nav.ot") },
    { id: "fifth" as Tab, icon: isAdmin ? Settings2 : UserIcon, label: isAdmin ? t("nav.admin") : t("nav.me") },
  ];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md">
      {/* header */}
      <header className="sticky top-0 z-50 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="hazard h-[3px] w-full opacity-90" />
        <div className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4">
          {canGoBack ? (
            <button onClick={goBack}
              className="tap -ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-amber/40 bg-amber/10 text-amber hover:bg-amber/20"
              aria-label={t("c.back")}>
              <ChevronLeft size={18} />
            </button>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line"
              style={{ background: `linear-gradient(135deg, hsl(${db.settings.hue} 70% 45%), hsl(${db.settings.hue + 30} 65% 28%))` }}>
              {db.settings.logo ? <img src={db.settings.logo} alt="" className="h-full w-full object-cover" /> : <Boxes size={18} className="text-white" />}
            </div>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="ttl truncate text-[15px] font-bold text-ink">{db.settings.appName}</p>
            <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider text-faint">
              <LiveDot /> {db.settings.siteName}
              {tab === "fifth" && adminSec !== "live" && <span className="text-amber">· {adminSec}</span>}
            </p>
          </div>
          <span className="hidden font-mono text-[11.5px] tabular-nums text-mut min-[380px]:inline">{fmtClock(clock)}</span>
          <button onClick={() => { setBellOpen(true); markNotisRead(user.id); }}
            className="tap relative rounded-[10px] border border-line bg-panel2 p-2 text-mut hover:text-ink" aria-label={t("c.notifications")}>
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 font-mono text-[9px] font-bold text-[#191203]">{unread}</span>
            )}
          </button>
          <Avatar user={user} size={32} />
        </div>
      </header>

      {/* page — bottom padding clears the fixed tab bar + device safe area */}
      <main className="app-main px-4 pt-4">
        <div key={tab + adminSec} className="a-fadein">
          {tab === "home" && <Dashboard user={user} goTab={(x) => goTab(x as Tab)} />}
          {tab === "piket" && <Schedule user={user} />}
          {tab === "stats" && <Performance user={user} />}
          {tab === "ot" && <Overtime user={user} />}
          {tab === "fifth" && (isAdmin ? <Admin user={user} sec={adminSec} onSec={goAdminSec} /> : <Me user={user} onChangelog={onChangelog} />)}
        </div>
      </main>

      {/* bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto max-w-md border-t border-line bg-panel/92 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 backdrop-blur-md">
          <div className="flex">
            {TABS.map((tb) => {
              const Ic = tb.icon;
              const active = tab === tb.id;
              return (
                <button key={tb.id} onClick={() => goTab(tb.id)}
                  className={`tap relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 ${active ? "text-amber" : "text-faint hover:text-mut"}`}>
                  <span className={`absolute -top-1.5 h-[3px] w-7 rounded-full bg-amber transition-opacity ${active ? "opacity-100" : "opacity-0"}`} />
                  <Ic size={20} className={active ? "drop-shadow-[0_0_8px_rgba(255,178,36,0.5)]" : ""} />
                  <span className="ttl text-[9.5px] font-bold tracking-wide">{tb.label}</span>
                  {tb.id === "ot" && isAdmin && (db.ot.filter((o) => o.status === "pending").length > 0) && (
                    <span className="absolute right-[22%] top-0.5 h-1.5 w-1.5 rounded-full bg-bad" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* notification center */}
      <Sheet open={bellOpen} onClose={() => setBellOpen(false)} title={t("c.notifications")} wide>
        <div className="space-y-2">
          {db.notifications.filter((n) => n.userId === "*" || n.userId === user.id).map((n) => (
            <div key={n.id} className="card p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="ttl text-[13.5px] font-bold text-ink">{n.title}</p>
                <span className="shrink-0 font-mono text-[10px] text-faint">{relTime(n.date)}</span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-mut">{n.body}</p>
            </div>
          ))}
          {db.notifications.filter((n) => n.userId === "*" || n.userId === user.id).length === 0 && (
            <p className="py-6 text-center font-mono text-[11.5px] text-faint">—</p>
          )}
        </div>
      </Sheet>
    </div>
  );
}

/** tiny inline clock glyph so the OT tab keeps its identity without an extra import */
function ClockMini(props: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={props.size ?? 20} height={props.size ?? 20} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
