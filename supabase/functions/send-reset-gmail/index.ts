import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

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
  if (!profile) return json({ error: "Email not found. Enter the email you use to sign in (your account email)." }, 404);
  const { data: smtp } = await adminClient.from("smtp_settings").select("*").eq("workspace_id", profile.workspace_id).maybeSingle();
  if (!smtp?.host || !smtp?.user_name || !smtp?.pass_encrypted) return json({ error: "Gmail SMTP not configured by Super Admin" }, 400);

  // Generate reset link via Supabase Auth (generates only, does not send email itself)
  const { data: linkData, error: resetError } = await adminClient.auth.admin.generateLink({ type: "recovery", email });
  if (resetError) return json({ error: resetError.message }, 400);
  const actionLink = (linkData as { properties?: { action_link?: string } } | null)?.properties?.action_link;
  if (!actionLink) return json({ error: "Could not generate reset link" }, 500);

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port ?? 587,
      secure: (smtp.port ?? 587) === 465,
      auth: { user: smtp.user_name, pass: smtp.pass_encrypted },
    });
    await transporter.sendMail({
      from: smtp.sender || smtp.user_name,
      to: email,
      subject: "Reset your ShiftGate password",
      text: `Reset your password with this link (valid 1 hour): ${actionLink}`,
      html: `<p>Reset your password with this link (valid 1 hour):</p><p><a href="${actionLink}">Reset password</a></p>`,
    });
    return json({ ok: true, message: `Reset link sent via Gmail to ${email}. Check inbox.` });
  } catch (e) {
    return json({ error: e instanceof Error ? `Gmail send failed: ${e.message}` : "Gmail send failed" }, 502);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
