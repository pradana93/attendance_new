import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Boxes, CheckCircle2, History, KeyRound, LogIn, Mail, Send } from "lucide-react";
import { login, requestReset, resetPassword, getDB, SUPER_EMAIL, SUPER_PASSWORD, SMTP_RELAY } from "../lib/store";
import { Btn, Chip, Field, Sheet, toast } from "../components/ui";
import { useT } from "../lib/i18n";
import { VERSION } from "../lib/changelog";
import type { User } from "../types";

const DEMO = [
  { label: "Admin", email: "rina@nusalogistik.id", pw: "shift123" },
  { label: "Staff", email: "agus@nusalogistik.id", pw: "shift123" },
];

const SMTP_STEPS = [
  "AUTH LOGIN · OAuth2 token acquired",
  "MAIL FROM:<no-reply@shiftgate.app>",
  "RCPT TO:<{email}>",
  "DATA · 250 OK — message queued",
];

export default function Login({ onLogin, onChangelog }: { onLogin: (u: User) => void; onChangelog: () => void }) {
  const db = getDB();
  const t = useT();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);

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
          <button type="button" onClick={() => setForgotOpen(true)}
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
          <button
            onClick={() => { setEmail(SUPER_EMAIL); setPw(SUPER_PASSWORD); setErr(""); }}
            className="tap col-span-2 rounded-xl border border-amber/40 bg-amber/8 px-3 py-2.5 text-left hover:bg-amber/14">
            <div className="flex items-center justify-between">
              <p className="ttl text-[13px] font-bold text-amber">Super Admin</p>
              <Chip tone="amber">permanent</Chip>
            </div>
            <p className="mt-0.5 truncate font-mono text-[10.5px] text-mut">{SUPER_EMAIL} / {SUPER_PASSWORD}</p>
          </button>
          {DEMO.map((d) => (
            <button key={d.label}
              onClick={() => { setEmail(d.email); setPw(d.pw); setErr(""); }}
              className="tap rounded-xl border border-line bg-panel px-3 py-2.5 text-left hover:border-amber/50">
              <p className="ttl text-[13px] font-bold text-ink">{d.label}</p>
              <p className="mt-0.5 truncate font-mono text-[10.5px] text-faint">{d.email} / {d.pw}</p>
            </button>
          ))}
        </div>
      </div>

      <button onClick={onChangelog}
        className="tap mx-auto mt-6 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-widest text-faint hover:text-amber">
        <History size={12} /> v{VERSION} · changelog
      </button>

      </div>
      <ForgotSheet open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}

/* =============== forgot password — Gmail SMTP flow =============== */
function ForgotSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [stage, setStage] = useState<"email" | "sending" | "sent" | "setpw" | "done">("email");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sentTo, setSentTo] = useState<{ name: string; token: string } | null>(null);
  const [lines, setLines] = useState<number>(0);
  const [npw, setNpw] = useState("");
  const [npw2, setNpw2] = useState("");
  const timer = useRef<number[]>([]);

  useEffect(() => {
    if (open) { setStage("email"); setEmail(""); setErr(""); setSentTo(null); setLines(0); setNpw(""); setNpw2(""); }
    return () => { timer.current.forEach(clearTimeout); timer.current = []; };
  }, [open]);

  const send = () => {
    const res = requestReset(email);
    if (!res.ok) { setErr(res.msg); return; }
    setErr("");
    setStage("sending");
    setLines(0);
    SMTP_STEPS.forEach((_, i) => {
      timer.current.push(window.setTimeout(() => setLines(i + 1), 420 * (i + 1)));
    });
    timer.current.push(window.setTimeout(() => {
      setSentTo({ name: res.name ?? "", token: res.token ?? "" });
      setStage("sent");
    }, 420 * SMTP_STEPS.length + 500));
  };

  const saveNew = () => {
    if (npw.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (npw !== npw2) { setErr("Passwords do not match."); return; }
    const res = resetPassword(email, npw);
    if (!res.ok) { setErr(res.msg); return; }
    setErr("");
    setStage("done");
    timer.current.push(window.setTimeout(() => { onClose(); toast(res.msg, "ok"); }, 1400));
  };

  return (
    <Sheet open={open} onClose={onClose} title={stage === "setpw" ? "Set new password" : stage === "done" ? "Password updated" : "Reset password"}>
      {stage === "email" && (
        <div className="space-y-4">
          <div className="card2 flex items-start gap-3 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber/12 text-amber"><Mail size={17} /></span>
            <p className="text-[12.5px] leading-relaxed text-mut">
              We will send a reset link to your account email via the Gmail SMTP relay
              <span className="font-mono text-[11px] text-faint"> ({SMTP_RELAY.host}:{SMTP_RELAY.port} · {SMTP_RELAY.security})</span>. The link is valid for 30 minutes.
            </p>
          </div>
          <Field label={t("a.email")}>
            <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@nusalogistik.id" />
          </Field>
          {err && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{err}</p>}
          <Btn className="w-full" onClick={send} disabled={!email.includes("@")}><Send size={15} /> Send reset link</Btn>
        </div>
      )}

      {stage === "sending" && (
        <div className="space-y-3 py-2">
          <p className="ttl text-center text-[13px] font-bold text-mut">Delivering via {SMTP_RELAY.host}…</p>
          <div className="card2 space-y-2 p-3.5 font-mono text-[11px]">
            {SMTP_STEPS.map((s, i) => (
              <p key={s} className={`flex items-center gap-2 ${i < lines ? "text-ok" : "text-faint"}`}>
                {i < lines ? <CheckCircle2 size={12} /> : <span className="inline-block h-3 w-3 animate-spin rounded-full border border-faint border-t-transparent" />}
                {s.replace("{email}", email)}
              </p>
            ))}
          </div>
        </div>
      )}

      {stage === "sent" && sentTo && (
        <div className="space-y-4">
          <div className="a-pop rounded-xl border border-ok/30 bg-ok/8 p-4 text-center">
            <CheckCircle2 size={30} className="mx-auto text-ok" />
            <p className="ttl mt-2 text-[15px] font-bold text-ink">Reset link sent</p>
            <p className="mt-1 text-[12.5px] text-mut">Check the inbox of <span className="font-mono text-[11.5px] text-ink">{email}</span> — the link expires in 30 minutes.</p>
          </div>
          <div className="card2 p-3.5">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-faint">Demo inbox preview</p>
            <div className="rounded-lg border border-line bg-panel p-3">
              <p className="text-[12.5px] font-semibold text-ink">ShiftGate — reset your password</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-mut">Hi {sentTo.name.split(" ")[0]}, use the link below to choose a new password. If this wasn't you, ignore this email.</p>
              <button onClick={() => setStage("setpw")}
                className="tap mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber px-3 py-2 text-[12.5px] font-bold text-[#191203] hover:brightness-110">
                Open reset link <ArrowRight size={13} />
              </button>
              <p className="mt-2 truncate text-center font-mono text-[9.5px] text-faint">…/auth/reset?token={sentTo.token.slice(0, 14)}…</p>
            </div>
          </div>
          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-faint">in production this step happens in the recipient's inbox</p>
        </div>
      )}

      {stage === "setpw" && (
        <div className="space-y-4">
          <Field label="New password"><input className="inp" type="password" value={npw} onChange={(e) => setNpw(e.target.value)} placeholder="min. 6 characters" /></Field>
          <Field label="Repeat password"><input className="inp" type="password" value={npw2} onChange={(e) => setNpw2(e.target.value)} placeholder="••••••••" /></Field>
          {err && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{err}</p>}
          <Btn className="w-full" onClick={saveNew}><ArrowLeft size={14} className="rotate-180" /> Update password</Btn>
        </div>
      )}

      {stage === "done" && (
        <div className="a-pop py-6 text-center">
          <CheckCircle2 size={40} className="mx-auto text-ok" />
          <p className="ttl mt-3 text-lg font-bold text-ink">Password updated</p>
          <p className="mt-1 text-[12.5px] text-mut">Sign in with your new password.</p>
        </div>
      )}
    </Sheet>
  );
}
