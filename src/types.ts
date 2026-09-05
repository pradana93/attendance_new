export type Role = "superadmin" | "admin" | "staff";
export type Lang = "en" | "id";
export type Tone = "morning" | "afternoon" | "night";

export interface User {
  id: string;
  name: string;
  email: string;
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
  /** submitted proof photo (data URL) — viewable by admin in the gallery */
  proof?: string;
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
  /** optional supporting photo (data URL) — viewable by admin */
  photo?: string;
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

/** Shift handover note — outgoing crew briefs the incoming crew */
export interface Handover {
  id: string;
  date: string;
  shiftId: string;
  fromUserId: string;
  note: string;
  /** unresolved problem handed over (optional) */
  issue?: string;
  createdAt: string;
  confirmedBy?: string;
  confirmedAt?: string;
}

/** Piket swap request — staff asks a colleague to cover one duty date */
export interface SwapRequest {
  id: string;
  date: string;
  taskId: string;
  fromUserId: string;
  toUserId: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedBy?: string;
}

/** Approved swap → per-date roster override */
export interface SwapOverride {
  id: string;
  date: string;
  taskId: string;
  userId: string;
}

export type FeedbackType = "bug" | "idea" | "general" | "praise";
export type FeedbackPriority = "low" | "medium" | "high" | "urgent";
export type FeedbackStatus = "new" | "review" | "planned" | "progress" | "shipped" | "wont_fix";

export interface Feedback {
  id: string;
  userId: string;
  type: FeedbackType;
  priority: FeedbackPriority;
  title: string;
  description: string;
  screenshot?: string;
  contactEmail?: string;
  status: FeedbackStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt?: string;
  decidedAt?: string;
  decidedBy?: string;
  userAgent?: string;
  appVersion?: string;
  route?: string;
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
  handovers: Handover[];
  swapRequests: SwapRequest[];
  swapOverrides: SwapOverride[];
  feedback: Feedback[];
}

// Supabase Database Types for type-safe queries
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: Role;
          phone?: string;
          avatar_url?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role: Role;
          phone?: string;
          avatar_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: Role;
          phone?: string;
          avatar_url?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      attendance: {
        Row: {
          id: string;
          user_id: string;
          check_in: string;
          check_out?: string;
          location_lat?: number;
          location_lng?: number;
          accuracy?: number;
          photo_url?: string;
          notes?: string;
          status: 'present' | 'late' | 'absent' | 'permission';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          check_in: string;
          check_out?: string;
          location_lat?: number;
          location_lng?: number;
          accuracy?: number;
          photo_url?: string;
          notes?: string;
          status?: 'present' | 'late' | 'absent' | 'permission';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          check_in?: string;
          check_out?: string;
          location_lat?: number;
          location_lng?: number;
          accuracy?: number;
          photo_url?: string;
          notes?: string;
          status?: 'present' | 'late' | 'absent' | 'permission';
          created_at?: string;
        };
      };
      picket_logs: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          task_name: string;
          scheduled_date: string;
          completed_at?: string;
          photo_url?: string;
          notes?: string;
          status: 'pending' | 'completed' | 'missed';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          task_name: string;
          scheduled_date: string;
          completed_at?: string;
          photo_url?: string;
          notes?: string;
          status?: 'pending' | 'completed' | 'missed';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string;
          task_name?: string;
          scheduled_date?: string;
          completed_at?: string;
          photo_url?: string;
          notes?: string;
          status?: 'pending' | 'completed' | 'missed';
          created_at?: string;
        };
      };
      point_events: {
        Row: {
          id: string;
          user_id: string;
          points: number;
          reason: string;
          category: 'attendance' | 'picket' | 'overtime' | 'bonus' | 'redemption';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          points: number;
          reason: string;
          category: 'attendance' | 'picket' | 'overtime' | 'bonus' | 'redemption';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          points?: number;
          reason?: string;
          category?: 'attendance' | 'picket' | 'overtime' | 'bonus' | 'redemption';
          created_at?: string;
        };
      };
      overtime_requests: {
        Row: {
          id: string;
          user_id: string;
          request_date: string;
          start_time: string;
          end_time: string;
          reason: string;
          estimated_pay?: number;
          status: 'pending' | 'approved' | 'rejected';
          approved_by?: string;
          approved_at?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          request_date: string;
          start_time: string;
          end_time: string;
          reason: string;
          estimated_pay?: number;
          status?: 'pending' | 'approved' | 'rejected';
          approved_by?: string;
          approved_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          request_date?: string;
          start_time?: string;
          end_time?: string;
          reason?: string;
          estimated_pay?: number;
          status?: 'pending' | 'approved' | 'rejected';
          approved_by?: string;
          approved_at?: string;
          created_at?: string;
        };
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: any;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: any;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: any;
          updated_at?: string;
        };
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          content: string;
          priority: 'low' | 'medium' | 'high' | 'urgent';
          published_at: string;
          expires_at?: string;
          created_by?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          published_at?: string;
          expires_at?: string;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          published_at?: string;
          expires_at?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      feedback: {
        Row: {
          id: string;
          user_id?: string;
          type: 'bug' | 'idea' | 'general' | 'praise';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          title: string;
          description: string;
          screenshot_url?: string;
          metadata?: any;
          status: 'new' | 'review' | 'planned' | 'progress' | 'shipped' | 'wont_fix';
          admin_notes?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          type: 'bug' | 'idea' | 'general' | 'praise';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          title: string;
          description: string;
          screenshot_url?: string;
          metadata?: any;
          status?: 'new' | 'review' | 'planned' | 'progress' | 'shipped' | 'wont_fix';
          admin_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'bug' | 'idea' | 'general' | 'praise';
          priority?: 'low' | 'medium' | 'high' | 'urgent';
          title?: string;
          description?: string;
          screenshot_url?: string;
          metadata?: any;
          status?: 'new' | 'review' | 'planned' | 'progress' | 'shipped' | 'wont_fix';
          admin_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
