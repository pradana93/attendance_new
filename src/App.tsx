import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Bell, Boxes, CalendarDays, ChevronLeft, Download, History, Home, LogOut, Settings2, User as UserIcon } from "lucide-react";
import type { User } from "./types";
import { getDB, getSessionUser, hasWorkspace, initStore, logout, markNotisRead, unreadCount, updateSettings, useDB } from "./lib/store";
import { fmtClock, fmtDate, relTime } from "./lib/util";
import { useT } from "./lib/i18n";
import { APP_VERSION } from "./lib/store";
import { Avatar, Btn, Chip, Confirm, LiveDot, Seg, Sheet, Toggle, handleHardwareBack, toast } from "./components/ui";
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

/* capture the PWA install prompt so the profile sheet can offer "Install app" */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredInstall: BIPEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e as BIPEvent;
  });
}

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

const BOOT_LINES = ["mount local store", "load geofence beacon", "arm face model", "open gate"];

function Splash() {
  const db = getDB();
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex w-full max-w-[260px] flex-col items-center">
        {/* roller door revealing the brand mark */}
        <div className="doorwrap">
          <div className="doorfloor">
            <div className="a-pop flex h-12 w-12 items-center justify-center rounded-xl border border-line shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
              style={{ background: `linear-gradient(135deg, hsl(${db?.settings.hue ?? 38} 70% 45%), hsl(${(db?.settings.hue ?? 38) + 30} 65% 28%))`, animationDelay: "0.7s" }}>
              <Boxes size={22} className="text-white" />
            </div>
          </div>
          <div className="door" />
        </div>
        <p className="ttl mt-4 text-2xl font-bold tracking-wide text-ink">{db?.settings.appName ?? "ShiftGate"}</p>
        <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.24em] text-faint">warehouse attendance os</p>

        <div className="mt-5 w-full space-y-1.5">
          {BOOT_LINES.map((l, i) => (
            <div key={l} className="a-fadein flex items-center justify-between font-mono text-[10px] uppercase tracking-widest"
              style={{ animationDelay: `${0.15 + i * 0.16}s` }}>
              <span className="text-faint">{l}</span>
              <span className="text-ok">ok</span>
            </div>
          ))}
        </div>

        <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-line2">
          <div className="h-full w-1/2 rounded-full bg-amber" style={{ animation: "shimmer 1.05s linear infinite" }} />
        </div>
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
  const [profileOpen, setProfileOpen] = useState(false);
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
              <span className="led" /> {db.settings.siteName}
              {tab === "fifth" && adminSec !== "live" && <span className="text-amber">· {adminSec}</span>}
            </p>
          </div>
          <span className="hidden font-mono text-[11.5px] tabular text-mut min-[380px]:inline">
            {(() => {
              const [h, m, s] = fmtClock(clock).split(":");
              return <>{h}<span className="colon">:</span>{m}<span className="colon">:</span>{s}</>;
            })()}
          </span>
          <button onClick={() => { setBellOpen(true); markNotisRead(user.id); }}
            className="tap relative rounded-[10px] border border-line bg-panel2 p-2 text-mut hover:text-ink" aria-label={t("c.notifications")}>
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 font-mono text-[9px] font-bold text-[#191203]">{unread}</span>
            )}
          </button>
          <button onClick={() => setProfileOpen(true)} className="tap rounded-full" aria-label={t("m.profile")}>
            <Avatar user={user} size={32} ring={false} />
          </button>
        </div>
      </header>

      {/* page — bottom padding clears the fixed tab bar + device safe area */}
      <main className="app-main px-4 pt-4">
        <div key={tab + adminSec} className="pagein">
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
                  <Ic size={20} className={active ? "navpop drop-shadow-[0_0_8px_rgba(255,178,36,0.5)]" : ""} />
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

      <ProfileSheet user={user} open={profileOpen} onClose={() => setProfileOpen(false)} onChangelog={onChangelog} />
    </div>
  );
}

/* =============== profile sheet — logout, changelog, prefs, install =============== */
function ProfileSheet({ user, open, onClose, onChangelog }: { user: User; open: boolean; onClose: () => void; onChangelog: () => void }) {
  const db = useDB();
  const t = useT();
  const [confirmOut, setConfirmOut] = useState(false);
  const [installing, setInstalling] = useState(false);
  if (!db) return null;
  const lang = db.settings.language;
  const dark = db.settings.theme === "dark";

  const doInstall = async () => {
    if (!deferredInstall) return;
    setInstalling(true);
    try {
      await deferredInstall.prompt();
      const choice = await deferredInstall.userChoice;
      toast(choice.outcome === "accepted" ? "Installing ShiftGate…" : "Install dismissed", choice.outcome === "accepted" ? "ok" : "info");
      deferredInstall = null;
    } finally {
      setInstalling(false);
      onClose();
    }
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} title={t("m.profile")}>
        <div className="space-y-4">
          {/* identity */}
          <div className="card relative overflow-hidden p-4">
            <div className="hazard absolute inset-x-0 top-0 h-1" />
            <div className="flex items-center gap-3.5">
              <Avatar user={user} size={56} ring />
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-ink">{user.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-faint">{user.employeeId} · {user.department}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Chip tone={user.role === "superadmin" ? "amber" : user.role === "admin" ? "cool" : "mut"}>{user.role}</Chip>
                  <span className="font-mono text-[10px] text-faint">{t("pf.member")} {fmtDate(user.createdAt.slice(0, 10))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* quick settings */}
          <div className="card divide-y divide-line2">
            <p className="ttl px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-faint">{t("pf.quick")}</p>
            <div className="flex items-center justify-between px-4 py-2.5">
              <p className="text-[13px] font-semibold text-ink">{t("a.lang")}</p>
              <Seg small value={lang} onChange={(v) => updateSettings({ language: v })}
                options={[{ id: "en", label: "EN" }, { id: "id", label: "ID" }]} />
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <p className="text-[13px] font-semibold text-ink">{t("a.night")}</p>
              <Toggle on={dark} onChange={(v) => updateSettings({ theme: v ? "dark" : "light" })} />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Download size={15} className="shrink-0 text-cool" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{t("pf.install")}</p>
                  <p className="truncate font-mono text-[10px] text-faint">{t("pf.installHint")}</p>
                </div>
              </div>
              {deferredInstall && (
                <Btn variant="ghost" className="!px-3 !py-1.5 shrink-0 text-[12px]" busy={installing} onClick={doInstall}>
                  <Download size={13} /> PWA
                </Btn>
              )}
            </div>
          </div>

          {/* changelog */}
          <button onClick={() => { onClose(); onChangelog(); }}
            className="tap card flex w-full items-center justify-between p-3.5 text-left hover:border-amber/40">
            <span className="flex items-center gap-2.5">
              <History size={16} className="text-amber" />
              <span className="text-[13px] font-semibold text-ink">Changelog</span>
            </span>
            <Chip tone="amber">v{APP_VERSION}</Chip>
          </button>

          {/* logout — visible for every role */}
          <Btn variant="danger" className="w-full" onClick={() => setConfirmOut(true)}>
            <LogOut size={16} /> {t("c.logout")}
          </Btn>
        </div>
      </Sheet>

      <Confirm open={confirmOut} onClose={() => setConfirmOut(false)} danger title={t("c.logoutQ")} body={t("c.logoutBody")}
        yesLabel={t("c.logout")} onYes={() => { logout(); onClose(); }} />
    </>
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
