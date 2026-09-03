import { useEffect, useId, useState } from "react";
import type { DayStatus } from "../lib/store";

/* ---------------- ring gauge ---------------- */
export function Ring({ value, size = 132, label, sub }: { value: number; size?: number; label: string; sub?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(value), 60);
    return () => clearTimeout(t);
  }, [value]);
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, v)) / 100) * c;
  const color = v >= 90 ? "var(--ok)" : v >= 70 ? "var(--amber)" : "var(--bad)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1), stroke 0.4s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[26px] font-semibold leading-none text-ink">{Math.round(value)}<span className="text-[13px] text-mut">%</span></span>
        <span className="ttl mt-1 text-[11px] font-bold text-mut">{label}</span>
        {sub && <span className="font-mono text-[10px] text-faint">{sub}</span>}
      </div>
    </div>
  );
}

/* ---------------- YTD bars ---------------- */
export function YtdBars({ data }: { data: { label: string; value: number; current: boolean }[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 340, H = 132, padB = 20, padT = 8;
  const bw = W / data.length;
  const selItem = sel !== null ? data[sel] : null;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[25, 50, 75, 100].map((g) => {
          const y = padT + (H - padB - padT) * (1 - g / 100);
          return <line key={g} x1={0} x2={W} y1={y} y2={y} stroke="var(--line2)" strokeDasharray={g === 100 ? "0" : "3 4"} strokeWidth={1} />;
        })}
        {data.map((d, i) => {
          const h = Math.max(3, (H - padB - padT) * (d.value / 100));
          const x = i * bw + bw * 0.22;
          const y = H - padB - h;
          return (
            <g key={i} onClick={() => setSel(sel === i ? null : i)} className="cursor-pointer">
              <rect x={i * bw} y={0} width={bw} height={H - padB} fill={sel === i ? "var(--line2)" : "transparent"} opacity={0.5} rx={4} />
              <rect x={x} y={y} width={bw * 0.56} height={h} rx={3}
                fill={d.current ? "var(--amber)" : sel === i ? "var(--cool)" : "var(--line)"}
                style={{ transition: "fill .2s" }}
              />
              <text x={i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize={9.5} fontFamily="var(--font-mono)" fill={d.current ? "var(--amber)" : "var(--faint)"}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex h-5 items-center justify-between font-mono text-[11px]">
        <span className="text-faint">Tap a bar for detail</span>
        <span className={selItem ? "text-ink" : "text-faint"}>
          {selItem ? `${selItem.value}% attendance` : "Jan → now"}
        </span>
      </div>
    </div>
  );
}

/* ---------------- month heatmap ---------------- */
const HEAT_COLOR: Record<DayStatus, string> = {
  present: "var(--ok)",
  late: "var(--amber)",
  early: "var(--cool)",
  absent: "var(--bad)",
  off: "var(--line2)",
  future: "transparent",
};
export function Heatmap({ heat, monthLabel }: { heat: { key: string; status: DayStatus; hours: number }[]; monthLabel: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const first = heat[0];
  const offset = first ? (new Date(first.key + "T12:00:00").getDay() + 6) % 7 : 0;
  const selItem = heat.find((h) => h.key === sel);
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center font-mono text-[9.5px] uppercase text-faint">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => <div key={"e" + i} />)}
        {heat.map((h) => (
          <button
            key={h.key}
            onClick={() => h.status !== "future" && setSel(sel === h.key ? null : h.key)}
            className={`aspect-square rounded-[5px] border transition-transform ${sel === h.key ? "scale-110 border-ink/60" : "border-transparent"} ${h.status === "future" ? "border-dashed border-line2" : ""}`}
            style={{ background: HEAT_COLOR[h.status], opacity: h.status === "off" ? 0.7 : h.status === "present" ? 0.85 : 1 }}
            aria-label={h.key}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-mut">
        {([["present", "Present"], ["late", "Late"], ["early", "Early out"], ["absent", "Absent"], ["off", "Off"]] as [DayStatus, string][]).map(([k, l]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-[3px]" style={{ background: HEAT_COLOR[k] }} />{l}
          </span>
        ))}
        <span className="ml-auto text-ink">
          {selItem ? `${selItem.key.slice(8)}/${selItem.key.slice(5, 7)} · ${selItem.hours ? selItem.hours + "h" : selItem.status}` : monthLabel}
        </span>
      </div>
    </div>
  );
}

/* ---------------- sparkline ---------------- */
export function Spark({ values, height = 54 }: { values: number[]; height?: number }) {
  const gid = useId().replace(/:/g, "");
  const W = 300, H = height;
  const min = Math.min(...values, 60), max = 100;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (W - 8) + 4;
    const y = H - 6 - ((v - min) / (max - min || 1)) * (H - 14);
    return [x, y] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${last[0]},${H} L${pts[0][0]},${H} Z`} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke="var(--amber)" strokeWidth={2} strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--amber)" stroke="var(--panel)" strokeWidth={2} />
    </svg>
  );
}
