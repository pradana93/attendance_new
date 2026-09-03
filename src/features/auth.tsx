import { useState, type FormEvent } from "react";
import { ArrowRight, Boxes, KeyRound, LogIn } from "lucide-react";
import { login, getDB } from "../lib/store";
import { Btn, Field, toast } from "../components/ui";
import type { User } from "../types";

const DEMO = [
  { label: "Super Admin", email: "—", pw: "—", note: "created during setup" },
  { label: "Admin", email: "admin@nusalogistik.id", pw: "admin123" },
  { label: "Staff", email: "budi@nusalogistik.id", pw: "staff123" },
];

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const db = getDB();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const superEmail = db?.users.find((u) => u.role === "superadmin")?.email;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => {
      const res = login(email, pw, remember);
      setBusy(false);
      if (!res.ok || !res.user) {
        setErr(res.msg ?? "Sign-in failed");
        setShake((s) => s + 1);
        return;
      }
      toast(`Selamat datang, ${res.user.name.split(" ")[0]} — shift mode armed`, "ok");
      onLogin(res.user);
    }, 550);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="a-drop mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-line shadow-[0_10px_36px_rgba(0,0,0,0.45)]"
          style={{ background: `linear-gradient(135deg, hsl(${db?.settings.hue ?? 38} 70% 45%), hsl(${(db?.settings.hue ?? 38) + 30} 65% 28%))` }}>
          {db?.settings.logo ? <img src={db.settings.logo} alt="logo" className="h-full w-full object-cover" /> : <Boxes size={30} className="text-white" />}
        </div>
        <h1 className="ttl text-3xl font-bold tracking-wide text-ink">{db?.settings.appName ?? "ShiftGate"}</h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-faint">{db?.settings.company} · {db?.settings.siteName}</p>
        <div className="hazard mx-auto mt-4 h-1.5 w-24 rounded-full opacity-90" />
      </div>

      <form key={shake} onSubmit={submit} className={`card space-y-4 p-5 ${shake ? "a-shake" : "a-rise"}`}>
        <Field label="Email">
          <input className="inp" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@nusalogistik.id" required />
        </Field>
        <Field label="Password">
          <input className="inp" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" required />
        </Field>
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-mut">
            <button type="button" onClick={() => setRemember(!remember)}
              className={`tap flex h-5 w-5 items-center justify-center rounded-md border ${remember ? "border-amber bg-amber text-[#191203]" : "border-line bg-panel2"}`}
              aria-pressed={remember}>
              {remember && <span className="text-[11px] font-bold leading-none">✓</span>}
            </button>
            Remember me
          </label>
          <button type="button" onClick={() => toast("Password reset link sent to your email (demo)", "info")}
            className="tap inline-flex items-center gap-1 text-[12.5px] font-medium text-amber hover:underline">
            <KeyRound size={13} /> Reset password
          </button>
        </div>
        {err && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{err}</p>}
        <Btn className="w-full py-3 text-[15px]" busy={busy}>
          <LogIn size={16} /> Sign in <ArrowRight size={15} />
        </Btn>
        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint">JWT session · 1h expiry · RBAC enforced</p>
      </form>

      <div className="a-rise mt-5" style={{ animationDelay: "0.12s" }}>
        <p className="ttl mb-2 text-center text-[11px] font-bold text-faint">Demo accounts — tap to fill</p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO.map((d) => {
            const e = d.label === "Super Admin" ? superEmail ?? "—" : d.email;
            const usable = d.label !== "Super Admin" || !!superEmail;
            return (
              <button key={d.label} disabled={!usable}
                onClick={() => { setEmail(e); setPw(d.pw); setErr(""); }}
                className={`tap rounded-xl border border-line bg-panel px-3 py-2.5 text-left hover:border-amber/50 disabled:opacity-40 ${d.label === "Super Admin" ? "col-span-2" : ""}`}>
                <p className="ttl text-[13px] font-bold text-ink">{d.label}</p>
                <p className="mt-0.5 truncate font-mono text-[10.5px] text-faint">{d.label === "Super Admin" ? (superEmail ?? "created during setup") : `${d.email} / ${d.pw}`}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
