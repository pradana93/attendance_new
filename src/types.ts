export type Role = "superadmin" | "admin" | "staff";
export type Lang = "en" | "id";
export type Tone = "morning" | "afternoon" | "night";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // demo only — in production Supabase Auth handles credentials
  role: Role;
  employeeId: string;
  department: string;
  avatarHue: number;
  photo?: string;
  faceEnrolled: boolean;
  points: number;
  active: boolean;
  createdAt: string;
  notifApproval: boolean;
}

export interface Attendance {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  checkIn?: string; // ISO
  checkOut?: string;
  late: boolean;
  early: boolean;
  inScore?: number;
  outScore?: number;
  distance?: number;
  method?: "face" | "qr" | "manual";
  selfReport?: boolean;
}

export interface PiketTask {
  id: string;
  name: string;
  area: string; // Depan / Tengah / Belakang / Gudang / Umum
  points: number;
  requiresProof: boolean;
  active: boolean;
  icon: "broom" | "mop" | "door" | "thermo" | "box" | "clip";
  desc: string;
}

export interface PiketAssignment {
  id: string;
  taskId: string;
  day: number; // 1 = Monday … 6 = Saturday
  userId: string;
}

export interface PiketLog {
  id: string;
  date: string;
  taskId: string;
  userId: string;
  doneAt: string;
  proof: boolean;
  points: number;
}

export interface Overtime {
  id: string;
  userId: string;
  date: string;
  start: string;
  end: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  note?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface Leave {
  id: string;
  userId: string;
  date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface PointEvent {
  id: string;
  userId: string;
  date: string;
  delta: number;
  label: string;
}

export interface RedeemItem {
  id: string;
  name: string;
  cost: number;
  stock: number;
  icon: "package" | "wallet" | "shield" | "cup" | "ticket" | "snack";
  cat: "Gear" | "Voucher" | "Essentials";
}

export interface Redemption {
  id: string;
  userId: string;
  itemId: string;
  date: string;
  cost: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  author: string;
  date: string;
  pinned: boolean;
}

export interface Notif {
  id: string;
  userId: string; // "*" = broadcast
  title: string;
  body: string;
  date: string; // ISO
  readBy: string[];
}

export interface SupaCfg {
  url: string;
  key: string;
  status: "off" | "connected";
  connectedAt?: string;
  lastSync?: string;
}

export interface Settings {
  appName: string;
  company: string;
  logo?: string;
  hue: number;
  siteName: string;
  lat: number;
  lng: number;
  radius: number;
  lateTime: string; // HH:mm
  theme: "light" | "dark";
  pointsExpiryMonths: number;
  otRate: number; // IDR per hour
  language: Lang;
  supabase: SupaCfg;
}

export interface DB {
  version: number;
  settings: Settings;
  users: User[];
  attendance: Attendance[];
  tasks: PiketTask[];
  template: PiketAssignment[];
  piketLog: PiketLog[];
  ot: Overtime[];
  pointEvents: PointEvent[];
  redemptions: Redemption[];
  items: RedeemItem[];
  announcements: Announcement[];
  notifications: Notif[];
  leaves: Leave[];
}
