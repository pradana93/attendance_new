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
