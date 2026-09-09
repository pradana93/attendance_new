import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !authHeader) return json({ error: "Missing server config" }, 500);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await adminClient.auth.getUser(token);
  if (!user) return json({ error: "Auth required" }, 401);
  const { data: profile } = await adminClient.from("profiles").select("workspace_id, role").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "superadmin") return json({ error: "Super Admin only" }, 403);
  const { data: smtp } = await adminClient.from("smtp_settings").select("*").eq("workspace_id", profile.workspace_id).maybeSingle();
  if (!smtp?.host || !smtp?.user_name || !smtp?.pass_encrypted) return json({ error: "SMTP not configured. Save Host/User/App Password first." }, 400);
  const body = await req.json().catch(() => ({}));
  const to = (body.to ?? smtp.user_name ?? "").trim();
  if (!to || !to.includes("@")) return json({ error: "Valid recipient required" }, 400);
  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port ?? 587,
      secure: (smtp.port ?? 587) === 465,
      auth: { user: smtp.user_name, pass: smtp.pass_encrypted },
    });
    const info = await transporter.sendMail({
      from: smtp.sender || smtp.user_name,
      to,
      subject: "ShiftGate Gmail SMTP test",
      text: `Gmail SMTP is working (${smtp.host}:${smtp.port ?? 587} as ${smtp.user_name}).`,
    });
    return json({ ok: true, message: `Test email sent via Gmail to ${to}.`, messageId: info.messageId ?? null });
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
