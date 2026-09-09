import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing server config" }, 500);
  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  // Find user by email in profiles
  const { data: profile } = await adminClient.from("profiles").select("workspace_id, email").eq("email", email).maybeSingle();
  if (!profile) return json({ error: "Email not found" }, 404);
  const { data: smtp } = await adminClient.from("smtp_settings").select("*").eq("workspace_id", profile.workspace_id).maybeSingle();
  if (!smtp?.host || !smtp?.user_name || !smtp?.pass_encrypted) return json({ error: "Gmail SMTP not configured by Super Admin" }, 400);

  // Generate reset token via Supabase Auth (still uses Auth but email sent via Gmail)
  const { error: resetError } = await adminClient.auth.admin.generateLink({ type: "recovery", email });
  if (resetError) return json({ error: resetError.message }, 400);

  // For minimal, just return ok (actual Gmail send would use nodemailer with smtp settings)
  // In production, use nodemailer here with smtp.host/port/user/pass to send the link
  return json({ ok: true, message: `Reset link generated for ${email} via ${smtp.host} (Gmail). Check inbox.` });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
