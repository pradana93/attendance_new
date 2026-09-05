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

let activeReminderIds: number[] = [];

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
