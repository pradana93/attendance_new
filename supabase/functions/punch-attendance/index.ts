import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function haversineM(lat1:number, lon1:number, lat2:number, lon2:number){
  const R=6371000, toRad=(d:number)=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

Deno.serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response("ok", {headers: corsHeaders});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const supabaseUrl=Deno.env.get("SUPABASE_URL");
  const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader=req.headers.get("Authorization");
  if(!supabaseUrl||!serviceRoleKey||!authHeader) return json({error:"Missing server config"},500);
  const adminClient=createClient(supabaseUrl, serviceRoleKey, {auth:{autoRefreshToken:false,persistSession:false}});
  const token=authHeader.replace("Bearer ","");
  const {data:{user}} = await adminClient.auth.getUser(token);
  if(!user) return json({error:"Auth required"},401);
  const body=await req.json().catch(()=>({}));
  const { userId, date, kind, lat, lng, simulated, score, method } = body;
  if(userId!==user.id) return json({error:"userId must match auth user"},403);
  if(simulated) return json({error:"Simulated location blocked"},400);
  if(kind!=="in" && kind!=="out") return json({error:"kind must be in/out"},400);
  // Load workspace and geofence
  const {data: profile} = await adminClient.from("profiles").select("workspace_id, face_enrolled").eq("id", userId).maybeSingle();
  if(!profile?.workspace_id) return json({error:"Profile not found"},404);
  if(!profile.face_enrolled) return json({error:"Face not enrolled"},400);
  const {data: ws} = await adminClient.from("workspaces").select("latitude, longitude, geofence_radius").eq("id", profile.workspace_id).maybeSingle();
  if(!ws) return json({error:"Workspace not found"},404);
  if(typeof lat!=="number" || typeof lng!=="number") return json({error:"lat/lng required"},400);
  const dist=haversineM(lat, lng, ws.latitude, ws.longitude);
  if(dist > ws.geofence_radius) return json({error:`Outside geofence ${Math.round(dist)}m > ${ws.geofence_radius}m`},400);
  // Insert via service_role (bypass RLS but validated)
  const {data: existing} = await adminClient.from("attendance").select("id").eq("user_id", userId).eq("attendance_date", date).maybeSingle();
  const timestamp=new Date().toISOString();
  const row:any={ user_id: userId, attendance_date: date, workspace_id: profile.workspace_id };
  if(kind==="in"){ row.check_in=timestamp; row.in_score=score??null; row.distance_m=Math.round(dist); row.method=method; }
  else { row.check_out=timestamp; row.out_score=score??null; }
  let result;
  if(existing){ const {data, error}=await adminClient.from("attendance").update(row).eq("id", existing.id).select("*").single(); if(error) return json({error:error.message},400); result=data; }
  else { const {data, error}=await adminClient.from("attendance").insert(row as never).select("*").single(); if(error) return json({error:error.message},400); result=data; }
  return json({ ok:true, attendance: result, distance: Math.round(dist) });
});

function json(body:unknown,status=200){ return new Response(JSON.stringify(body), {status, headers:{...corsHeaders,"Content-Type":"application/json"}}); }
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
