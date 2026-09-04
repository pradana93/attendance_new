import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

let supabaseInstance: SupabaseClient<Database> | null = null;

export function initSupabase(url: string, key: string): SupabaseClient<Database> {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  supabaseInstance = createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
  
  return supabaseInstance;
}

export function getSupabase(): SupabaseClient<Database> | null {
  return supabaseInstance;
}

export function clearSupabase(): void {
  supabaseInstance = null;
}

// Helper to check connection
export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createClient<Database>(url, key);
    const { data, error } = await client.from('settings').select('id').limit(1);
    
    if (error) {
      // Table might not exist yet, which is okay for initial setup
      if (error.code === '42P01') { // undefined_table
        return { success: true, error: undefined };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (e) {
    return { 
      success: false, 
      error: e instanceof Error ? e.message : 'Unknown connection error' 
    };
  }
}

// Deploy schema to Supabase
export async function deploySchema(url: string, key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createClient<Database>(url, key);
    
    // SQL Migration Script
    const migrations = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('superadmin', 'admin', 'staff')) NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  accuracy DECIMAL(5, 2),
  photo_url TEXT,
  notes TEXT,
  status TEXT CHECK (status IN ('present', 'late', 'absent', 'permission')) DEFAULT 'present',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Picket logs
CREATE TABLE IF NOT EXISTS picket_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL,
  task_name TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  photo_url TEXT,
  notes TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'missed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Point events (gamification)
CREATE TABLE IF NOT EXISTS point_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  category TEXT CHECK (category IN ('attendance', 'picket', 'overtime', 'bonus', 'redemption')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Overtime requests
CREATE TABLE IF NOT EXISTS overtime_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  request_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT NOT NULL,
  estimated_pay DECIMAL(12, 2),
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (geofence, config)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  published_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('bug', 'idea', 'general', 'praise')) NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  screenshot_url TEXT,
  metadata JSONB,
  status TEXT CHECK (status IN ('new', 'review', 'planned', 'progress', 'shipped', 'wont_fix')) DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON attendance(check_in);
CREATE INDEX IF NOT EXISTS idx_picket_logs_user_id ON picket_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_picket_logs_scheduled_date ON picket_logs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_point_events_user_id ON point_events(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_requests_user_id ON overtime_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE picket_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

-- RLS Policies for attendance
CREATE POLICY "Users can view own attendance" ON attendance
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

CREATE POLICY "Users can insert own attendance" ON attendance
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for picket_logs
CREATE POLICY "Users can view own picket logs" ON picket_logs
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

CREATE POLICY "Users can update own picket logs" ON picket_logs
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for point_events
CREATE POLICY "Users can view own points" ON point_events
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

-- RLS Policies for overtime_requests
CREATE POLICY "Users can view own overtime requests" ON overtime_requests
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

CREATE POLICY "Users can create own overtime requests" ON overtime_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for settings
CREATE POLICY "Admins can view settings" ON settings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

CREATE POLICY "Admins can update settings" ON settings
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

CREATE POLICY "Admins can insert settings" ON settings
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

-- RLS Policies for announcements
CREATE POLICY "Everyone can view announcements" ON announcements
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage announcements" ON announcements
  FOR ALL USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

-- RLS Policies for feedback
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

CREATE POLICY "Users can create feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update feedback" ON feedback
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('superadmin', 'admin')
  ));
`;

    // Execute migration via Supabase RPC or direct SQL
    // Note: Direct SQL execution requires supabase_sql extension or using the dashboard
    // For now, we'll provide the SQL for manual execution or use a workaround
    
    console.log('Schema migration SQL generated successfully');
    console.log('Please execute this SQL in your Supabase SQL Editor:');
    console.log(migrations);
    
    // Attempt to create settings table first as a test
    const { error: settingsError } = await client.rpc('exec_sql', { sql: migrations });
    
    if (settingsError && settingsError.message.includes('function exec_sql does not exist')) {
      // RPC method not available, return SQL for manual execution
      return { 
        success: true, 
        error: 'SQL generated. Please copy and execute this in Supabase Dashboard > SQL Editor.' 
      };
    }
    
    if (settingsError) {
      return { success: false, error: settingsError.message };
    }
    
    return { success: true };
  } catch (e) {
    return { 
      success: false, 
      error: e instanceof Error ? e.message : 'Failed to deploy schema' 
    };
  }
}
