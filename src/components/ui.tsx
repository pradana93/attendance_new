import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { User } from "../types";

/* ---------------- toast bus ---------------- */
export interface ToastMsg { id: number; text: string; kind: "ok" | "err" | "info" }
let toastSeq = 0;
const toastSubs = new Set<(t: ToastMsg) => void>();
export function toast(text: string, kind: ToastMsg["kind"] = "ok") {
  const msg = { id: ++toastSeq, text, kind };
  toastSubs.forEach((fn) => fn(msg));
}
export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const fn = (t: ToastMsg) => {
      setItems((cur) => [...cur.slice(-2), t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 3400);
    };
    toastSubs.add(fn);
    return () => { toastSubs.delete(fn); };
  }, []);
  const Icon = (k: ToastMsg["kind"]) =>
    k === "ok" ? <CheckCircle2 size={17} className="text-ok shrink-0" /> : k === "err" ? <XCircle size={17} className="text-bad shrink-0" /> : <Info size={17} className="text-cool shrink-0" />;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} className="a-drop pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-line bg-panel px-3.5 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
          {Icon(t.kind)}
          <p className="text-[13px] font-medium leading-snug text-ink">{t.text}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- primitives ---------------- */
export function Btn({
  children, onClick, variant = "primary", className = "", disabled, busy,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "ok" | "dark";
  className?: string; disabled?: boolean; busy?: boolean;
}) {
  const base = "tap inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold disabled:opacity-45 disabled:pointer-events-none";
  const styles = {
    primary: "bg-amber text-[#191203] hover:brightness-110 shadow-[0_6px_20px_rgba(255,178,36,0.22)]",
    ghost: "border border-line bg-panel2 text-ink hover:border-faint",
    danger: "bg-bad/12 text-bad border border-bad/30 hover:bg-bad/20",
    ok: "bg-ok/12 text-ok border border-ok/30 hover:bg-ok/20",
    dark: "bg-line2 text-ink hover:bg-line",
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled || busy} className={`${base} ${styles} ${className}`}>
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Chip({ children, tone = "mut", className = "" }: { children: ReactNode; tone?: "amber" | "ok" | "bad" | "cool" | "mut"; className?: string }) {
  const tones = {
    amber: "bg-amber/12 text-amber border-amber/25",
    ok: "bg-ok/12 text-ok border-ok/25",
    bad: "bg-bad/12 text-bad border-bad/25",
    cool: "bg-cool/12 text-cool border-cool/25",
    mut: "bg-panel2 text-mut border-line",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wide ${tones} ${className}`}>
      {children}
    </span>
  );
}

export function Avatar({ user, size = 38, ring }: { user: Pick<User, "name" | "hue" | "employeeId">; size?: number; ring?: boolean }) {
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-bold ${ring ? "ring-2 ring-amber/60 ring-offset-2 ring-offset-panel" : ""}`}
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${user.hue} 65% 42%), hsl(${user.hue + 40} 60% 30%))`,
        color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.35)",
      }}
    >
      {initials}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-5 flex items-center justify-between first:mt-0">
      <h2 className="ttl flex items-center gap-2 text-[15px] font-bold text-ink">
        <span className="inline-block h-3.5 w-1 rounded-full bg-amber" />
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl border border-line bg-panel2 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`tap ttl flex-1 rounded-lg px-2 py-1.5 text-[12.5px] font-bold ${value === o.id ? "bg-amber text-[#191203]" : "text-mut hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`tap relative h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? "border-amber/50 bg-amber/80" : "border-line bg-panel2"}`}
      aria-pressed={on}
    >
      <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="ttl mb-1.5 block text-[11.5px] font-bold text-mut">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export function Empty({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <div className="a-fadein flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-panel/50 px-6 py-9 text-center">
      <div className="text-faint">{icon}</div>
      <p className="ttl text-[15px] font-bold text-mut">{title}</p>
      {sub && <p className="max-w-[26ch] text-[12.5px] leading-relaxed text-faint">{sub}</p>}
    </div>
  );
}

/* ---------------- bottom sheet / modal ---------------- */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button className="a-fadein absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className={`a-rise relative max-h-[92dvh] w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} overflow-hidden rounded-t-2xl border border-line bg-panel shadow-[0_-16px_60px_rgba(0,0,0,0.5)] sm:rounded-2xl`}>
        <div className="hazard h-1 w-full opacity-80" />
        <div className="flex max-h-[91dvh] flex-col">
          <div className="flex items-center justify-between px-5 pb-1 pt-4">
            <h3 className="ttl text-lg font-bold text-ink">{title}</h3>
            <button onClick={onClose} className="tap rounded-lg border border-line bg-panel2 p-1.5 text-mut hover:text-ink" aria-label="Close sheet">
              <X size={15} />
            </button>
          </div>
          <div className="no-scrollbar overflow-y-auto px-5 pb-6 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onYes, title, body, yesLabel = "Confirm", danger }: {
  open: boolean; onClose: () => void; onYes: () => void; title: string; body: string; yesLabel?: string; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-5">
      <button className="a-fadein absolute inset-0 bg-black/60" onClick={onClose} aria-label="Cancel" />
      <div className="a-pop relative w-full max-w-xs rounded-2xl border border-line bg-panel p-5 shadow-2xl">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle size={17} className={danger ? "text-bad" : "text-amber"} />
          <h3 className="ttl text-base font-bold text-ink">{title}</h3>
        </div>
        <p className="mb-4 text-[13px] leading-relaxed text-mut">{body}</p>
        <div className="flex gap-2">
          <Btn variant="ghost" className="flex-1" onClick={onClose}>Cancel</Btn>
          <Btn variant={danger ? "danger" : "primary"} className="flex-1" onClick={() => { onYes(); onClose(); }}>{yesLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- status dot ---------------- */
export function LiveDot({ tone = "ok" }: { tone?: "ok" | "amber" | "bad" }) {
  const c = tone === "ok" ? "bg-ok" : tone === "amber" ? "bg-amber" : "bg-bad";
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={`pulse-dot absolute inline-flex h-full w-full rounded-full ${c}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${c}`} />
    </span>
  );
}
