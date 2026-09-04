import { useState } from "react";
import {
  Bell, CalendarOff, Cloud, Database, Globe, History, LogOut, Moon, Plane, Sun, UserCircle2, MessageSquare,
} from "lucide-react";
import type { Lang, User } from "../types";
import { getDB, leaveBalance, logout, requestLeave, setNotifPref, updateSettings } from "../lib/store";
import { fmtDate, todayKey } from "../lib/util";
import { useT } from "../lib/i18n";
import { VERSION } from "../lib/changelog";
import { Avatar, Btn, Chip, Confirm, Field, SectionTitle, Seg, Sheet, Toggle, toast } from "../components/ui";

export default function Me({ user, onChangelog, onFeedback }: { user: User; onChangelog: () => void; onFeedback?: () => void }) {
  const db = getDB();
  const t = useT();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  if (!db) return null;
  const s = db.settings;
  const balance = leaveBalance(user.id);
  const myLeaves = db.leaves.filter((l) => l.userId === user.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

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
      <button onClick={onFeedback} className="tap card flex w-full items-center justify-between p-4 text-left hover:border-amber/40">
        <div className="flex items-center gap-2.5">
          <MessageSquare size={16} className="text-cool" />
          <div>
            <p className="text-[13px] font-semibold text-ink">{t("fb.title")}</p>
            <p className="font-mono text-[10.5px] text-faint">bugs · ideas · general</p>
          </div>
        </div>
        <Chip tone="cool">send</Chip>
      </button>

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
          <Toggle on={user.notifApproval} onChange={(v) => { setNotifPref(user.id, v); toast(v ? "Notifications on" : "Notifications muted", "info"); }} />
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
          <Btn className="w-full" busy={busy} disabled={!date || !reason.trim()} onClick={() => {
            setBusy(true);
            setTimeout(() => {
              const res = requestLeave(user.id, date, reason.trim());
              setBusy(false);
              if (res.ok) { toast(res.msg, "ok"); setLeaveOpen(false); setDate(""); setReason(""); }
              else toast(res.msg, "err");
            }, 450);
          }}><Plane size={15} /> {t("m.submit")}</Btn>
        </div>
      </Sheet>

      <Confirm open={confirmOut} onClose={() => setConfirmOut(false)} danger
        title={t("c.logoutQ")} body={t("c.logoutBody")} yesLabel={t("c.logout")}
        onYes={() => { logout(); }} />
    </div>
  );
}
