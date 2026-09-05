import { useState, type FormEvent } from "react";
import { ArrowRight, Boxes, CheckCircle2, History, LogIn } from "lucide-react";
import { getDB } from "../lib/store";
import { signIn } from "../lib/production";
import { Btn, Field, toast } from "../components/ui";
import { useT } from "../lib/i18n";
import { VERSION } from "../lib/changelog";
import type { User } from "../types";

export default function Login({ onLogin, onSetup, onChangelog }: { onLogin: (u: User) => void; onSetup: () => void; onChangelog: () => void }) {
  const db = getDB();
  const t = useT();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await signIn(email.trim(), pw);
    setBusy(false);
    if (!res.user) {
      setErr(res.error ?? "Sign-in failed");
      setShake((s) => s + 1);
      return;
    }
    toast(`Welcome, ${res.user.name.split(" ")[0]}`, "ok");
    onLogin(res.user);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <div className="m-auto w-full">
      <div className="a-drop mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-line shadow-[0_10px_36px_rgba(0,0,0,0.45)]"
          style={{ background: `linear-gradient(135deg, hsl(${db?.settings.hue ?? 38} 70% 45%), hsl(${(db?.settings.hue ?? 38) + 30} 65% 28%))` }}>
          {db?.settings.logo ? <img src={db.settings.logo} alt="logo" className="h-full w-full object-cover" /> : <Boxes size={30} className="text-white" />}
        </div>
        <h1 className="ttl text-3xl font-bold tracking-wide text-ink">{db?.settings.appName ?? "ShiftGate"}</h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-faint">{db?.settings.company} · {db?.settings.siteName}</p>
        <div className="conveyor mx-auto mt-4 h-1.5 w-24 rounded-full opacity-90" />
      </div>

      {/* systems-armed boot checklist */}
      <div className="card mb-4 px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="ttl text-[11px] font-bold text-faint">systems armed</p>
          <span className="led" />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {["local store", "geofence", "face model", "secure link"].map((s, i) => (
            <p key={s} className="a-fadein flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-mut" style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
              <CheckCircle2 size={12} className="text-ok" /> {s}
            </p>
          ))}
        </div>
      </div>

      <form key={shake} onSubmit={submit} className={`card space-y-4 p-5 ${shake ? "a-shake" : "a-rise"}`}>
        <Field label={t("a.email")}>
          <input className="inp" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
        </Field>
        <Field label="Password">
          <input className="inp" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" required />
        </Field>
        {err && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{err}</p>}
        <Btn className="w-full py-3 text-[15px]" busy={busy}>
          <LogIn size={16} /> Sign in <ArrowRight size={15} />
        </Btn>
        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint">Supabase Auth · role-based access</p>
      </form>

      <button onClick={onSetup} className="tap mx-auto mt-4 block font-mono text-[10.5px] uppercase tracking-widest text-faint hover:text-amber">
        First-time setup · create administrator
      </button>

      <button onClick={onChangelog}
        className="tap mx-auto mt-6 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-widest text-faint hover:text-amber">
        <History size={12} /> v{VERSION} · changelog
      </button>

      </div>
    </div>
  );
}
