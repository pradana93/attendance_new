import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabase, initSupabase } from "./supabase";
import type { Attendance, Role, User } from "../types";

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
  const row = {
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
    faceEnrolled: false,
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
