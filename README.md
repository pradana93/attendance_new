# ShiftGate — Warehouse Attendance OS

A mobile-first web application for warehouse staff attendance, piket (duty roster) management, points & rewards, overtime and performance analytics. The current build requires a Supabase production data layer; local browser storage is used only for workspace bootstrap/configuration.

![stack](https://img.shields.io/badge/React-18-blue) ![stack](https://img.shields.io/badge/TypeScript-5.7-blue) ![stack](https://img.shields.io/badge/Tailwind-4-cyan) ![stack](https://img.shields.io/badge/Vite-6-purple) ![stack](https://img.shields.io/badge/Leaflet-1.9-green)

---

## Quick start

```bash
npm install
npm run dev        # local development
npm run build      # production build → dist/
```

Open the app, complete the **first-run setup wizard**, then sign in.

The first-run wizard creates an empty workspace and the administrator account entered during setup. No demo accounts or seeded attendance history are created.

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
- **Supabase connection wizard** (Admin → Cloud): credentials → schema check → connection status. Schema installation must be run in Supabase SQL Editor.

### Platform
- **Bilingual**: English / Bahasa Indonesia (persisted).
- Authentication must be provided by Supabase Auth before production deployment.
- **Android back-button support**: hardware back closes open sheets first, then steps back through tabs/admin sections instead of killing the WebApp. A visible back button appears in the header.
- Bottom navigation respects device safe-area insets.
- In-app **changelog** (Me tab and login footer).

## Authentication and data status

The browser UI currently has workspace bootstrap and local configuration only. Supabase Auth, server-side authorization, and CRUD synchronization for attendance, rosters, overtime, points, and files still need to be implemented before go-live.

## Data layer

The UI cache (`src/lib/store.ts`) is in-memory only. Production records are read from and written to Supabase.

```
users · attendance · piket_tasks · template (task × day × assignee) · piket_log
point_events · redeem_items · redemptions · overtime · leaves
notifications · announcements · settings (incl. supabase config)
```

`Admin → Cloud → Schema preview` contains the Postgres DDL. Run the SQL in the Supabase SQL Editor, then use the wizard to verify that `public.settings` is available.

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
