import { useState } from "react";
import { Camera, Check, ChevronDown, Filter, MessageSquare, Plus, Search, Trash2, X } from "lucide-react";
import type { Feedback, User } from "../types";
import { getDB, submitFeedback, updateFeedbackStatus, deleteFeedback, userName } from "../lib/store";
import { useT } from "../lib/i18n";
import { Avatar, Btn, Chip, Confirm, Empty, Field, SectionTitle, Seg, Sheet, StatusBadge, toast } from "../components/ui";
import { takePhoto } from "../components/capture";

export function FeedbackSheet({ open, onClose, user }: { open: boolean; onClose: () => void; user: User }) {
  const t = useT();
  const [type, setType] = useState<Feedback["type"]>("bug");
  const [priority, setPriority] = useState<Feedback["priority"]>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [screenshot, setScreenshot] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const db = getDB();

  const handleSubmit = () => {
    setBusy(true);
    setTimeout(() => {
      const res = submitFeedback({
        userId: user.id,
        type,
        priority,
        title,
        description,
        screenshot,
        contactEmail: contactEmail.trim() || undefined,
        route: window.location.hash,
      });
      setBusy(false);
      if (res.ok) {
        toast(res.msg, "ok");
        onClose();
        setTitle("");
        setDescription("");
        setScreenshot(undefined);
        setContactEmail("");
      } else {
        toast(res.msg, "err");
      }
    }, 500);
  };

  const handleTakePhoto = async () => {
    try {
      const dataUrl = await takePhoto();
      setScreenshot(dataUrl);
    } catch {
      // cancelled or failed
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("fb.title")}>
      <div className="space-y-3.5">
        {/* type */}
        <Field label={t("fb.type")}>
          <Seg
            options={[
              { id: "bug", label: t("fb.type.bug") },
              { id: "idea", label: t("fb.type.idea") },
              { id: "general", label: t("fb.type.general") },
              { id: "praise", label: t("fb.type.praise") },
            ]}
            value={type}
            onChange={(v) => setType(v as Feedback["type"])}
          />
        </Field>

        {/* priority */}
        <Field label={t("fb.priority")}>
          <Seg
            options={[
              { id: "low", label: t("fb.prio.low") },
              { id: "medium", label: t("fb.prio.medium") },
              { id: "high", label: t("fb.prio.high") },
              { id: "urgent", label: t("fb.prio.urgent") },
            ]}
            value={priority}
            onChange={(v) => setPriority(v as Feedback["priority"])}
          />
        </Field>

        {/* title */}
        <Field label={t("fb.titleL")}>
          <input
            className="inp"
            type="text"
            placeholder="Brief summary…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        {/* description */}
        <Field label={t("fb.description")}>
          <textarea
            className="inp min-h-[90px] resize-none"
            placeholder="Describe the issue or idea in detail…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        {/* screenshot */}
        <Field label={t("fb.screenshot")}>
          <div className="flex items-center gap-2">
            <Btn variant="ghost" onClick={handleTakePhoto}>
              <Camera size={14} /> {screenshot ? "Change photo" : "Take photo"}
            </Btn>
            {screenshot && (
              <button
                onClick={() => setScreenshot(undefined)}
                className="tap flex items-center gap-1 rounded-lg border border-line bg-panel2 px-2 py-1 text-[11px] text-mut hover:text-bad"
              >
                <X size={12} /> Remove
              </button>
            )}
          </div>
          {screenshot && (
            <img src={screenshot} alt="screenshot" className="mt-2 h-32 w-full rounded-xl border border-line object-cover" />
          )}
        </Field>

        {/* contact email */}
        <Field label={t("fb.contactEmail")} hint={t("c.optional")}>
          <input
            className="inp"
            type="email"
            placeholder="you@example.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </Field>

        {/* submit */}
        <Btn className="w-full" busy={busy} disabled={!title.trim() || !description.trim()} onClick={handleSubmit}>
          <MessageSquare size={15} /> {t("fb.submit")}
        </Btn>

        {/* route info */}
        {db && (
          <p className="font-mono text-[9.5px] text-faint">
            {t("fb.route")}: <span className="text-mut">{window.location.hash || "/"}</span> · v{db.settings.appName}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/* ================= Admin Feedback Inbox ================= */
type FbFilter = "all" | "bug" | "idea";
type FbSort = "newest" | "priority";

export function FeedbackInbox({ admin }: { admin: User }) {
  const db = getDB();
  const t = useT();
  const [filter, setFilter] = useState<FbFilter>("all");
  const [sort, setSort] = useState<FbSort>("newest");
  const [selectedFb, setSelectedFb] = useState<Feedback | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!db) return null;

  let fbs = db.feedback.slice();

  // filter
  if (filter !== "all") {
    fbs = fbs.filter((f) => f.type === filter);
  }

  // sort
  if (sort === "newest") {
    fbs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else {
    const prioOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    fbs.sort((a, b) => prioOrder[a.priority] - prioOrder[b.priority] || b.createdAt.localeCompare(a.createdAt));
  }

  const stats = {
    all: db.feedback.length,
    bug: db.feedback.filter((f) => f.type === "bug").length,
    idea: db.feedback.filter((f) => f.type === "idea").length,
    new: db.feedback.filter((f) => f.status === "new").length,
  };

  return (
    <div className="a-fadein space-y-3">
      <SectionTitle right={<Chip tone="amber">{stats.all} total</Chip>}>{t("fb.inbox")}</SectionTitle>

      {/* filters */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <Seg
          options={[
            { id: "all", label: t("fb.filter.all") },
            { id: "bug", label: t("fb.filter.bug") },
            { id: "idea", label: t("fb.filter.idea") },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as FbFilter)}
        />
        <div className="ml-auto flex items-center gap-1.5">
          <Filter size={13} className="text-faint" />
          <select
            className="font-mono text-[11px] text-mut"
            value={sort}
            onChange={(e) => setSort(e.target.value as FbSort)}
          >
            <option value="newest">Newest first</option>
            <option value="priority">By priority</option>
          </select>
        </div>
      </div>

      {/* list */}
      {fbs.length === 0 ? (
        <Empty icon={<MessageSquare size={28} />} title={t("fb.noFeedback")} sub={t("fb.noFeedbackSub")} />
      ) : (
        <div className="card divide-y divide-line2">
          {fbs.map((fb) => {
            const u = db.users.find((x) => x.id === fb.userId);
            return (
              <button
                key={fb.id}
                onClick={() => setSelectedFb(fb)}
                className="tap flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-panel2/50"
              >
                <Avatar user={u ?? { name: "Unknown", avatarHue: 0 }} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="ttl truncate text-[13px] font-bold text-ink">{fb.title}</p>
                    <StatusBadge status={fb.status} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <Chip tone={fb.type === "bug" ? "bad" : fb.type === "idea" ? "cool" : "mut"}>{fb.type}</Chip>
                    <Chip tone={fb.priority === "urgent" ? "bad" : fb.priority === "high" ? "amber" : "mut"}>
                      {fb.priority}
                    </Chip>
                    <span className="font-mono text-[9.5px] text-faint">{u?.name ?? "Unknown"}</span>
                    <span className="font-mono text-[9.5px] text-faint">· {new Date(fb.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* detail sheet */}
      {selectedFb && (
        <FeedbackDetail
          fb={selectedFb}
          admin={admin}
          onClose={() => setSelectedFb(null)}
          onDelete={() => setDeleteId(selectedFb.id)}
        />
      )}

      {/* delete confirm */}
      <Confirm
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onYes={() => {
          if (deleteId) deleteFeedback(deleteId);
          setDeleteId(null);
          setSelectedFb(null);
          toast("Feedback deleted", "ok");
        }}
        danger
        title={t("fb.deleteQ")}
        body={t("fb.deleteBody")}
        yesLabel={t("c.delete")}
      />
    </div>
  );
}

function FeedbackDetail({
  fb,
  admin,
  onClose,
  onDelete,
}: {
  fb: Feedback;
  admin: User;
  onClose: () => void;
  onDelete: () => void;
}) {
  const db = getDB();
  const t = useT();
  const [status, setStatus] = useState(fb.status);
  const [note, setNote] = useState(fb.adminNote || "");
  const u = db?.users.find((x) => x.id === fb.userId);

  const handleStatusChange = (s: Feedback["status"]) => {
    setStatus(s);
    updateFeedbackStatus(fb.id, s, admin.id, note);
    toast(`Status: ${s}`, "ok");
  };

  const handleSaveNote = () => {
    updateFeedbackStatus(fb.id, status, admin.id, note);
    toast("Admin note saved", "ok");
  };

  return (
    <Sheet open={true} onClose={onClose} title="Feedback detail" wide>
      <div className="space-y-4">
        {/* header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="ttl text-[17px] font-bold text-ink">{fb.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Chip tone={fb.type === "bug" ? "bad" : "cool"}>{fb.type}</Chip>
              <Chip tone={fb.priority === "urgent" ? "bad" : fb.priority === "high" ? "amber" : "mut"}>{fb.priority}</Chip>
              <StatusBadge status={fb.status} />
            </div>
          </div>
          <Btn variant="danger" onClick={onDelete}><Trash2 size={14} /></Btn>
        </div>

        {/* author */}
        <div className="flex items-center gap-2 rounded-xl border border-line bg-panel2/50 px-3 py-2">
          <Avatar user={u ?? { name: "Unknown", avatarHue: 0 }} size={32} />
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-ink">{u?.name ?? "Unknown user"}</p>
            <p className="font-mono text-[10px] text-faint">{u?.email ?? "-"}</p>
          </div>
          <span className="ml-auto font-mono text-[9.5px] text-faint">{new Date(fb.createdAt).toLocaleString()}</span>
        </div>

        {/* description */}
        <div className="rounded-xl border border-line bg-panel2/30 p-3">
          <p className="text-[13px] leading-relaxed text-ink whitespace-pre-wrap">{fb.description}</p>
          {fb.screenshot && (
            <img src={fb.screenshot} alt="screenshot" className="mt-2 max-h-48 w-full rounded-lg border border-line object-contain" />
          )}
        </div>

        {/* metadata */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line bg-panel2/30 px-3 py-2">
            <p className="font-mono text-[9px] uppercase text-faint">Route</p>
            <p className="font-mono text-[11px] text-ink">{fb.route || "-"}</p>
          </div>
          <div className="rounded-lg border border-line bg-panel2/30 px-3 py-2">
            <p className="font-mono text-[9px] uppercase text-faint">App version</p>
            <p className="font-mono text-[11px] text-ink">{fb.appVersion || "-"}</p>
          </div>
        </div>

        {/* status actions */}
        <div className="space-y-2">
          <p className="ttl text-[12px] font-bold text-mut">{t("fb.status")}</p>
          <Seg
            options={[
              { id: "new", label: t("fb.status.new") },
              { id: "in_review", label: t("fb.status.in_review") },
              { id: "planned", label: t("fb.status.planned") },
              { id: "in_progress", label: t("fb.status.in_progress") },
              { id: "shipped", label: t("fb.status.shipped") },
              { id: "wont_fix", label: t("fb.status.wont_fix") },
            ]}
            value={status}
            onChange={(v) => handleStatusChange(v as Feedback["status"])}
          />
        </div>

        {/* admin note */}
        <div className="space-y-2">
          <p className="ttl text-[12px] font-bold text-mut">{t("fb.adminNote")}</p>
          <textarea
            className="inp min-h-[60px] resize-none"
            placeholder="Internal notes for the team…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Btn variant="ghost" onClick={handleSaveNote}><Check size={14} /> Save note</Btn>
        </div>

        {/* decided info */}
        {fb.decidedAt && (
          <div className="rounded-lg border border-line bg-panel2/30 px-3 py-2">
            <p className="font-mono text-[9px] uppercase text-faint">{t("fb.decidedBy")}</p>
            <p className="text-[11.5px] text-ink">{userName(fb.decidedBy!)} · {new Date(fb.decidedAt).toLocaleString()}</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
