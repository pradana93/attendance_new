import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabase, initSupabase } from "./supabase";
import type { Announcement, Attendance, Feedback, Leave, Overtime, PiketAssignment, PiketLog, PiketTask, PointEvent, RedeemItem, Redemption, Role, Settings, SwapOverride, SwapRequest, User } from "../types";
import type { DB } from "../types";

interface ProfileRow {
  id: string;
  workspace_id: string;
  full_name: string;
  email: string;
  role: Role;
  employee_id: string;
  department: string;
  avatar_url: string | null;
  active: boolean;
  points: number;
  notification_approval: boolean;
  face_enrolled?: boolean;
  created_at: string;
}

interface AttendanceRow {
  id: string;
  workspace_id: string;
  user_id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  late: boolean;
  early: boolean;
  in_score: number | null;
  out_score: number | null;
  distance_m: number | null;
  method: Attendance["method"] | null;
  self_report: boolean;
}

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
let runtimeUrl = configuredUrl;
let runtimeKey = configuredKey;

export function productionClient(): SupabaseClient | null {
  if (getSupabase()) return getSupabase();
  if (!runtimeUrl || !runtimeKey) return null;
  return initSupabase(runtimeUrl, runtimeKey) as SupabaseClient;
}

export function hasProductionConfiguration(): boolean {
  return Boolean(runtimeUrl && runtimeKey);
}

export function configureProduction(url: string, key: string): void {
  runtimeUrl = url;
  runtimeKey = key;
  initSupabase(url, key);
}

export async function createWorkspaceAdmin(args: {
  workspaceName: string;
  company: string;
  siteName: string;
  adminName: string;
  email: string;
  password: string;
}): Promise<{ user: User | null; error?: string }> {
  const client = productionClient();
  if (!client) return { user: null, error: "Supabase is not configured for this deployment." };

  let { data: authData, error: authError } = await client.auth.signUp({
    email: args.email,
    password: args.password,
  });
  if (authError || !authData.user) {
    const alreadyRegistered = authError?.message.toLowerCase().includes("already registered") || authError?.message.toLowerCase().includes("already exists");
    if (!alreadyRegistered) return { user: null, error: authError?.message ?? "Could not create administrator." };
    const retry = await client.auth.signInWithPassword({ email: args.email, password: args.password });
    if (retry.error || !retry.data.user) return { user: null, error: retry.error?.message ?? "This administrator account already exists, but the password was not accepted." };
    authData = retry.data;
    authError = null;
  }
  if (!authData.session) return { user: null, error: "Supabase requires email confirmation. Confirm the administrator email, then sign in and run setup again." };
  if (!authData.user) return { user: null, error: "Supabase did not return an administrator user." };
  const authUser = authData.user;

  const { error: bootstrapError } = await client.rpc("bootstrap_workspace", {
    workspace_name: args.workspaceName,
    workspace_company: args.company,
    workspace_site_name: args.siteName,
    administrator_name: args.adminName,
    administrator_email: args.email,
  });
  if (bootstrapError) return { user: null, error: bootstrapError.message };

  return { user: await profileFor(client, authUser) };
}

export async function signIn(email: string, password: string): Promise<{ user: User | null; error?: string }> {
  const client = productionClient();
  if (!client) return { user: null, error: "Supabase is not configured for this deployment." };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { user: null, error: error?.message ?? "Sign-in failed." };
  return { user: await profileFor(client, data.user) };
}

export async function signOut(): Promise<void> {
  await productionClient()?.auth.signOut();
}

export async function createStaffAccount(input: {
  name: string;
  email: string;
  employeeId: string;
  role: "admin" | "staff";
  department: string;
  password: string;
}): Promise<{ ok: boolean; message: string; profile?: User }> {
  const client = productionClient();
  if (!client) return { ok: false, message: "Supabase is not configured for this deployment." };
  const { data, error } = await client.functions.invoke("create-staff", { body: input });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("failed to send a request") || message.includes("edge function")) {
      return { ok: false, message: "The create-staff Edge Function is unavailable. Deploy it to the same Supabase project as this app, then try again." };
    }
    return { ok: false, message: error.message };
  }
  if (data?.error) return { ok: false, message: data.error };
  return { ok: true, message: `${input.name} created.`, profile: data?.profile ? mapProfile(data.profile as ProfileRow) : undefined };
}

export async function workspaceProfiles(): Promise<User[]> {
  const client = productionClient();
  if (!client) return [];
  const { data, error } = await client.from("profiles").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ProfileRow[]).map(mapProfile);
}

async function currentWorkspaceId(client: SupabaseClient): Promise<string | null> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data } = await client.from("profiles").select("workspace_id").eq("id", auth.user.id).maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

export async function workspaceSettings(): Promise<Partial<Settings> | null> {
  const client = productionClient();
  if (!client) return null;
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) return null;
  const [{ data: workspace }, { data: preferences }] = await Promise.all([
    client.from("workspaces").select("name, company, site_name, logo_url, hue, latitude, longitude, geofence_radius, late_time").eq("id", workspaceId).maybeSingle(),
    client.from("workspace_settings").select("language, theme, points_expiry_months, overtime_rate").eq("workspace_id", workspaceId).maybeSingle(),
  ]);
  if (!workspace) return null;
  return {
    appName: workspace.name,
    company: workspace.company,
    siteName: workspace.site_name,
    logo: workspace.logo_url ?? undefined,
    hue: workspace.hue,
    lat: workspace.latitude,
    lng: workspace.longitude,
    radius: workspace.geofence_radius,
    lateTime: workspace.late_time?.slice(0, 5) ?? undefined,
    language: preferences?.language,
    theme: preferences?.theme,
    pointsExpiryMonths: preferences?.points_expiry_months,
    otRate: preferences?.overtime_rate,
  };
}

export async function saveWorkspaceSettings(patch: Partial<Settings>): Promise<void> {
  const client = productionClient();
  if (!client) return;
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) return;
  const workspacePatch: Record<string, unknown> = {};
  if (patch.appName !== undefined) workspacePatch.name = patch.appName;
  if (patch.company !== undefined) workspacePatch.company = patch.company;
  if (patch.siteName !== undefined) workspacePatch.site_name = patch.siteName;
  if (patch.logo !== undefined) workspacePatch.logo_url = patch.logo || null;
  if (patch.hue !== undefined) workspacePatch.hue = patch.hue;
  if (patch.lat !== undefined) workspacePatch.latitude = patch.lat;
  if (patch.lng !== undefined) workspacePatch.longitude = patch.lng;
  if (patch.radius !== undefined) workspacePatch.geofence_radius = patch.radius;
  if (patch.lateTime !== undefined) workspacePatch.late_time = patch.lateTime;
  if (Object.keys(workspacePatch).length) {
    const { error } = await client.from("workspaces").update(workspacePatch).eq("id", workspaceId);
    if (error) throw new Error(error.message);
  }
  const preferencePatch: Record<string, unknown> = {};
  if (patch.language !== undefined) preferencePatch.language = patch.language;
  if (patch.theme !== undefined) preferencePatch.theme = patch.theme;
  if (patch.pointsExpiryMonths !== undefined) preferencePatch.points_expiry_months = patch.pointsExpiryMonths;
  if (patch.otRate !== undefined) preferencePatch.overtime_rate = patch.otRate;
  if (Object.keys(preferencePatch).length) {
    const { error } = await client.from("workspace_settings").update(preferencePatch).eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
  }
}

export async function loadWorkspaceData(): Promise<Partial<DB>> {
  const client = productionClient();
  if (!client) return {};
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) return {};
  const [profiles, attendance, overtime, leaves, announcements, feedback, tasks, assignments, logs, points, items, redemptions, notifications, swaps, overrides] = await Promise.all([
    client.from("profiles").select("*").order("created_at", { ascending: true }),
    client.from("attendance").select("*").order("attendance_date", { ascending: false }),
    client.from("overtime_requests").select("*").order("created_at", { ascending: false }),
    client.from("leave_requests").select("*").order("leave_date", { ascending: false }),
    client.from("announcements").select("*").order("created_at", { ascending: false }),
    client.from("feedback").select("*").order("created_at", { ascending: false }),
    client.from("piket_tasks").select("*").eq("active", true),
    client.from("piket_assignments").select("*"),
    client.from("piket_logs").select("*"),
    client.from("point_events").select("*"),
    client.from("reward_items").select("*").eq("active", true),
    client.from("reward_redemptions").select("*"),
    client.from("notifications").select("*").order("created_at", { ascending: false }),
    client.from("swap_requests").select("*").order("created_at", { ascending: false }),
    client.from("swap_overrides").select("*"),
  ]);
  const firstError = [profiles, attendance, overtime, leaves, announcements, feedback, tasks, assignments, logs, points, items, redemptions, notifications, swaps, overrides].find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message);
  return {
    users: (profiles.data ?? []).map((row) => mapProfile(row as ProfileRow)),
    attendance: (attendance.data ?? []).map((row) => mapAttendance(row as AttendanceRow)),
    ot: (overtime.data ?? []).map(mapOvertime),
    leaves: (leaves.data ?? []).map(mapLeave),
    announcements: (announcements.data ?? []).map(mapAnnouncement),
    feedback: (feedback.data ?? []).map(mapFeedback),
    tasks: (tasks.data ?? []).map(mapTask),
    template: (assignments.data ?? []).map(mapAssignment),
    piketLog: (logs.data ?? []).map(mapPiketLog),
    pointEvents: (points.data ?? []).map(mapPointEvent),
    items: (items.data ?? []).map(mapRewardItem),
    redemptions: (redemptions.data ?? []).map(mapRedemption),
    notifications: (notifications.data ?? []).map(mapNotification),
    swapRequests: (swaps.data ?? []).map(mapSwapRequest),
    swapOverrides: (overrides.data ?? []).map(mapSwapOverride),
  };
}

export async function createSwapRequest(input: { fromUserId: string; toUserId: string; date: string; taskId: string; reason: string }): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) throw new Error("Your workspace profile could not be found.");
  const { error } = await client.from("swap_requests").insert({ workspace_id: workspaceId, from_user_id: input.fromUserId, to_user_id: input.toUserId, work_date: input.date, task_id: input.taskId, reason: input.reason });
  if (error) throw new Error(error.message);
}

export async function decideSwapRequest(id: string, approve: boolean, deciderId: string): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.from("swap_requests").update({ status: approve ? "approved" : "rejected", decided_by: deciderId }).eq("id", id);
  if (error) throw new Error(error.message);
  if (approve) {
    const { data: request } = await client.from("swap_requests").select("workspace_id, work_date, task_id, to_user_id").eq("id", id).single();
    if (request) {
      const { error: overrideError } = await client.from("swap_overrides").upsert({ workspace_id: request.workspace_id, work_date: request.work_date, task_id: request.task_id, user_id: request.to_user_id }, { onConflict: "workspace_id,work_date,task_id" });
      if (overrideError) throw new Error(overrideError.message);
    }
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  const client = productionClient();
  if (!client) return;
  const { error } = await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export function subscribeWorkspaceChanges(onChange: () => void): () => void {
  const client = productionClient();
  if (!client) return () => undefined;
  const channel = client.channel("workspace-live-sync");
  ["profiles", "attendance", "overtime_requests", "leave_requests", "announcements", "feedback", "piket_logs", "point_events", "notifications"].forEach((table) => {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
  });
  channel.subscribe();
  return () => { void client.removeChannel(channel); };
}

export async function completePiketRemote(taskId: string, date: string, proof?: string): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const workspaceId = await currentWorkspaceId(client);
  const { data: auth } = await client.auth.getUser();
  const proofUrl = workspaceId && auth.user ? await uploadEvidence(client, workspaceId, auth.user.id, proof, "piket") : null;
  const { error } = await client.rpc("complete_piket", { p_task_id: taskId, p_work_date: date, p_proof_url: proofUrl });
  if (error) throw new Error(error.message);
}

export async function redeemRewardRemote(itemId: string): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.rpc("redeem_reward", { p_item_id: itemId });
  if (error) throw new Error(error.message);
}

export async function saveTaskRemote(input: { id?: string; name: string; area: string; points: number; requiresProof: boolean; desc: string; icon: PiketTask["icon"]; active: boolean }): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) throw new Error("Your workspace profile could not be found.");
  const row = { workspace_id: workspaceId, name: input.name, area: input.area, points: input.points, requires_proof: input.requiresProof, description: input.desc, icon: input.icon, active: input.active };
  const query = input.id ? client.from("piket_tasks").update(row).eq("id", input.id) : client.from("piket_tasks").insert(row);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteTaskRemote(id: string): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.from("piket_tasks").update({ active: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setAssignmentRemote(taskId: string, weekday: number, userId: string | null): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) throw new Error("Your workspace profile could not be found.");
  const base = client.from("piket_assignments").delete().eq("task_id", taskId).eq("weekday", weekday);
  const { error: deleteError } = await base;
  if (deleteError) throw new Error(deleteError.message);
  if (userId) {
    const { error } = await client.from("piket_assignments").insert({ workspace_id: workspaceId, task_id: taskId, weekday, user_id: userId });
    if (error) throw new Error(error.message);
  }
}

export async function addRewardItemRemote(input: { name: string; cost: number; stock: number; cat: RedeemItem["cat"] }): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) throw new Error("Your workspace profile could not be found.");
  const { error } = await client.from("reward_items").insert({ workspace_id: workspaceId, name: input.name, cost: input.cost, stock: input.stock, category: input.cat, icon: "package" });
  if (error) throw new Error(error.message);
}

export async function rotateTemplateRemote(): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { data, error } = await client.from("piket_assignments").select("id, task_id, weekday, user_id").order("weekday").order("task_id");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; task_id: string; weekday: number; user_id: string }>;
  for (const weekday of [1, 2, 3, 4, 5, 6]) {
    const day = rows.filter((row) => row.weekday === weekday);
    if (day.length < 2) continue;
    const users = [day[day.length - 1].user_id, ...day.slice(0, -1).map((row) => row.user_id)];
    for (let index = 0; index < day.length; index++) {
      const { error: updateError } = await client.from("piket_assignments").update({ user_id: users[index] }).eq("id", day[index].id);
      if (updateError) throw new Error(updateError.message);
    }
  }
}

export async function createOvertimeRequest(input: { userId: string; date: string; start: string; end: string; reason: string; photo?: string }): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) throw new Error("Your workspace profile could not be found.");
  const photoUrl = await uploadEvidence(client, workspaceId, input.userId, input.photo, "overtime");
  const { error } = await client.from("overtime_requests").insert({ workspace_id: workspaceId, user_id: input.userId, request_date: input.date, start_time: input.start, end_time: input.end, reason: input.reason, photo_url: photoUrl });
  if (error) throw new Error(error.message);
}

export async function cancelOvertimeRequest(id: string): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.from("overtime_requests").delete().eq("id", id).eq("status", "pending");
  if (error) throw new Error(error.message);
}

export async function decideOvertimeRequest(input: { id: string; approve: boolean; note: string; deciderId: string }): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.from("overtime_requests").update({ status: input.approve ? "approved" : "rejected", note: input.note || null, decided_by: input.deciderId, decided_at: new Date().toISOString() }).eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function createLeaveRequest(input: { userId: string; date: string; reason: string }): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) throw new Error("Your workspace profile could not be found.");
  const { error } = await client.from("leave_requests").insert({ workspace_id: workspaceId, user_id: input.userId, leave_date: input.date, reason: input.reason });
  if (error) throw new Error(error.message);
}

export async function createFeedback(input: { userId: string; type: Feedback["type"]; priority: Feedback["priority"]; title: string; description: string; screenshot?: string; contactEmail?: string; route?: string }): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) throw new Error("Your workspace profile could not be found.");
  const screenshotUrl = await uploadEvidence(client, workspaceId, input.userId, input.screenshot, "feedback");
  const { error } = await client.from("feedback").insert({ workspace_id: workspaceId, user_id: input.userId, type: input.type, priority: input.priority, title: input.title, description: input.description, screenshot_url: screenshotUrl });
  if (error) throw new Error(error.message);
}

export async function updateFeedbackRemote(id: string, patch: { status?: Feedback["status"]; adminNote?: string; decidedBy?: string }): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.from("feedback").update({ ...(patch.status ? { status: patch.status } : {}), ...(patch.adminNote !== undefined ? { admin_note: patch.adminNote } : {}), ...(patch.decidedBy ? { decided_by: patch.decidedBy } : {}) }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFeedbackRemote(id: string): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.from("feedback").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createAnnouncement(input: { title: string; body: string; authorId: string; pinned: boolean }): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) throw new Error("Your workspace profile could not be found.");
  const { error } = await client.from("announcements").insert({ workspace_id: workspaceId, title: input.title, body: input.body, author_id: input.authorId, pinned: input.pinned });
  if (error) throw new Error(error.message);
}

export async function deleteAnnouncementRemote(id: string): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.from("announcements").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateProfileRemote(input: { id: string; name: string; email: string; employeeId: string; role: Role; department: string }): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.from("profiles").update({ full_name: input.name.trim(), email: input.email.trim().toLowerCase(), employee_id: input.employeeId.trim(), role: input.role, department: input.department.trim() }).eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function setProfileActiveRemote(id: string, active: boolean): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.from("profiles").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setNotificationPreferenceRemote(id: string, enabled: boolean): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.from("profiles").update({ notification_approval: enabled }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function enrollFaceRemote(id: string): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { error } = await client.from("profiles").update({ face_enrolled: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function manualAttendanceRemote(input: { userId: string; date: string; checkIn: string; checkOut?: string; late: boolean }): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const workspaceId = await currentWorkspaceId(client);
  if (!workspaceId) throw new Error("Your workspace profile could not be found.");
  const checkIn = new Date(`${input.date}T${input.checkIn}:00`).toISOString();
  const checkOut = input.checkOut ? new Date(`${input.date}T${input.checkOut}:00`).toISOString() : null;
  const { error } = await client.from("attendance").upsert({ workspace_id: workspaceId, user_id: input.userId, attendance_date: input.date, check_in: checkIn, check_out: checkOut, late: input.late, method: "manual" }, { onConflict: "workspace_id,user_id,attendance_date" });
  if (error) throw new Error(error.message);
}

export async function reviewSelfReportRemote(id: string, approve: boolean): Promise<void> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const query = approve
    ? client.from("attendance").update({ self_report: false }).eq("id", id)
    : client.from("attendance").delete().eq("id", id);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function currentProductionUser(): Promise<User | null> {
  const client = productionClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user ? profileFor(client, data.user) : null;
}

async function profileFor(client: SupabaseClient, authUser: SupabaseUser): Promise<User | null> {
  const { data, error } = await client.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
  if (error || !data) return null;
  return mapProfile(data as ProfileRow);
}

export async function todayAttendance(userId: string, date: string): Promise<Attendance | null> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const { data, error } = await client.from("attendance").select("*").eq("user_id", userId).eq("attendance_date", date).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAttendance(data as AttendanceRow) : null;
}

export async function punchAttendance(args: {
  userId: string;
  date: string;
  kind: "in" | "out";
  late: boolean;
  early: boolean;
  score?: number;
  distance?: number;
  method: "face" | "qr" | "manual";
}): Promise<Attendance> {
  const client = productionClient();
  if (!client) throw new Error("Supabase is not configured for this deployment.");
  const timestamp = new Date().toISOString();
  const existing = await todayAttendance(args.userId, args.date);
  let workspaceId: string | undefined;
  if (!existing) {
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("workspace_id")
      .eq("id", args.userId)
      .maybeSingle();
    if (profileError || !profile?.workspace_id) {
      throw new Error(profileError?.message ?? "Your workspace profile could not be found.");
    }
    workspaceId = profile.workspace_id as string;
  }
  const row = {
    ...(workspaceId ? { workspace_id: workspaceId } : {}),
    user_id: args.userId,
    attendance_date: args.date,
    ...(args.kind === "in" ? { check_in: timestamp, late: args.late, in_score: args.score ?? null, distance_m: args.distance ?? null, method: args.method } : { check_out: timestamp, early: args.early, out_score: args.score ?? null }),
  };
  const query = existing
    ? client.from("attendance").update(row).eq("id", existing.id).select("*").single()
    : client.from("attendance").insert(row as never).select("*").single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return mapAttendance(data as AttendanceRow);
}

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role,
    employeeId: row.employee_id,
    department: row.department,
    avatarHue: 38,
    photo: row.avatar_url ?? undefined,
    faceEnrolled: Boolean(row.face_enrolled),
    points: row.points,
    active: row.active,
    createdAt: row.created_at,
    notifApproval: row.notification_approval,
  };
}

function mapAttendance(row: AttendanceRow): Attendance {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.attendance_date,
    checkIn: row.check_in ?? undefined,
    checkOut: row.check_out ?? undefined,
    late: row.late,
    early: row.early,
    inScore: row.in_score ?? undefined,
    outScore: row.out_score ?? undefined,
    distance: row.distance_m ?? undefined,
    method: row.method ?? undefined,
    selfReport: row.self_report,
  };
}

function mapOvertime(row: Record<string, unknown>): Overtime {
  return {
    id: String(row.id), userId: String(row.user_id), date: String(row.request_date),
    start: String(row.start_time).slice(0, 5), end: String(row.end_time).slice(0, 5),
    reason: String(row.reason), status: row.status as Overtime["status"], note: row.note ? String(row.note) : undefined,
    photo: row.photo_url ? String(row.photo_url) : undefined, createdAt: String(row.created_at),
    decidedAt: row.decided_at ? String(row.decided_at) : undefined,
  };
}

function mapLeave(row: Record<string, unknown>): Leave {
  return { id: String(row.id), userId: String(row.user_id), date: String(row.leave_date), reason: String(row.reason), status: row.status as Leave["status"], createdAt: String(row.created_at) };
}

function mapAnnouncement(row: Record<string, unknown>): Announcement {
  return { id: String(row.id), title: String(row.title), body: String(row.body), author: String(row.author_id), date: String(row.published_date ?? row.created_at), pinned: Boolean(row.pinned) };
}

function mapFeedback(row: Record<string, unknown>): Feedback {
  return {
    id: String(row.id), userId: String(row.user_id), type: row.type as Feedback["type"], priority: row.priority as Feedback["priority"],
    title: String(row.title), description: String(row.description), screenshot: row.screenshot_url ? String(row.screenshot_url) : undefined,
    status: row.status as Feedback["status"], adminNote: row.admin_note ? String(row.admin_note) : undefined,
    createdAt: String(row.created_at), updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    decidedBy: row.decided_by ? String(row.decided_by) : undefined,
  };
}

function mapTask(row: Record<string, unknown>): PiketTask {
  return { id: String(row.id), name: String(row.name), area: String(row.area), points: Number(row.points), requiresProof: Boolean(row.requires_proof), active: Boolean(row.active), icon: row.icon as PiketTask["icon"], desc: String(row.description ?? "") };
}

function mapAssignment(row: Record<string, unknown>): PiketAssignment {
  return { id: String(row.id), taskId: String(row.task_id), day: Number(row.weekday), userId: String(row.user_id) };
}

function mapPiketLog(row: Record<string, unknown>): PiketLog {
  return { id: String(row.id), date: String(row.work_date), taskId: String(row.task_id), userId: String(row.user_id), doneAt: String(row.completed_at), proof: row.proof_url ? String(row.proof_url) : undefined, points: Number(row.points) };
}

function mapPointEvent(row: Record<string, unknown>): PointEvent {
  return { id: String(row.id), userId: String(row.user_id), date: String(row.event_date), delta: Number(row.delta), label: String(row.label) };
}

function mapRewardItem(row: Record<string, unknown>): RedeemItem {
  return { id: String(row.id), name: String(row.name), cost: Number(row.cost), stock: Number(row.stock), icon: row.icon as RedeemItem["icon"], cat: row.category as RedeemItem["cat"] };
}

function mapRedemption(row: Record<string, unknown>): Redemption {
  return { id: String(row.id), userId: String(row.user_id), itemId: String(row.item_id), date: String(row.redeemed_date), cost: Number(row.cost) };
}

function mapNotification(row: Record<string, unknown>) {
  return { id: String(row.id), userId: row.user_id ? String(row.user_id) : "*", title: String(row.title), body: String(row.body), date: String(row.created_at), readBy: row.read_at ? [String(row.user_id ?? "")] : [] };
}

function mapSwapRequest(row: Record<string, unknown>): SwapRequest {
  return { id: String(row.id), date: String(row.work_date), taskId: String(row.task_id), fromUserId: String(row.from_user_id), toUserId: String(row.to_user_id), reason: String(row.reason), status: row.status as SwapRequest["status"], createdAt: String(row.created_at), decidedBy: row.decided_by ? String(row.decided_by) : undefined };
}

function mapSwapOverride(row: Record<string, unknown>): SwapOverride {
  return { id: String(row.id), date: String(row.work_date), taskId: String(row.task_id), userId: String(row.user_id) };
}

async function uploadEvidence(client: SupabaseClient, workspaceId: string, userId: string, dataUrl: string | undefined, kind: string): Promise<string | null> {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith("data:")) return dataUrl;
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const path = `${workspaceId}/${userId}/${kind}-${crypto.randomUUID()}.jpg`;
  const { error } = await client.storage.from("evidence").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw new Error(`Evidence upload failed: ${error.message}`);
  const { data } = client.storage.from("evidence").getPublicUrl(path);
  return data.publicUrl;
}
