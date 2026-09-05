import { useEffect, useRef, useState } from "react";
import { Boxes, ChevronLeft, ChevronRight, Database, Fingerprint, Loader2, MapPin, ShieldCheck, Upload } from "lucide-react";
import { completeSetup } from "../lib/store";
import { Btn, Field, toast } from "../components/ui";
import { locateWithFallback, wait } from "../lib/util";

const STEPS = ["Workspace", "Site & geofence", "Admin account", "Initialize"];
const HUES = [38, 16, 160, 210, 280, 96, 340, 48];

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  // workspace
  const [appName, setAppName] = useState("ShiftGate");
  const [company, setCompany] = useState("");
  const [hue, setHue] = useState(38);
  const [logo, setLogo] = useState<string | undefined>();
  // site
  const [siteName, setSiteName] = useState("DC-01 · Jakarta");
  const [lat, setLat] = useState(-6.1053);
  const [lng, setLng] = useState(106.9372);
  const [radius, setRadius] = useState(120);
  const [locating, setLocating] = useState(false);
  // admin
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [adminPw2, setAdminPw2] = useState("");
  const [err, setErr] = useState("");
  // init
  const [initStep, setInitStep] = useState(-1);
  const fileRef = useRef<HTMLInputElement>(null);

  const next = () => {
    if (step === 2) {
      if (!adminName.trim() || !adminEmail.includes("@") || adminPw.length < 6) {
        setErr("Name, valid email and a 6+ char password are required.");
        return;
      }
      if (adminPw !== adminPw2) { setErr("Passwords do not match."); return; }
      setErr("");
    }
    setDir(1);
    setStep((s) => s + 1);
  };
  const back = () => { setDir(-1); setStep((s) => Math.max(0, s - 1)); };

  // Runs exactly once when the wizard reaches the init screen.
  // Deps are intentionally just [step]: including initStep here would cancel
  // the running loop on its own first state update and freeze the sequence.
  const startedRef = useRef(false);
  useEffect(() => {
    if (step !== 3 || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    let finished = false;
    (async () => {
      try {
        const phases = ["Preparing workspace settings…", "Validating administrator account…", "Creating empty workspace…", "Saving geofence settings…", "Workspace ready…"];
        for (let i = 0; i < phases.length; i++) {
          if (cancelled) return;
          setInitStep(i);
          await wait(620);
        }
        if (cancelled) return;
        completeSetup({ appName: appName.trim(), company: company.trim(), logo, hue, siteName: siteName.trim(), lat, lng, radius, adminName: adminName.trim(), adminEmail: adminEmail.trim(), adminPassword: adminPw });
        finished = true;
        toast("Workspace initialized — sign in with your admin account", "ok");
      } catch {
        startedRef.current = false;
        toast("Initialization failed — please retry", "err");
      }
    })();
    return () => {
      cancelled = true;
      if (!finished) { startedRef.current = false; setInitStep(-1); }
    };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const useGps = async () => {
    setLocating(true);
    const pos = await locateWithFallback({ lat, lng });
    setLat(Math.round(pos.lat * 10000) / 10000);
    setLng(Math.round(pos.lng * 10000) / 10000);
    setLocating(false);
    toast(pos.simulated ? "GPS unavailable — using site beacon coordinates" : "Coordinates captured from device GPS", "info");
  };

  const onLogo = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setLogo(String(r.result));
    r.readAsDataURL(f);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-10">
      {/* brand */}
      <div className="a-drop mb-7 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-line" style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${hue + 30} 65% 30%))` }}>
          {logo ? <img src={logo} alt="logo" className="h-full w-full object-cover" /> : <Boxes size={22} className="text-white" />}
        </div>
        <div>
          <p className="ttl text-xl font-bold leading-none text-ink">{appName || "ShiftGate"}</p>
          <p className="mt-1 font-mono text-[10.5px] uppercase tracking-widest text-faint">First-run setup</p>
        </div>
      </div>

      {/* progress */}
      <div className="mb-6 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-amber" : "bg-line"}`} />
            <p className={`ttl mt-1.5 text-[10px] font-bold ${i === step ? "text-amber" : "text-faint"}`}>{s}</p>
          </div>
        ))}
      </div>

      <div key={step} className={dir > 0 ? "a-rise flex-1" : "a-fadein flex-1"}>
        {step === 0 && (
          <div className="space-y-4">
            <Field label="App name">
              <input className="inp" value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="ShiftGate" />
            </Field>
            <Field label="Company">
              <input className="inp" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your company name" />
            </Field>
            <Field label="Brand color">
              <div className="flex flex-wrap gap-2.5">
                {HUES.map((h) => (
                  <button key={h} onClick={() => setHue(h)}
                    className={`tap h-9 w-9 rounded-full border-2 transition-transform ${hue === h ? "scale-110 border-ink" : "border-transparent"}`}
                    style={{ background: `linear-gradient(135deg, hsl(${h} 70% 48%), hsl(${h + 30} 65% 32%))` }} aria-label={`hue ${h}`} />
                ))}
              </div>
            </Field>
            <Field label="Logo (optional)">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()}
                className="tap flex w-full items-center gap-3 rounded-xl border border-dashed border-line bg-panel2 px-4 py-3.5 text-left hover:border-amber/60">
                {logo ? <img src={logo} alt="logo" className="h-9 w-9 rounded-lg object-cover" /> : <Upload size={17} className="text-faint" />}
                <span className="text-[13px] text-mut">{logo ? "Tap to replace logo" : "Upload PNG / JPG — stored locally"}</span>
              </button>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {/* radar visual */}
            <div className="card relative mx-auto flex h-44 w-full items-center justify-center overflow-hidden">
              <svg viewBox="0 0 200 120" className="absolute inset-0 h-full w-full opacity-70">
                {[18, 34, 50].map((r) => <circle key={r} cx="100" cy="60" r={r} fill="none" stroke="var(--line)" strokeDasharray="3 4" />)}
                <circle cx="100" cy="60" r={radius / 8} fill="var(--amber)" opacity="0.08" />
                <circle cx="100" cy="60" r={radius / 8} fill="none" stroke="var(--amber)" strokeWidth="1.4" />
                <circle cx="100" cy="60" r="4" fill="var(--amber)" />
                <g style={{ transformOrigin: "100px 60px", animation: "spinSlow 5s linear infinite" }}>
                  <line x1="100" y1="60" x2="100" y2="8" stroke="var(--amber)" strokeWidth="1.2" opacity="0.6" />
                </g>
                <circle cx="128" cy="44" r="3" fill="var(--ok)"><animate attributeName="opacity" values="1;.3;1" dur="1.8s" repeatCount="indefinite" /></circle>
                <circle cx="78" cy="78" r="3" fill="var(--ok)"><animate attributeName="opacity" values=".3;1;.3" dur="2.2s" repeatCount="indefinite" /></circle>
              </svg>
              <p className="relative z-10 mt-24 font-mono text-[10.5px] text-mut">{lat.toFixed(4)}, {lng.toFixed(4)} · r={radius}m</p>
            </div>
            <Field label="Warehouse / site name">
              <input className="inp" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude"><input className="inp font-mono" type="number" step="0.0001" value={lat} onChange={(e) => setLat(Number(e.target.value))} /></Field>
              <Field label="Longitude"><input className="inp font-mono" type="number" step="0.0001" value={lng} onChange={(e) => setLng(Number(e.target.value))} /></Field>
            </div>
            <Btn variant="ghost" className="w-full" onClick={useGps} busy={locating}>
              <MapPin size={15} /> {locating ? "Acquiring GPS…" : "Capture device GPS"}
            </Btn>
            <Field label={`Geofence radius — ${radius} m`} hint="Check-in is only accepted inside this radius from the gate beacon.">
              <input type="range" min={50} max={500} step={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[var(--amber)]" />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="card2 flex items-center gap-2.5 px-3.5 py-3">
              <ShieldCheck size={16} className="shrink-0 text-amber" />
              <p className="text-[12px] leading-relaxed text-mut">This creates the <span className="font-semibold text-ink">Super Admin</span> — full access, can create admins & staff.</p>
            </div>
            <Field label="Full name"><input className="inp" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Ratna Maharani" /></Field>
            <Field label="Email"><input className="inp" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="ratna@nusalogistik.id" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Password"><input className="inp" type="password" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} placeholder="min. 6 chars" /></Field>
              <Field label="Confirm"><input className="inp" type="password" value={adminPw2} onChange={(e) => setAdminPw2(e.target.value)} /></Field>
            </div>
            {err && <p className="a-shake rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-[12.5px] text-bad">{err}</p>}
            <div className="card2 flex items-center gap-2.5 px-3.5 py-3">
              <Fingerprint size={16} className="shrink-0 text-cool" />
              <p className="text-[12px] leading-relaxed text-mut">Your workspace starts empty. Add staff accounts after setup, then configure the live Supabase data layer.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card flex flex-col items-center px-6 py-9">
            <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-amber/40" style={{ animation: "spinSlow 9s linear infinite" }} />
              <Database size={26} className="a-floaty text-amber" />
            </div>
            <p className="ttl text-lg font-bold text-ink">Initializing database</p>
            <ul className="mt-5 w-full space-y-2.5">
              {["Create workspace settings", "Save attendance and scheduling configuration", "Create administrator account", "Configure geofence and verification"].map((t, i) => (
                <li key={t} className="flex items-center gap-2.5 text-[13px]">
                  {initStep > i ? <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-ok/20 text-ok">✓</span>
                    : initStep === i ? <Loader2 size={15} className="animate-spin text-amber" />
                    : <span className="h-[15px] w-[15px] rounded-full border border-line" />}
                  <span className={initStep >= i ? "text-ink" : "text-faint"}>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 font-mono text-[10.5px] uppercase tracking-widest text-faint">Supabase sync available post-deploy</p>
          </div>
        )}
      </div>

      {step < 3 && (
        <div className="mt-7 flex gap-3">
          {step > 0 && <Btn variant="ghost" onClick={back} className="px-3.5"><ChevronLeft size={16} /></Btn>}
          <Btn onClick={next} className="flex-1">
            {step === 2 ? "Create admin & initialize" : "Continue"} <ChevronRight size={16} />
          </Btn>
        </div>
      )}
    </div>
  );
}
