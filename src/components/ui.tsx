import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[90] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} className="a-drop pointer-events-auto relative flex w-full max-w-sm items-center gap-2.5 overflow-hidden rounded-xl border border-line bg-panel px-3.5 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
          {Icon(t.kind)}
          <p className="text-[13px] font-medium leading-snug text-ink">{t.text}</p>
          <span className="toastbar absolute bottom-0 left-0 h-[2px] rounded-full bg-amber" />
        </div>
      ))}
    </div>,
    document.body,
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

export function Avatar({ user, size = 38, ring }: { user: Pick<User, "name" | "avatarHue">; size?: number; ring?: boolean }) {
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className={`ttl flex shrink-0 items-center justify-center rounded-full font-bold ${ring ? "ring-2 ring-amber/60 ring-offset-2 ring-offset-panel" : ""}`}
      style={{
        width: size, height: size, fontSize: size * 0.36, letterSpacing: "0.03em",
        background: `linear-gradient(135deg, hsl(${user.avatarHue} 65% 42%), hsl(${user.avatarHue + 40} 60% 30%))`,
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

export function Seg<T extends string>({ options, value, onChange, small, className }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; small?: boolean; className?: string }) {
  return (
    <div className={`flex rounded-xl border border-line bg-panel2 ${small ? "w-fit p-0.5" : "p-1"} ${className ?? ""}`}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`tap ttl ${small ? "" : "flex-1"} rounded-lg ${small ? "px-2.5 py-1 text-[11px]" : "px-2 py-1.5 text-[12.5px]"} font-bold ${value === o.id ? "bg-amber text-[#191203]" : "text-mut hover:text-ink"}`}
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

/* ---------------- scroll lock (overlays) ---------------- */
let lockCount = 0;
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockCount++;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.documentElement.style.overflow = prev;
    };
  }, [active]);
}

/* ---------------- hardware back (Android) registry ---------------- */
type BackHandler = () => void;
const backStack: BackHandler[] = [];
export function pushBackHandler(h: BackHandler) { backStack.push(h); }
export function removeBackHandler(h: BackHandler) { const i = backStack.indexOf(h); if (i >= 0) backStack.splice(i, 1); }
/** Peek the top-most handler (non-destructive) and invoke it */
export function handleHardwareBack(): boolean {
  const h = backStack[backStack.length - 1];
  if (!h) return false;
  h();
  return true;
}
/** Register a back handler while `active` (sheets, dialogs) */
export function useBackHandler(active: boolean, onBack: () => void) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    const h: BackHandler = () => ref.current();
    pushBackHandler(h);
    return () => removeBackHandler(h);
  }, [active]);
}

/* ---------------- scroll reveal ---------------- */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0.06, rootMargin: "0px 0px -5% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? "in" : ""} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/* ---------------- animated number ---------------- */
export function useCountUp(target: number, dur = 750): number {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); prev.current = target; return; }
    const from = prev.current;
    prev.current = target;
    if (from === target) { setV(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (target - from) * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

/* ---------------- bottom sheet / modal ---------------- */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useBackHandler(open, onClose);
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button className="a-fadein absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className={`a-spring relative max-h-[92dvh] w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} overflow-hidden rounded-t-2xl border border-line bg-panel shadow-[0_-16px_60px_rgba(0,0,0,0.5)] sm:rounded-2xl`}>
        <div className="hazard h-1 w-full opacity-80" />
        <div className="flex justify-center pt-1.5"><span className="h-1 w-10 rounded-full bg-line2" /></div>
        <div className="flex max-h-[89dvh] flex-col">
          <div className="flex items-center justify-between px-5 pb-1 pt-1.5">
            <h3 className="ttl text-lg font-bold text-ink">{title}</h3>
            <button onClick={onClose} className="tap rounded-lg border border-line bg-panel2 p-1.5 text-mut hover:text-ink" aria-label="Close sheet">
              <X size={15} />
            </button>
          </div>
          <div className="no-scrollbar overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-2">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ open, onClose, onYes, title, body, yesLabel = "Confirm", danger }: {
  open: boolean; onClose: () => void; onYes: () => void; title: string; body: string; yesLabel?: string; danger?: boolean;
}) {
  useBackHandler(open, onClose);
  useScrollLock(open);
  if (!open) return null;
  return createPortal(
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
    </div>,
    document.body,
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

/* ---------------- feedback status badge ---------------- */
export function StatusBadge({ status }: { status: "new" | "review" | "planned" | "progress" | "shipped" | "wont_fix" }) {
  const meta = {
    new: { label: "New", tone: "amber" as const },
    review: { label: "Review", tone: "cool" as const },
    planned: { label: "Planned", tone: "ok" as const },
    progress: { label: "Progress", tone: "cool" as const },
    shipped: { label: "Shipped", tone: "ok" as const },
    wont_fix: { label: "Won't fix", tone: "bad" as const },
  };
  const m = meta[status];
  return <Chip tone={m.tone}>{m.label}</Chip>;
}
