import { useState, useEffect } from "react";
import {
  Bell, CalendarOff, Cloud, Database, Globe, History, LogOut, Moon, Plane, Sun, UserCircle2, MessageSquare, AlarmClock, X,
} from "lucide-react";
import type { Lang, User } from "../types";
import { getDB, leaveBalance, requestLeave, setNotifPref, updateSettings } from "../lib/store";
import { createLeaveRequest, setNotificationPreferenceRemote, signOut } from "../lib/production";
import { refreshProductionData } from "../lib/store";
import { fmtDate, todayKey } from "../lib/util";
import { useT } from "../lib/i18n";
import { VERSION } from "../lib/changelog";
import { Avatar, Btn, Chip, Confirm, Empty, Field, SectionTitle, Seg, Sheet, StatusBadge, Toggle, toast } from "../components/ui";
import { FeedbackSheet } from "./feedback";
import * as notif from "../lib/notifications";

export default function Me({ user, onLogout, onChangelog, onFeedback }: { user: User; onLogout: () => void; onChangelog: () => void; onFeedback?: () => void }) {
  const db = getDB();
  const t = useT();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(notif.getPermission());
  const [reminders, setReminders] = useState<notif.ReminderPreset[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [customTime, setCustomTime] = useState("08:00");
  const [editingReminder, setEditingReminder] = useState<notif.ReminderPreset | null>(null);
  const [removeReminder, setRemoveReminder] = useState<notif.ReminderPreset | null>(null);
  
  useEffect(() => {
    const seeded = notif.mergeReminderPresets(user.id, notif.defaultReminderPresets(user.name, db?.settings.lateTime ?? "08:00"));
    setReminders(seeded);
    const activeTimers = notif.loadActiveReminders();
    setNotifEnabled(activeTimers.length > 0 || notifPermission === 'granted');
  }, [db?.settings.lateTime, notifPermission, user.id, user.name]);

  useEffect(() => {
    if (notifPermission !== "granted" || reminders.length === 0) return;
    const enabled = reminders.filter((item) => item.enabled);
    if (enabled.length === 0) return;
    notif.clearAllReminders(notif.loadActiveReminders());
    const timers = notif.scheduleAllPresets(enabled);
    notif.saveActiveReminders(timers);
    setNotifEnabled(true);
  }, [notifPermission, reminders]);
  
  if (!db) {
    return (
      <div className="a-fadein space-y-3">
        <div className="card p-4">
          <p className="ttl text-[13px] font-bold text-ink">{t("m.profile")}</p>
          <p className="mt-1 font-mono text-[10.5px] text-faint">Loading your workspace profile…</p>
        </div>
      </div>
    );
  }
  const s = db.settings;
  const balance = leaveBalance(user.id);
  const myLeaves = db.leaves.filter((l) => l.userId === user.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  
  const handleToggleReminders = async () => {
    if (notifEnabled) {
      // Disable reminders
      const timers = notif.loadActiveReminders();
      notif.clearAllReminders(timers);
      setNotifEnabled(false);
      toast(t("n.cancelled"), "info");
    } else {
      // Enable reminders - request permission first
      const granted = await notif.requestPermission();
      if (!granted) {
        toast(t("n.permissionBody"), "err");
        return;
      }
      setNotifPermission('granted');
      const next = notif.mergeReminderPresets(user.id, [
        {
          id: `attendance-clock-in-${user.id}`,
          kind: 'clock_in',
          title: t("n.clockIn"),
          body: notif.getClockInMessage(user.name, s.lateTime),
          enabled: true,
          time: s.lateTime,
          repeatDaily: true,
          days: [1, 2, 3, 4, 5, 6],
        },
        {
          id: `attendance-clock-out-${user.id}`,
          kind: 'clock_out',
          title: t("n.clockOut"),
          body: notif.getClockOutMessage(),
          enabled: true,
          time: notif.defaultReminderPresets(user.name, s.lateTime)[1].time,
          repeatDaily: true,
          days: [1, 2, 3, 4, 5, 6],
        },
        {
          id: `piket-reminder-${user.id}`,
          kind: 'piket',
          title: t("n.piket"),
          body: 'Check your assigned piket duty and complete proof if required.',
          enabled: true,
          time: '17:00',
          repeatDaily: false,
          days: [1, 2, 3, 4, 5, 6],
        },
        ...reminders.filter((item) => item.kind === 'custom'),
      ]);
      saveReminder(next);
      toast(t("n.scheduled"), "ok");
    }
  };

  const saveReminder = (next: notif.ReminderPreset[]) => {
    setReminders(next);
    const enabled = next.filter((item) => item.enabled);
    notif.saveReminderPresets(user.id, next);
    if (notifPermission !== "granted") {
      setNotifEnabled(enabled.length > 0);
      return;
    }
    notif.clearAllReminders(notif.loadActiveReminders());
    const timers = notif.scheduleAllPresets(enabled);
    notif.saveActiveReminders(timers);
    setNotifEnabled(timers.length > 0);
  };

  const upsertLocalReminder = (preset: notif.ReminderPreset) => {
    const next = notif.upsertReminderPreset(user.id, preset);
    saveReminder(next);
  };

  return (
    <div className="a-fadein stagger space-y-3">
      {/* profile */}
      <div className="card relative overflow-hidden p-4">
        <div className="hazard absolute inset-x-0 top-0 h-1" />
        <div className="flex items-center gap-3.5">
          <Avatar user={user} size={54} ring />
          <div className="min-w-0 flex-1">
            <p className="ttl text-[19px] font-bold leading-tight text-ink">{user.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-faint">{user.employeeId} · {user.department} · {user.email}</p>
            <div className="mt-1.5 flex gap-1.5">
              <Chip tone={user.role === "staff" ? "mut" : "amber"}>{user.role}</Chip>
              <Chip tone="cool">{t("m.member")} {fmtDate(user.createdAt)}</Chip>
            </div>
          </div>
        </div>
      </div>

      {/* leave */}
      <div className="card flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cool/12 text-cool"><Plane size={18} /></span>
        <div className="flex-1">
          <p className="ttl text-[13px] font-bold text-ink">{t("m.leaveBal")}</p>
          <p className="font-mono text-[11px] text-faint">{balance} / 12 {t("s.days")}</p>
        </div>
        <Btn variant="ghost" onClick={() => setLeaveOpen(true)}><CalendarOff size={14} /> {t("m.leaveReq")}</Btn>
      </div>
      {myLeaves.length > 0 && (
        <div className="card divide-y divide-line2">
          {myLeaves.map((l) => (
            <div key={l.id} className="flex items-center justify-between px-3.5 py-2.5">
              <div>
                <p className="font-mono text-[12.5px] font-semibold text-ink">{fmtDate(l.date)}</p>
                <p className="text-[11.5px] text-mut">{l.reason}</p>
              </div>
              <Chip tone={l.status === "approved" ? "ok" : l.status === "rejected" ? "bad" : "amber"}>{l.status}</Chip>
            </div>
          ))}
        </div>
      )}

      {/* feedback button for all users */}
      <button onClick={() => setFeedbackOpen(true)} className="tap card flex w-full items-center justify-between p-4 text-left hover:border-amber/40">
        <div className="flex items-center gap-2.5">
          <MessageSquare size={16} className="text-cool" />
          <div>
            <p className="text-[13px] font-semibold text-ink">{t("fb.title")}</p>
            <p className="font-mono text-[10.5px] text-faint">bugs · ideas · general</p>
          </div>
        </div>
        <Chip tone="cool">send</Chip>
      </button>

      {/* push notifications toggle */}
      <div className="card flex items-center gap-3 p-4">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${notifEnabled ? 'bg-amber/12 text-amber' : 'bg-mut/12 text-mut'}`}>
          <AlarmClock size={18} />
        </span>
        <div className="flex-1">
          <p className="ttl text-[13px] font-bold text-ink">{t("n.title")}</p>
          <p className="font-mono text-[11px] text-faint">
            {notifEnabled ? t("n.scheduled") : t("n.noReminders")}
          </p>
        </div>
        <Toggle on={notifEnabled} onChange={handleToggleReminders} />
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ttl text-[13px] font-bold text-ink">{t("n.title")}</p>
            <p className="font-mono text-[10.5px] text-faint">Daily attendance, piket, and custom reminders</p>
          </div>
          <Chip tone="cool">{reminders.filter((item) => item.enabled).length} active</Chip>
        </div>

        <div className="space-y-2">
          {reminders.map((item) => (
            <div key={item.id} className="card2 flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{item.title}</p>
                <p className="font-mono text-[10.5px] text-faint">{item.time ?? "custom"} · {item.repeatDaily ? "daily" : "one-time"}</p>
                <p className="font-mono text-[10px] text-faint">next: {notif.formatReminderNext(item)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingReminder(item)}
                  className="tap rounded-lg border border-line bg-panel2 px-2.5 py-1.5 text-[11px] font-semibold text-mut hover:border-cool/40 hover:text-cool"
                >
                  Edit
                </button>
                <Toggle on={item.enabled} onChange={(enabled) => saveReminder(notif.toggleReminderPreset(user.id, item.id, enabled))} />
                <button
                  onClick={() => setRemoveReminder(item)}
                  className="tap rounded-lg border border-line bg-panel2 p-2 text-faint hover:border-bad/40 hover:text-bad"
                  aria-label={`Remove ${item.title}`}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-line2 pt-3 space-y-3">
          <p className="ttl text-[11px] font-bold text-faint">Add other reminder</p>
          <Field label="Reminder title"><input className="inp" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Medicine, meeting, pickup" /></Field>
          <Field label="Message"><input className="inp" value={customBody} onChange={(e) => setCustomBody(e.target.value)} placeholder="Short note for the reminder" /></Field>
          <Field label="Time"><input className="inp font-mono" type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} /></Field>
          <Btn className="w-full" onClick={() => {
            if (!customTitle.trim()) { toast("Reminder title required", "err"); return; }
            void (async () => {
              const granted = notifPermission === "granted" ? true : await notif.requestPermission();
              if (!granted) {
                toast(t("n.permissionBody"), "err");
                return;
              }
              setNotifPermission("granted");
            const next = notif.upsertReminderPreset(user.id, {
              id: `custom-${Date.now()}`,
              kind: 'custom',
              title: customTitle.trim(),
              body: customBody.trim() || notif.getCustomReminderMessage(customTitle.trim()),
              enabled: true,
              time: customTime,
              repeatDaily: false,
            });
            saveReminder(next);
            setCustomTitle("");
            setCustomBody("");
            toast("Custom reminder added", "ok");
            })();
          }}><AlarmClock size={14} /> Add reminder</Btn>
        </div>
      </div>

      {/* feedback sheet */}
      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} user={user} />

      <Sheet open={!!editingReminder} onClose={() => setEditingReminder(null)} title="Edit reminder">
        {editingReminder && (
          <div className="space-y-3.5">
            <Field label="Reminder title"><input className="inp" value={editingReminder.title} onChange={(e) => setEditingReminder({ ...editingReminder, title: e.target.value })} /></Field>
            <Field label="Message"><input className="inp" value={editingReminder.body} onChange={(e) => setEditingReminder({ ...editingReminder, body: e.target.value })} /></Field>
            <Field label="Time"><input className="inp font-mono" type="time" value={editingReminder.time ?? "08:00"} onChange={(e) => setEditingReminder({ ...editingReminder, time: e.target.value })} /></Field>
            <div className="flex items-center justify-between rounded-xl border border-line bg-panel2 px-3 py-2.5">
              <div>
                <p className="text-[12.5px] font-semibold text-ink">Repeat daily</p>
                <p className="font-mono text-[10.5px] text-faint">Keeps the reminder active every day</p>
              </div>
              <Toggle on={!!editingReminder.repeatDaily} onChange={(v) => setEditingReminder({ ...editingReminder, repeatDaily: v })} />
            </div>
            <Btn className="w-full" onClick={() => { upsertLocalReminder(editingReminder); setEditingReminder(null); toast("Reminder updated", "ok"); }}><AlarmClock size={14} /> Save reminder</Btn>
          </div>
        )}
      </Sheet>

      <Confirm
        open={!!removeReminder}
        onClose={() => setRemoveReminder(null)}
        danger
        title="Remove reminder?"
        body={removeReminder ? `Delete ${removeReminder.title} from your saved reminders.` : ""}
        yesLabel="Remove"
        onYes={() => {
          if (!removeReminder) return;
          const next = notif.removeReminderPreset(user.id, removeReminder.id);
          saveReminder(next);
          setRemoveReminder(null);
          toast("Reminder removed", "info");
        }}
      />

      {/* settings */}
      <SectionTitle>{t("m.settings")}</SectionTitle>
      <div className="card divide-y divide-line2">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Globe size={15} className="text-amber" />
            <p className="text-[13px] font-semibold text-ink">{t("a.lang")}</p>
          </div>
          <Seg small options={[{ id: "en", label: "English" }, { id: "id", label: "Indonesia" }]}
            value={s.language} onChange={(v) => { updateSettings({ language: v as Lang }); toast(v === "id" ? "Bahasa Indonesia aktif" : "Language set to English"); }} />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            {s.theme === "dark" ? <Moon size={15} className="text-cool" /> : <Sun size={15} className="text-amber" />}
            <p className="text-[13px] font-semibold text-ink">{t("a.night")}</p>
          </div>
          <Toggle on={s.theme === "dark"} onChange={(v) => updateSettings({ theme: v ? "dark" : "light" })} />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Bell size={15} className="text-amber" />
            <p className="text-[13px] font-semibold text-ink">{t("m.notifyApproval")}</p>
          </div>
          <Toggle on={user.notifApproval} onChange={async (v) => { try { await setNotificationPreferenceRemote(user.id, v); await refreshProductionData(); toast(v ? "Notifications on" : "Notifications muted", "info"); } catch (error) { toast(error instanceof Error ? error.message : "Could not update notifications", "err"); } }} />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            {s.supabase.status === "connected" ? <Cloud size={15} className="text-cool" /> : <Database size={15} className="text-ok" />}
            <div>
              <p className="text-[13px] font-semibold text-ink">{t("m.supabase")}</p>
              <p className="font-mono text-[10.5px] text-faint">{s.supabase.status === "connected" ? s.supabase.url : t("m.offline")}</p>
            </div>
          </div>
          <Chip tone={s.supabase.status === "connected" ? "cool" : "mut"}>{s.supabase.status === "connected" ? "online" : "local"}</Chip>
        </div>
      </div>

      {/* changelog */}
      <button onClick={onChangelog} className="tap card flex w-full items-center justify-between p-4 text-left hover:border-amber/40">
        <div className="flex items-center gap-2.5">
          <History size={16} className="text-amber" />
          <div>
            <p className="text-[13px] font-semibold text-ink">Changelog</p>
            <p className="font-mono text-[10.5px] text-faint">release history · what's new</p>
          </div>
        </div>
        <Chip tone="amber">v{VERSION}</Chip>
      </button>

      {/* session */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserCircle2 size={16} className="text-faint" />
            <div>
              <p className="ttl text-[13px] font-bold text-ink">{t("m.session")}</p>
              <p className="font-mono text-[10.5px] text-faint">{t("m.jwt")}</p>
            </div>
          </div>
          <Btn variant="danger" onClick={() => setConfirmOut(true)}><LogOut size={14} /> {t("c.logout")}</Btn>
        </div>
      </div>

      {/* leave sheet */}
      <Sheet open={leaveOpen} onClose={() => setLeaveOpen(false)} title={t("m.leaveReq")}>
        <div className="space-y-3.5">
          <Field label={t("o.date")}>
            <input className="inp font-mono" type="date" min={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t("m.leaveReason")}>
            <textarea className="inp min-h-[64px] resize-none" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="…" />
          </Field>
          <Btn className="w-full" busy={busy} disabled={!date || !reason.trim()} onClick={async () => {
            setBusy(true);
            try { await createLeaveRequest({ userId: user.id, date, reason: reason.trim() }); await refreshProductionData(); toast("Leave request submitted", "ok"); setLeaveOpen(false); setDate(""); setReason(""); }
            catch (error) { toast(error instanceof Error ? error.message : "Could not submit leave request", "err"); }
            finally { setBusy(false); }
          }}><Plane size={15} /> {t("m.submit")}</Btn>
        </div>
      </Sheet>

      <Confirm open={confirmOut} onClose={() => setConfirmOut(false)} danger
        title={t("c.logoutQ")} body={t("c.logoutBody")} yesLabel={t("c.logout")}
        onYes={() => { void signOut(); onLogout(); }} />
    </div>
  );
}
