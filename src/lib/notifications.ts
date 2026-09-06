/**
 * ShiftGate Push Notification System
 * Local-first scheduled reminders for Clock In/Out and Piket duties
 * Optimized for Android Chrome PWA
 */

export interface Reminder {
  id: string;
  type: 'clock_in' | 'clock_out' | 'piket';
  title: string;
  body: string;
  scheduledAt: number; // timestamp
  repeatDaily?: boolean;
}

export type ReminderKind = Reminder['type'] | 'custom';

export interface ReminderPreset {
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  enabled: boolean;
  time?: string;
  repeatDaily?: boolean;
  days?: number[];
}

let activeReminderIds: number[] = [];
const REMINDER_STORE = 'shiftgate.reminders.v1';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function reminderKey(userId: string): string {
  return `${REMINDER_STORE}:${userId}`;
}

export function defaultReminderPresets(userName: string, lateTime: string): ReminderPreset[] {
  return [
    {
      id: 'attendance-clock-in',
      kind: 'clock_in',
      title: 'Daily attendance reminder',
      body: getClockInMessage(userName, lateTime),
      enabled: true,
      time: lateTime,
      repeatDaily: true,
      days: [1, 2, 3, 4, 5, 6],
    },
    {
      id: 'attendance-clock-out',
      kind: 'clock_out',
      title: 'Clock-out reminder',
      body: getClockOutMessage(),
      enabled: true,
      time: addHours(lateTime, 9),
      repeatDaily: true,
      days: [1, 2, 3, 4, 5, 6],
    },
    {
      id: 'piket-reminder',
      kind: 'piket',
      title: 'Piket reminder',
      body: 'Check your assigned piket duty and complete proof if required.',
      enabled: true,
      time: '17:00',
      repeatDaily: false,
      days: [1, 2, 3, 4, 5, 6],
    },
  ];
}

export function loadReminderPresets(userId: string): ReminderPreset[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(reminderKey(userId));
    return raw ? (JSON.parse(raw) as ReminderPreset[]) : [];
  } catch {
    return [];
  }
}

export function saveReminderPresets(userId: string, presets: ReminderPreset[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(reminderKey(userId), JSON.stringify(presets));
  } catch {
    // local storage unavailable
  }
}

export function mergeReminderPresets(userId: string, next: ReminderPreset[]): ReminderPreset[] {
  const current = loadReminderPresets(userId);
  const map = new Map(current.map((item) => [item.id, item]));
  next.forEach((item) => {
    const existing = map.get(item.id);
    map.set(item.id, existing ? { ...item, enabled: existing.enabled, time: existing.time ?? item.time } : item);
  });
  const merged = [...map.values()];
  saveReminderPresets(userId, merged);
  return merged;
}

export function upsertReminderPreset(userId: string, preset: ReminderPreset): ReminderPreset[] {
  const current = loadReminderPresets(userId);
  const next = [...current.filter((item) => item.id !== preset.id), preset];
  saveReminderPresets(userId, next);
  return next;
}

export function removeReminderPreset(userId: string, presetId: string): ReminderPreset[] {
  const next = loadReminderPresets(userId).filter((item) => item.id !== presetId);
  saveReminderPresets(userId, next);
  return next;
}

export function toggleReminderPreset(userId: string, presetId: string, enabled: boolean): ReminderPreset[] {
  const next = loadReminderPresets(userId).map((item) => item.id === presetId ? { ...item, enabled } : item);
  saveReminderPresets(userId, next);
  return next;
}

export function nextReminderAt(time: string): number {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime();
}

export function describeReminder(preset: ReminderPreset): string {
  const when = preset.time ? ` · ${preset.time}` : '';
  return `${preset.title}${when}`;
}

function addHours(time: string, hoursToAdd: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const total = ((hours + hoursToAdd) % 24 + 24) % 24;
  return `${String(total).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Check if browser supports notifications */
export function isSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/** Check current permission status */
export function getPermission(): NotificationPermission {
  if (!isSupported()) return 'denied';
  return Notification.permission;
}

/** Request notification permission from user */
export async function requestPermission(): Promise<boolean> {
  if (!isSupported()) return false;
  if (Notification.permission === 'granted') return true;
  
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/** Show a local notification immediately */
export function showNotification(title: string, options?: NotificationOptions): void {
  if (!isSupported() || Notification.permission !== 'granted') return;
  
  try {
    new Notification(title, {
      badge: '/icons/icon-192.png',
      icon: '/icons/icon-192.png',
      ...options,
    });
  } catch {
    // Silent fail - notification blocked or error
  }
}

/** Schedule a reminder using setTimeout (works when app is open/backgrounded) */
export function scheduleReminder(reminder: Reminder): number {
  const now = Date.now();
  const delay = reminder.scheduledAt - now;
  
  if (delay <= 0) {
    // Already past - show immediately
    showNotification(reminder.title, { body: reminder.body });
    return -1;
  }
  
  const timerId = window.setTimeout(() => {
    showNotification(reminder.title, { 
      body: reminder.body,
      tag: reminder.type,
      requireInteraction: reminder.type === 'clock_in' || reminder.type === 'clock_out',
    });
    
    // If daily repeat, schedule next occurrence
    if (reminder.repeatDaily) {
      const nextDay = reminder.scheduledAt + 86400000; // +24 hours
      scheduleReminder({ ...reminder, scheduledAt: nextDay });
    }
  }, delay);
  
  return timerId;
}

export function schedulePreset(reminder: ReminderPreset, fallbackBody?: string): number {
  if (!reminder.enabled || !reminder.time) return -1;
  const when = nextReminderAt(reminder.time);
  return scheduleReminder({
    id: reminder.id,
    type: reminder.kind === 'custom' ? 'piket' : reminder.kind,
    title: reminder.title,
    body: fallbackBody ?? reminder.body,
    scheduledAt: when,
    repeatDaily: reminder.repeatDaily,
  });
}

export function scheduleAllPresets(reminders: ReminderPreset[]): number[] {
  return reminders
    .filter((item) => item.enabled)
    .map((item) => schedulePreset(item));
}

/** Calculate next clock-in time based on settings */
export function getNextClockInTime(lateTime: string): Date {
  const now = new Date();
  const [hours, minutes] = lateTime.split(':').map(Number);
  
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  
  // If already past today's time, schedule for tomorrow
  if (now > target) {
    target.setDate(target.getDate() + 1);
  }
  
  // Don't schedule on Sunday (day 0)
  while (target.getDay() === 0) {
    target.setDate(target.getDate() + 1);
  }
  
  return target;
}

/** Calculate next clock-out time (8 hours after clock-in) */
export function getNextClockOutTime(lateTime: string): Date {
  const clockIn = getNextClockInTime(lateTime);
  clockIn.setHours(clockIn.getHours() + 9); // 9 hours shift
  
  return clockIn;
}

/** Get user's piket duty time (default 17:00) */
export function getNextPiketTime(): Date {
  const now = new Date();
  const target = new Date(now);
  target.setHours(17, 0, 0, 0);
  
  // If already past today's time, schedule for tomorrow
  if (now > target) {
    target.setDate(target.getDate() + 1);
  }
  
  // Skip Sundays
  while (target.getDay() === 0) {
    target.setDate(target.getDate() + 1);
  }
  
  return target;
}

/** Keep active reminder timers for this browser session only. */
export function saveActiveReminders(timerIds: number[]): void {
  activeReminderIds = [...timerIds];
}

/** Load active reminder timers for this browser session. */
export function loadActiveReminders(): number[] {
  return [...activeReminderIds];
}

/** Clear all scheduled reminders */
export function clearAllReminders(timerIds: number[]): void {
  timerIds.forEach((id) => clearTimeout(id));
  activeReminderIds = [];
}

/** Format time for notification display */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Format date for notification display */
export function formatDate(date: Date): string {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Check if it's a work day (Mon-Sat) */
export function isWorkDay(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 6;
}

/** Generate reminder message for clock-in */
export function getClockInMessage(userName: string, shiftTime: string): string {
  return `Good morning, ${userName}! Your shift starts at ${shiftTime}. Don't forget to check in with face recognition.`;
}

/** Generate reminder message for clock-out */
export function getClockOutMessage(): string {
  return 'Time to clock out! Make sure to complete your check-out before leaving.';
}

/** Generate reminder message for piket duty */
export function getPiketMessage(taskName: string): string {
  return `Don't forget: You're on piket duty today for "${taskName}". Complete your tasks and upload proof photos if required.`;
}

export function getCustomReminderMessage(title: string): string {
  return `Reminder: ${title}`;
}
