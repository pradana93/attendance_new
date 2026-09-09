import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !authHeader) return json({ error: "Missing server config" }, 500);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller } } = await adminClient.auth.getUser(token);
  if (!caller) return json({ error: "Auth required" }, 401);
  const { data: callerProfile } = await adminClient.from("profiles").select("workspace_id, role").eq("id", caller.id).maybeSingle();
  if (!callerProfile || callerProfile.role !== "superadmin") return json({ error: "Super Admin only" }, 403);
  const body = await req.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const newPassword = body.newPassword as string | undefined;
  if (!userId || !newPassword || newPassword.length < 8) return json({ error: "userId and 8-char password required" }, 400);
  const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, message: "Password reset. Gmail SMTP will notify if configured." });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
