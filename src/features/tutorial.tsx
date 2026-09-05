import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock3, Home, MapPin, Settings2, UserCircle2, X } from "lucide-react";
import type { Role, User } from "../types";
import { Btn } from "../components/ui";

export type TutorialTarget = "home" | "piket" | "stats" | "ot" | "profile" | "admin" | "config";

interface TutorialStep {
  title: string;
  body: string;
  target: TutorialTarget;
  icon: typeof Home;
}

const staffSteps: TutorialStep[] = [
  { title: "Your attendance home", body: "Check your current location, review today's attendance, and start Check In or Check Out from Home.", target: "home", icon: Home },
  { title: "Your piket duties", body: "Open Piket to see assigned duties, complete tasks, and attach proof photos when required.", target: "piket", icon: CalendarDays },
  { title: "Your performance", body: "Stats shows attendance rate, punctuality, points, streaks, and your progress over time.", target: "stats", icon: BarChart3 },
  { title: "Overtime requests", body: "Submit overtime with the date, time, reason, and optional supporting evidence. Track approval here.", target: "ot", icon: Clock3 },
  { title: "Your profile", body: "Manage leave requests, reminders, language, appearance, feedback, and your session from Profile.", target: "profile", icon: UserCircle2 },
];

const adminSteps: TutorialStep[] = [
  { title: "Live attendance", body: "Monitor today’s attendance, review self-reports, export records, and enter manual corrections.", target: "home", icon: Home },
  { title: "Staff management", body: "Create staff accounts, manage roles, activate or deactivate users, and enroll face verification.", target: "admin", icon: Settings2 },
  { title: "Roster and rewards", body: "Use Piket to manage tasks, assignments, completions, points, and rewards across the workspace.", target: "piket", icon: CalendarDays },
  { title: "Overtime approvals", body: "Review staff overtime requests, approve or reject them, and keep the audit trail current.", target: "ot", icon: Clock3 },
  { title: "Workspace controls", body: "Configure the geofence, GPS coordinates, radius, language, theme, and workspace settings in Admin.", target: "config", icon: MapPin },
];

export function tutorialSteps(role: Role): TutorialStep[] {
  return role === "staff" ? staffSteps : adminSteps;
}

export function TutorialOverlay({ user, step, onStepChange, onClose, onNavigate }: {
  user: User;
  step: number;
  onStepChange: (step: number) => void;
  onClose: (completed?: boolean) => void;
  onNavigate: (target: TutorialTarget) => void;
}) {
  const steps = tutorialSteps(user.role);
  const current = steps[Math.min(step, steps.length - 1)];
  const Icon = current.icon;
  const last = step >= steps.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-amber/35 bg-panel shadow-[0_24px_80px_rgba(0,0,0,.55)]">
        <div className="hazard h-1.5 w-full" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber/12 text-amber"><Icon size={21} /></span>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-faint">Quick tour · {step + 1}/{steps.length}</p>
                <h2 className="ttl mt-1 text-[20px] font-bold leading-tight text-ink">{current.title}</h2>
              </div>
            </div>
            <button onClick={() => onClose(false)} className="tap rounded-lg p-1.5 text-faint hover:text-ink" aria-label="Close tutorial"><X size={18} /></button>
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-mut">{current.body}</p>
          <div className="mt-5 flex gap-1.5" aria-hidden="true">
            {steps.map((item, index) => <span key={item.title} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-amber" : "bg-line2"}`} />)}
          </div>
          <div className="mt-5 flex items-center justify-between gap-2">
            <button onClick={() => onClose(false)} className="tap px-2 py-2 font-mono text-[11px] uppercase tracking-wider text-faint hover:text-ink">Skip for now</button>
            <div className="flex gap-2">
              {step > 0 && <Btn variant="ghost" onClick={() => { onNavigate(steps[step - 1].target); onStepChange(step - 1); }}>Back</Btn>}
              <Btn onClick={() => { onNavigate(current.target); if (last) onClose(true); else onStepChange(step + 1); }}>
                {last ? <><CheckCircle2 size={15} /> Finish</> : <><ArrowRight size={15} /> Next</>}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
