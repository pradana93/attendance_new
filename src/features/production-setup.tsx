import { useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Cloud, ExternalLink, KeyRound, Link2, RefreshCw } from "lucide-react";
import { testSupabaseConnection } from "../lib/supabase";
import { configureProduction, productionClient } from "../lib/production";
import { Btn, Field, toast } from "../components/ui";

export default function ProductionSetup({ onReady }: { onReady: () => void }) {
  const [url, setUrl] = useState(import.meta.env.VITE_SUPABASE_URL ?? "");
  const [key, setKey] = useState(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "");
  const [testing, setTesting] = useState(false);
  const [schemaReady, setSchemaReady] = useState(false);
  const [error, setError] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  const test = async () => {
    setTesting(true);
    setError("");
    const result = await testSupabaseConnection(url.trim(), key.trim());
    setTesting(false);
    setSchemaReady(result.schemaReady);
    if (!result.success) {
      setError(result.error ?? "Could not reach Supabase.");
      return;
    }
    if (!result.schemaReady) {
      setError("Project reached, but the production schema is not installed yet.");
      return;
    }
    configureProduction(url.trim(), key.trim());
    toast("Supabase production schema is ready", "ok");
  };

  const continueToLogin = () => {
    if (!schemaReady || !productionClient()) return;
    onReady();
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-8">
      <div className="a-drop mb-6 flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber text-[#191203]"><Cloud size={23} /></span>
        <div>
          <p className="ttl text-2xl font-bold text-ink">Production setup</p>
          <p className="mt-1 text-[13px] leading-relaxed text-mut">Connect this deployment to Supabase before anyone can sign in.</p>
        </div>
      </div>

      <section className="card space-y-4 p-5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-faint"><Link2 size={13} className="text-cool" /> 01 · project connection</div>
        <Field label="Project URL"><input className="inp font-mono" value={url} onChange={(e) => { setUrl(e.target.value); setSchemaReady(false); }} placeholder="https://your-project.supabase.co" /></Field>
        <Field label="Public anon key"><input className="inp font-mono" type="password" value={key} onChange={(e) => { setKey(e.target.value); setSchemaReady(false); }} placeholder="eyJhbGciOiJIUzI1NiIs…" /></Field>
        {error && <p className="rounded-lg border border-amber/30 bg-amber/8 px-3 py-2 text-[12px] leading-relaxed text-mut">{error}</p>}
        <Btn variant="ghost" className="w-full" busy={testing} disabled={!url || !key} onClick={test}><RefreshCw size={15} /> Test project and schema</Btn>
        <Btn className="w-full" disabled={!schemaReady} onClick={continueToLogin}><ArrowRight size={15} /> Continue to sign in</Btn>
      </section>

      <button onClick={() => setGuideOpen((open) => !open)} className="tap mt-4 flex w-full items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-left hover:border-cool/50">
        <BookOpen size={16} className="text-cool" />
        <span className="flex-1"><span className="block text-[13px] font-semibold text-ink">Installation guide</span><span className="font-mono text-[10.5px] text-faint">Supabase project checklist</span></span>
        <ExternalLink size={14} className="text-faint" />
      </button>

      {guideOpen && <section className="a-fadein card mt-3 space-y-3 p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-ink"><KeyRound size={15} className="text-amber" /> Before connecting</p>
        <ol className="space-y-2.5 text-[12px] leading-relaxed text-mut">
          <li><span className="font-mono text-amber">01</span> Create a Supabase project and copy the Project URL plus the public anon key.</li>
          <li><span className="font-mono text-amber">02</span> Open <strong className="text-ink">SQL Editor</strong> and run <span className="font-mono text-ink">supabase/migrations/001_production_foundation.sql</span>.</li>
          <li><span className="font-mono text-amber">03</span> In Authentication, create the first administrator user using the email/password you want to use for this app.</li>
          <li><span className="font-mono text-amber">04</span> Create that user&apos;s profile row in <span className="font-mono text-ink">public.profiles</span> using the Auth user UUID, then test this screen again.</li>
        </ol>
        <p className="flex items-start gap-2 border-t border-line2 pt-3 font-mono text-[10.5px] leading-relaxed text-faint"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-ok" /> Never paste a service-role key into this browser app. Only the public anon key belongs here.</p>
      </section>}
    </main>
  );
}
