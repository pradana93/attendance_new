import { useState, type FormEvent } from "react";
import { ArrowRight, Boxes, CheckCircle2, History, LogIn, Eye, EyeOff, Mail, KeyRound } from "lucide-react";
import { getDB } from "../lib/store";
import { signIn, productionClient } from "../lib/production";
import { edgeErrorMessage } from "../lib/supabase";
import { Btn, Field, Sheet, toast } from "../components/ui";
import { useT } from "../lib/i18n";
import { VERSION } from "../lib/changelog";
import type { User } from "../types";

export default function Login({ onLogin, onChangelog }: { onLogin: (u: User) => void; onChangelog: () => void }) {
  const db = getDB();
  const t = useT();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

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
          <div className="relative">
            <input 
              className="inp w-full pr-10" 
              type={showPassword ? "text" : "password"} 
              autoComplete="current-password" 
              value={pw} 
              onChange={(e) => setPw(e.target.value)} 
              placeholder="••••••••" 
              required 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-ink tap p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
        {err && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{err}</p>}
        <Btn className="w-full py-3 text-[15px]" busy={busy}>
          <LogIn size={16} /> Sign in <ArrowRight size={15} />
        </Btn>
        <button type="button" onClick={() => { setForgotEmail(email); setForgotOpen(true); }} className="tap w-full text-center font-mono text-[11px] text-amber hover:underline">Forgot Password? (Gmail)</button>
        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint">Supabase Auth · role-based access</p>
      </form>

      <Sheet open={forgotOpen} onClose={() => setForgotOpen(false)} title="Forgot Password — Gmail">
        <div className="space-y-3">
          <p className="font-mono text-[11px] text-faint">Enter your email — Gmail SMTP (Super Admin configured) will send a reset link.</p>
          <Field label="Email"><input className="inp" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@company.com" /></Field>
          <Btn className="w-full" busy={forgotBusy} onClick={async () => {
            if (!forgotEmail.includes("@")) { toast("Valid email required", "err"); return; }
            setForgotBusy(true);
            try {
              const client = productionClient();
              if (!client) throw new Error("Supabase not configured");
              const { data, error } = await client.functions.invoke("send-reset-gmail", { body: { email: forgotEmail.trim(), redirectTo: window.location.origin } });
              if (error) throw new Error(await edgeErrorMessage(error, data));
              toast("Reset email sent via Gmail — check inbox", "ok");
              setForgotOpen(false);
            } catch (e) { toast(e instanceof Error ? e.message : "Could not send reset email — ask Super Admin to configure SMTP", "err"); }
            finally { setForgotBusy(false); }
          }}><Mail size={14} /> Send reset link</Btn>
          <p className="text-center font-mono text-[10px] text-faint">Link valid 1 hour · 22:00 lives will still get night Piket</p>
        </div>
      </Sheet>

      <button onClick={onChangelog}
        className="tap mx-auto mt-6 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-widest text-faint hover:text-amber">
        <History size={12} /> v{VERSION} · changelog
      </button>

      </div>
    </div>
  );
}

/* Set a new password after arriving via a Gmail recovery link */
export function RecoveryGate({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <div className="m-auto w-full">
        <div className="card space-y-4 p-5">
          <h1 className="ttl text-xl font-bold text-ink">Set a new password</h1>
          <p className="font-mono text-[11px] text-faint">Your reset link is verified — choose a new password (min 8 chars).</p>
          <Field label="New password">
            <input className="inp w-full" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
          </Field>
          <Field label="Confirm password">
            <input className="inp w-full" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" />
          </Field>
          <Btn className="w-full" busy={busy} onClick={async () => {
            if (pw.length < 8) { toast("Password must be at least 8 characters", "err"); return; }
            if (pw !== pw2) { toast("Passwords do not match", "err"); return; }
            setBusy(true);
            try {
              const { updatePassword } = await import("../lib/production");
              const res = await updatePassword(pw);
              if (!res.ok) throw new Error(res.message);
              toast(res.message, "ok");
              onDone();
            } catch (e) { toast(e instanceof Error ? e.message : "Could not update password", "err"); }
            finally { setBusy(false); }
          }}><KeyRound size={14} /> Update password</Btn>
          <button type="button" onClick={async () => {
            const { signOut } = await import("../lib/production");
            await signOut();
            onDone();
          }} className="tap w-full text-center font-mono text-[11px] text-faint hover:text-ink">Back to login</button>
        </div>
      </div>
    </div>
  );
}
