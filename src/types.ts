/** Domain types — mirrors the SQL schema (users, attendance, schedules, overtime, …). */

export type Role = "superadmin" | "admin" | "staff";
export type ShiftTone = "morning" | "afternoon" | "night";
export type PunchMethod = "face" | "qr" | "manual";

export interface Shift {
  id: string;
  name: string;
  window: string; // "06:00 – 14:00"
  start: string;
  end: string;
  points: number;
  tone: ShiftTone;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // demo only — in production: Supabase Auth + bcrypt
  role: Role;
  employeeId: string;
  department: string;
  hue: number; // generated avatar color
  faceEnrolled: boolean;
  faceHash: string; // stand-in for encrypted 128-d face descriptor
  active: boolean;
  joinedAt: string;
  points: number;
}

export interface Attendance {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  checkIn?: string; // ISO
  checkOut?: string;
  inScore?: number; // face match %
  outScore?: number;
  distance: number; // meters from gate beacon
  method: PunchMethod;
  selfReport?: boolean;
  reviewed?: boolean;
  late: boolean;
  earlyOut: boolean;
}

export interface ScheduleEntry {
  id: string;
  userId: string;
  date: string;
  shiftId: string;
  done: boolean;
  proof: boolean; // duty completion photo uploaded
}

export interface PointEvent {
  id: string;
  userId: string;
  delta: number;
  date: string;
  label: string;
}

export interface OTReq {
  id: string;
  userId: string;
  date: string;
  start: string; // "17:00"
  end: string;
  reason: string;
  photo: boolean;
  status: "pending" | "approved" | "rejected";
  note?: string;
  by?: string;
  createdAt: string;
}

export interface LeaveReq {
  id: string;
  userId: string;
  from: string;
  to: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface RedeemItem {
  id: string;
  name: string;
  cost: number;
  stock: number;
  cat: "Essentials" | "Voucher" | "Gear";
  icon: string;
}

export interface Redemption {
  id: string;
  userId: string;
  itemId: string;
  cost: number;
  date: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  author: string;
  date: string;
  pinned: boolean;
}

export interface Noti {
  id: string;
  to: string; // userId or "all"
  text: string;
  date: string;
  readBy: string[];
  kind: "ok" | "warn" | "info";
}

export interface Settings {
  appName: string;
  company: string;
  logo?: string; // dataURL
  hue: number;
  siteName: string;
  lat: number;
  lng: number;
  radius: number; // geofence meters
  lateTime: string; // "08:00"
  pointsExpiryMonths: number;
  theme: "dark" | "light";
}

export interface DB {
  v: number;
  users: User[];
  shifts: Shift[];
  attendance: Attendance[];
  schedules: ScheduleEntry[];
  pointEvents: PointEvent[];
  ot: OTReq[];
  leaves: LeaveReq[];
  items: RedeemItem[];
  redemptions: Redemption[];
  announcements: Announcement[];
  notis: Noti[];
  settings: Settings;
}
