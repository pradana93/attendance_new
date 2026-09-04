import { History, Sparkles, Wrench, ShieldCheck, Bug } from "lucide-react";
import { APP_VERSION } from "./store";
import { Chip, Sheet } from "../components/ui";

export { APP_VERSION as VERSION };

type Tag = "new" | "improved" | "fixed" | "security";
interface Item { tag: Tag; text: string; textId?: string }
interface Release { version: string; date: string; name: string; items: Item[] }

const TAG_META: Record<Tag, { label: string; tone: "ok" | "cool" | "amber" | "bad"; cls: string; icon: typeof Sparkles }> = {
  new: { label: "New", tone: "ok", cls: "text-ok", icon: Sparkles },
  improved: { label: "Improved", tone: "cool", cls: "text-cool", icon: Wrench },
  fixed: { label: "Fixed", tone: "amber", cls: "text-amber", icon: Bug },
  security: { label: "Security", tone: "bad", cls: "text-bad", icon: ShieldCheck },
};

export const RELEASES: Release[] = [
  {
    version: "1.10.0", date: "2026-03-28", name: "Push notifications",
    items: [
      { tag: "new", text: "Push notification reminders for Android Chrome PWA — schedule daily clock-in, clock-out and piket duty alerts." },
      { tag: "new", text: "Notification permission request with graceful fallback when denied." },
      { tag: "new", text: "Smart scheduling: auto-calculates shift times based on lateTime setting, skips Sundays, repeats daily for clock in/out." },
      { tag: "new", text: "Piket reminder shows assigned task names when user has duty today." },
      { tag: "improved", text: "Me tab now shows reminder status with AlarmClock icon and toggle control." },
      { tag: "improved", text: "Bilingual support for all notification UI (English/Bahasa Indonesia)." },
    ],
  },
  {
    version: "1.9.0", date: "2026-03-25", name: "Feedback loop",
    items: [
      { tag: "new", text: "User feedback system — staff and admins can submit bugs, ideas, praise and general feedback with optional screenshot capture." },
      { tag: "new", text: "Admin Feedback Inbox — filter by type, sort by priority or date, track status from New → In Review → Planned → In Progress → Shipped/Won't Fix." },
      { tag: "new", text: "Feedback detail view with admin notes, status workflow and metadata (route, app version, device info)." },
      { tag: "improved", text: "Capture module now exports takePhoto() for programmatic camera access in sheets and forms." },
    ],
  },
  {
    version: "1.7.0", date: "2026-03-18", name: "Surface upgrade",
    items: [
      { tag: "improved", text: "Ambient layered background: film grain plus a slow radar-beacon sweep behind every screen." },
      { tag: "improved", text: "New splash: the warehouse roller door rolls up to reveal the brand mark with a boot sequence." },
      { tag: "improved", text: "Login gains a live 'systems armed' checklist and an animated conveyor strip." },
      { tag: "improved", text: "The check-in button is now a heavy industrial press: layered depth, moving light sweep, press physics." },
      { tag: "improved", text: "Clock card is an instrument panel — blinking colons, passing scanline and a live shift-progress bar." },
      { tag: "improved", text: "Toasts show a lifetime bar, tabs pop when activated, sheets spring in, pages glide on switch." },
      { tag: "improved", text: "Polish: themed scrollbars, amber focus rings, reduced-motion support for every new animation." },
    ],
  },
  {
    version: "1.6.0", date: "2026-03-10", name: "Ops upgrades & installable app",
    items: [
      { tag: "fixed", text: "Logout & changelog are now reachable for every role — tap your avatar in the header to open the profile sheet." },
      { tag: "fixed", text: "Toast notifications were silently dropped (never mounted) — feedback now shows across the whole app." },
      { tag: "new", text: "Shift handover log: outgoing crew posts notes + pending issues, incoming crew confirms receipt." },
      { tag: "new", text: "Piket swap requests: staff ask a colleague to cover a duty day; admin approves; roster updates for that date." },
      { tag: "new", text: "Attendance CSV export from the live board for payroll/HR handoff." },
      { tag: "new", text: "Achievement badges in Stats: Iron Streak, Perfect Month, On-Time Ace, Piket Champion, OT Machine." },
      { tag: "new", text: "Live dock-weather card on the dashboard (temperature, wind, rain alerts at the warehouse GPS)." },
      { tag: "new", text: "Installable PWA: manifest, offline service worker and an Install button in the profile sheet." },
    ],
  },
  {
    version: "1.5.0", date: "2026-03-02", name: "UI/UX health check",
    items: [
      { tag: "fixed", text: "Overlay stacking rebuilt: every sheet, dialog, lightbox and toast now portals to the document root — nothing can render under the tab bar anymore." },
      { tag: "fixed", text: "Leaflet map panes (z-index 200–1000) are now isolated and can no longer leak above the navigation or pop-ups." },
      { tag: "fixed", text: "Hardware-back registry no longer consumes handlers destructively — repeated back presses behave correctly with stacked sheets." },
      { tag: "new", text: "Admin → Photos: full evidence gallery of every piket proof and overtime photo with filters and full-screen review." },
      { tag: "new", text: "Admin can now edit existing accounts: name, email, employee ID, department and role (Super Admin role locked)." },
      { tag: "improved", text: "Scroll-reveal animations, count-up numbers on dashboard stats, card hover glow, sheet drag handle and body scroll-locking under overlays." },
      { tag: "improved", text: "Mobile hardening: no more iOS auto-zoom on input focus, safe-area insets on toasts and lightbox, login screen no longer clips on short devices." },
    ],
  },
  {
    version: "1.4.0", date: "2026-02-20", name: "Login, back navigation & changelog",
    items: [
      { tag: "security", text: "Password reset now routes through a Gmail SMTP relay (smtp.gmail.com:587, STARTTLS) with tokenized reset links." },
      { tag: "security", text: "Super Admin sign-in is permanently fixed to majestap93@gmail.com / super123 and enforced on every load." },
      { tag: "new", text: "In-app changelog — this screen. Available from the Me tab and the login footer." },
      { tag: "new", text: "Android hardware back button now navigates inside the app (closes sheets first, then steps back through tabs) instead of closing the WebApp." },
      { tag: "new", text: "Visible back button in the header when you are deeper than the Home tab." },
      { tag: "fixed", text: "Content no longer hides behind the bottom tab bar — padding now respects the device safe-area inset." },
      { tag: "new", text: "README.md added with full setup, demo accounts and deployment notes." },
    ],
  },
  {
    version: "1.3.0", date: "2026-02-12", name: "Bilingual & cloud-ready",
    items: [
      { tag: "new", text: "Language setting: English / Bahasa Indonesia across the whole app." },
      { tag: "new", text: "Supabase deploy wizard in Admin → Cloud: credentials, schema migration, connection test, SQL preview and sync." },
      { tag: "new", text: "GPS-first check-in with a Leaflet geofence map — inside/outside verdict before face verification." },
      { tag: "new", text: "Customizable piket: task catalog (Harian Depan/Tengah/Belakang, Tutup Rolling Door, Foto Suhu Container 20ft & 40ft) with a Mon–Sat weekly template, auto-rotate and photo proof." },
      { tag: "new", text: "Top performance podium, watchlist and team rank in Stats; IDR overtime payout estimates and timeline details." },
      { tag: "new", text: "Logout button with confirmation on the Me tab." },
    ],
  },
  {
    version: "1.2.0", date: "2026-01-28", name: "Points, rewards & live floor",
    items: [
      { tag: "new", text: "Piket points system with configurable values per duty and a 12-month expiry." },
      { tag: "new", text: "Rewards catalog — redeem points for gear, vouchers and essentials, with stock tracking." },
      { tag: "new", text: "Live floor board for admins: on-duty pulse, late flags, self-report review and manual override." },
      { tag: "new", text: "Announcement board with pinned broadcasts on every dashboard." },
      { tag: "improved", text: "Notification center with per-user delivery and read states." },
    ],
  },
  {
    version: "1.1.0", date: "2026-01-15", name: "Verification & analytics",
    items: [
      { tag: "new", text: "Face verification check-in/out with 80% match threshold, plus QR-badge fallback." },
      { tag: "new", text: "Configurable geofence radius with haversine distance checks and self-report fallback." },
      { tag: "new", text: "Overtime requests with admin approval, notes and CSV export." },
      { tag: "new", text: "Performance analytics: attendance ring, YTD bars, monthly heatmap, streaks and insights." },
    ],
  },
  {
    version: "1.0.0", date: "2026-01-05", name: "Initial release",
    items: [
      { tag: "new", text: "First-run setup wizard: workspace branding, warehouse GPS site, admin account and database initialization." },
      { tag: "new", text: "Role-based accounts: Super Admin, Admin and Staff with session management." },
      { tag: "new", text: "Core attendance with late detection, check-in/out history and dashboard." },
      { tag: "new", text: "Local-first storage shaped to the Supabase schema — works fully offline." },
    ],
  },
];

export function ChangelogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Changelog" wide>
      <div className="mb-4 flex items-center justify-between rounded-xl border border-amber/30 bg-amber/8 px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-[12.5px] text-mut">
          <History size={14} className="text-amber" /> Current build
        </span>
        <Chip tone="amber">v{APP_VERSION}</Chip>
      </div>
      <div className="relative space-y-5 pl-5">
        <span className="absolute bottom-2 left-[7px] top-2 w-px bg-line" />
        {RELEASES.map((r, ri) => (
          <div key={r.version} className="relative">
            <span className={`absolute -left-5 top-1 h-[15px] w-[15px] rounded-full border-2 ${ri === 0 ? "border-amber bg-amber/30" : "border-line bg-panel2"}`} />
            <div className={`card p-4 ${ri === 0 ? "border-amber/40" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="ttl text-[15px] font-bold text-ink">v{r.version}</span>
                {ri === 0 && <Chip tone="amber">latest</Chip>}
                <span className="ml-auto font-mono text-[10.5px] text-faint">{r.date}</span>
              </div>
              <p className="mt-0.5 text-[12px] font-medium text-amber/90">{r.name}</p>
              <ul className="mt-3 space-y-2.5">
                {r.items.map((it, i) => {
                  const m = TAG_META[it.tag];
                  const Ic = m.icon;
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-panel2 text-${m.tone}`}>
                        <Ic size={12} className={`text-${m.tone}`} />
                      </span>
                      <div className="min-w-0">
                        <Chip tone={m.tone} className="mb-1">{m.label}</Chip>
                        <p className="text-[12.5px] leading-relaxed text-mut">{it.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-widest text-faint">
        ShiftGate · warehouse attendance OS · local-first build
      </p>
    </Sheet>
  );
}
