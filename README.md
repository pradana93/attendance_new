# ShiftGate — Warehouse Attendance OS

A mobile-first web application for warehouse staff attendance, piket (duty roster) management, points & rewards, overtime and performance analytics. Built as a **local-first** prototype that mirrors a Supabase schema, so it runs fully offline today and syncs to Postgres tomorrow.

![stack](https://img.shields.io/badge/React-18-blue) ![stack](https://img.shields.io/badge/TypeScript-5.7-blue) ![stack](https://img.shields.io/badge/Tailwind-4-cyan) ![stack](https://img.shields.io/badge/Vite-6-purple) ![stack](https://img.shields.io/badge/Leaflet-1.9-green)

---

## Quick start

```bash
npm install
npm run dev        # local development
npm run build      # production build → dist/
```

Open the app, complete the **first-run setup wizard**, then sign in.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| **Super Admin** | `majestap93@gmail.com` | `super123` |
| Admin | `rina@nusalogistik.id` | `shift123` |
| Staff | `agus@nusalogistik.id` | `shift123` |
| Staff (all others) | `*@nusalogistik.id` | `shift123` |

**Admin extras (v1.5):** edit any account via the pencil icon on the Staff list (name, email, employee ID, department, role — Super Admin locked), and review every submitted proof photo in the **Photos** gallery section.

> The Super Admin credential is **permanently fixed** and re-enforced on every load — setup creates the workspace around it.

## Feature map

### Core attendance
- **GPS-first check-in** — a Leaflet geofence map shows the warehouse footprint, radius circle and your live position *before* verification. Punching is locked outside the radius (configurable, default 100 m).
- **Face verification flow** — camera preflight, scan-beam viewfinder, staged matching (80% threshold), late detection against a configurable threshold.
- **QR badge fallback**, **self-report** entry for out-of-radius cases (admin review required), and **manual admin override**.
- Live floor board with on-duty pulse, late flags and auto-refresh.

### Piket (duty roster)
- Task catalog seeded with real warehouse duties: *Harian Depan / Tengah / Belakang*, *Tutup Rolling Door*, *Foto Suhu Container 20ft / 40ft*.
- **Customizable Mon–Sat weekly template** — assign staff per task × day, auto-rotate the week, add/edit tasks with points and photo-proof requirements.
- Staff week view with photo-proof completion, points ledger and a **rewards catalog** (stock, redemption history).

### Analytics & overtime
- Attendance ring, YTD bars, monthly heatmap, streaks, rule-based insights.
- **Top performance podium**, watchlist and team rank (performance score = attendance × punctuality × points).
- Overtime requests with approval notes, **IDR payout estimates**, overlap guard and CSV export.

### Admin console
- Staff management (roles, departments, face enrollment, activation), announcements, geofence/rate settings, dark mode, language.
- **Supabase deploy wizard** (Admin → Cloud): credentials → schema migration → connection test → SQL schema preview → sync.

### Platform
- **Bilingual**: English / Bahasa Indonesia (persisted).
- **Password reset via Gmail SMTP relay** (`smtp.gmail.com:587`, STARTTLS) with tokenized links — see *Authentication* below.
- **Android back-button support**: hardware back closes open sheets first, then steps back through tabs/admin sections instead of killing the WebApp. A visible back button appears in the header.
- Bottom navigation respects device safe-area insets.
- In-app **changelog** (Me tab and login footer).

## Authentication & password reset

- Sessions are JWT-shaped (1 h expiry, auto-renew) stored in `localStorage` (Remember me) or `sessionStorage`.
- **Forgot password** flow: request → relay log (`AUTH LOGIN → MAIL FROM → RCPT TO → 250 OK`) → tokenized reset link (30 min) → set new password. In this prototype the email step is simulated with an in-app inbox preview; point `SMTP_RELAY` in `src/lib/store.ts` at your real relay (e.g. a Supabase Edge Function with Nodemailer) for production delivery.
- Passwords in the demo store are plain text for inspection only — replace with Supabase Auth (`auth.users`) before go-live.

## Data layer

Local-first store (`src/lib/store.ts`) persisted to `localStorage`, shaped to the production schema:

```
users · attendance · piket_tasks · template (task × day × assignee) · piket_log
point_events · redeem_items · redemptions · overtime · leaves
notifications · announcements · settings (incl. supabase config)
```

`Admin → Cloud → Schema preview` contains the full Postgres DDL. The version key auto-migrates older demo databases on load.

## Project structure

```
src/
├── components/      ui kit (sheets, toasts, chips) + SVG charts
├── features/        dashboard · schedule(piket) · performance · overtime · admin · me · auth · setup
├── lib/             store.ts (data) · i18n.ts (EN/ID) · changelog.tsx · util.ts
└── types.ts         domain model (mirrors the Supabase schema)
```

## Roadmap notes

- Swap the simulated face matcher for `face-api.js` descriptors.
- Real-time floor board via Supabase Realtime channels.
- Service-worker offline queue for punches made out of coverage.

---

**ShiftGate** · v1.4.0 · local-first build — see the in-app changelog for release history.
