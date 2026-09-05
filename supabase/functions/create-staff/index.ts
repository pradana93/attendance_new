import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RequestBody {
  name: string;
  email: string;
  employeeId: string;
  role: "admin" | "staff";
  department: string;
  password: string;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !authHeader) return json({ error: "Missing server configuration" }, 500);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const accessToken = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: callerError } = await adminClient.auth.getUser(accessToken);
  if (callerError || !caller) return json({ error: "Authentication required" }, 401);

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("workspace_id, role, active")
    .eq("id", caller.id)
    .maybeSingle();
  if (profileError || !callerProfile?.active || !["admin", "superadmin"].includes(callerProfile.role)) {
    return json({ error: "Administrator access required" }, 403);
  }

  let body: RequestBody;
  try { body = await request.json(); } catch { return json({ error: "Invalid request body" }, 400); }
  if (!body.name?.trim() || !body.email?.includes("@") || !body.password || body.password.length < 8) {
    return json({ error: "Name, valid email, and an 8-character password are required" }, 400);
  }
  if (body.role === "admin" && callerProfile.role !== "superadmin") return json({ error: "Only Super Admin can create admins" }, 403);

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: body.email.trim().toLowerCase(),
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.name.trim() },
  });
  if (createError || !created.user) return json({ error: createError?.message ?? "Could not create Auth user" }, 400);

  const { data: profile, error: insertError } = await adminClient.from("profiles").insert({
    id: created.user.id,
    workspace_id: callerProfile.workspace_id,
    full_name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    role: body.role,
    employee_id: body.employeeId.trim(),
    department: body.department.trim(),
  }).select("*").single();

  if (insertError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: insertError.message }, 400);
  }
  return json({ profile });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
