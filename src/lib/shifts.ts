/**
 * Shift Baseline Utilities
 * 
 * Per-user shift time windows for attendance validation, overtime detection,
 * and real-time monitoring. Shifts are stored as HH:mm (24-hour format).
 */

import type { User, Settings } from "../types";

/**
 * Convert HH:mm string to minutes since midnight
 * @example timeToMinutes("08:15") → 495
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Convert minutes since midnight back to HH:mm string
 * @example minutesToTime(495) → "08:15"
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Calculate difference in minutes between two HH:mm times
 * @example minutesDiff("08:00", "08:30") → 30
 */
export function minutesDiff(from: string, to: string): number {
  return timeToMinutes(to) - timeToMinutes(from);
}

/**
 * Add hours to an HH:mm time string
 * @example addHours("08:00", 9) → "17:00"
 */
export function addHours(time: string, hours: number): string {
  return minutesToTime(timeToMinutes(time) + hours * 60);
}

/**
 * Get user's effective shift start time
 * - Uses user.shiftStart if defined
 * - Falls back to workspace lateTime if null
 * 
 * @param user User object with optional shiftStart
 * @param settings Workspace settings with lateTime fallback
 * @returns HH:mm string
 */
export function getShiftStart(user: User, settings: Settings): string {
  return user.shiftStart || settings.lateTime;
}

/**
 * Get user's effective shift end time
 * - Uses user.shiftEnd if defined
 * - Calculates shiftStart + defaultShiftDuration if only start is defined
 * - Falls back to workspace lateTime + defaultShiftDuration
 * 
 * @param user User object with optional shiftStart/shiftEnd
 * @param settings Workspace settings
 * @returns HH:mm string
 */
export function getShiftEnd(user: User, settings: Settings): string {
  if (user.shiftEnd) return user.shiftEnd;
  const start = getShiftStart(user, settings);
  const duration = settings.defaultShiftDuration ?? 9;
  return addHours(start, duration);
}

/**
 * Get user's effective shift window as a formatted string
 * @example getShiftWindow(user, settings) → "08:00 — 17:00"
 */
export function getShiftWindow(user: User, settings: Settings): string {
  const start = getShiftStart(user, settings);
  const end = getShiftEnd(user, settings);
  return `${start} — ${end}`;
}

/**
 * Check if clock-in time is late compared to user's shift start
 * 
 * @param user User with optional shiftStart
 * @param settings Workspace settings
 * @param checkInTimeStr Current time as "HH:mm" string
 * @returns true if checked in after shift start (late), false if on time/early
 */
export function isClockInLate(user: User, settings: Settings, checkInTimeStr: string): boolean {
  const shiftStart = getShiftStart(user, settings);
  return minutesDiff(shiftStart, checkInTimeStr) > 0;
}

/**
 * Check if clock-out time is early compared to user's shift end
 * 
 * @param user User with optional shiftStart/shiftEnd
 * @param settings Workspace settings
 * @param checkOutTimeStr Current time as "HH:mm" string
 * @returns true if checked out before shift end (early), false if on time/late
 */
export function isClockOutEarly(user: User, settings: Settings, checkOutTimeStr: string): boolean {
  const shiftEnd = getShiftEnd(user, settings);
  return minutesDiff(checkOutTimeStr, shiftEnd) > 0;
}

/**
 * Calculate overtime minutes (time past shift end)
 * 
 * @param user User with optional shiftStart/shiftEnd
 * @param settings Workspace settings
 * @param checkOutTimeStr Current time as "HH:mm" string
 * @returns minutes past shift end (0 if no overtime)
 */
export function calculateOvertimeMinutes(user: User, settings: Settings, checkOutTimeStr: string): number {
  const shiftEnd = getShiftEnd(user, settings);
  return Math.max(0, minutesDiff(shiftEnd, checkOutTimeStr));
}

/**
 * Calculate overtime hours (with decimal precision)
 * 
 * @param user User with optional shiftStart/shiftEnd
 * @param settings Workspace settings
 * @param checkOutTimeStr Current time as "HH:mm" string
 * @returns hours past shift end (0 if no overtime)
 */
export function calculateOvertimeHours(user: User, settings: Settings, checkOutTimeStr: string): number {
  return calculateOvertimeMinutes(user, settings, checkOutTimeStr) / 60;
}

/**
 * Get late duration in minutes
 * 
 * @param user User with optional shiftStart
 * @param settings Workspace settings
 * @param checkInTimeStr Current time as "HH:mm" string
 * @returns minutes late (0 if on time/early)
 */
export function getLateDurationMinutes(user: User, settings: Settings, checkInTimeStr: string): number {
  const shiftStart = getShiftStart(user, settings);
  return Math.max(0, minutesDiff(shiftStart, checkInTimeStr));
}

/**
 * Get early checkout duration in minutes
 * 
 * @param user User with optional shiftStart/shiftEnd
 * @param settings Workspace settings
 * @param checkOutTimeStr Current time as "HH:mm" string
 * @returns minutes early (0 if on time/late)
 */
export function getEarlyDurationMinutes(user: User, settings: Settings, checkOutTimeStr: string): number {
  const shiftEnd = getShiftEnd(user, settings);
  return Math.max(0, minutesDiff(checkOutTimeStr, shiftEnd));
}

/**
 * Format shift status for display
 * Examples:
 * - "On Time (08:00)"
 * - "25 min LATE (08:25 vs 08:00)"
 * - "30 min EARLY (16:30 vs 17:00)"
 * - "45 min OT (17:45 vs 17:00)"
 */
export function formatShiftStatus(
  user: User,
  settings: Settings,
  checkInTimeStr?: string,
  checkOutTimeStr?: string
): string {
  if (checkInTimeStr && !checkOutTimeStr) {
    // Still on duty, show late/on-time status
    if (isClockInLate(user, settings, checkInTimeStr)) {
      const mins = getLateDurationMinutes(user, settings, checkInTimeStr);
      const shiftStart = getShiftStart(user, settings);
      return `${mins} min LATE (${checkInTimeStr} vs ${shiftStart})`;
    }
    return `On Time (${checkInTimeStr})`;
  }

  if (checkOutTimeStr) {
    // Clock-out logic
    if (isClockOutEarly(user, settings, checkOutTimeStr)) {
      const mins = getEarlyDurationMinutes(user, settings, checkOutTimeStr);
      const shiftEnd = getShiftEnd(user, settings);
      return `${mins} min EARLY (${checkOutTimeStr} vs ${shiftEnd})`;
    }
    const otMins = calculateOvertimeMinutes(user, settings, checkOutTimeStr);
    if (otMins > 0) {
      const shiftEnd = getShiftEnd(user, settings);
      return `${otMins} min OT (${checkOutTimeStr} vs ${shiftEnd})`;
    }
    const shiftEnd = getShiftEnd(user, settings);
    return `On Time (${checkOutTimeStr} vs ${shiftEnd})`;
  }

  return `Default (${getShiftWindow(user, settings)})`;
}

/**
 * Check if OT minutes exceed the threshold for notification
 * 
 * @param overtimeMinutes Minutes past shift end
 * @param threshold Minutes to trigger alert (default 30)
 * @returns true if OT exceeds threshold
 */
export function shouldNotifyOvertimeThreshold(overtimeMinutes: number, threshold: number = 30): boolean {
  return overtimeMinutes >= threshold;
}

/**
 * Format time in HH:mm:ss format for display
 * @example formatTimeWithSeconds("08:15:30") → "08:15:30"
 */
export function formatTimeWithSeconds(isoString: string): string {
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

/**
 * Extract HH:mm from ISO timestamp
 * @example getTimeFromISO("2026-09-06T08:15:30.000Z") → "08:15"
 */
export function getTimeFromISO(isoString: string): string {
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Get shift status color for UI display
 * Returns Tailwind tone: "ok" (green) | "amber" (yellow) | "bad" (red)
 */
export function getShiftStatusTone(
  user: User,
  settings: Settings,
  checkInTimeStr?: string,
  checkOutTimeStr?: string
): "ok" | "amber" | "bad" {
  if (checkInTimeStr && !checkOutTimeStr) {
    return isClockInLate(user, settings, checkInTimeStr) ? "bad" : "ok";
  }

  if (checkOutTimeStr) {
    if (isClockOutEarly(user, settings, checkOutTimeStr)) {
      return "amber"; // Early checkout
    }
    const otMins = calculateOvertimeMinutes(user, settings, checkOutTimeStr);
    if (otMins > 30) return "bad"; // Excessive OT
    if (otMins > 0) return "amber"; // Some OT
    return "ok"; // Perfect timing
  }

  return "ok";
}
