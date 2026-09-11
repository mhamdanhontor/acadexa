# Acadexa — Academy Attendance & Student Management System

## Project Overview
Acadexa is a centralized attendance, marks, and WhatsApp-notification system for academies with
multiple staff computers. One central backend + PostgreSQL database (hosted on a VPS/cloud
server by the academy) is shared live over the internet by every computer running the desktop
app, so attendance/marks entered on one machine are immediately visible everywhere.

**Stack** (as specified): Python + FastAPI + SQLAlchemy + Alembic + PostgreSQL (backend) · React +
Vite + JavaScript (frontend) · Electron (Windows desktop packaging).

## Repository Layout
```
webapp/
├── backend/    FastAPI + SQLAlchemy + Alembic + PostgreSQL API (runs under PM2 as acadexa-backend)
├── frontend/   React + Vite SPA (runs under PM2 as acadexa-frontend, vite preview)
└── electron/   Desktop shell — thin client that points at a central backend URL
```

## What's Complete

### Backend (100% of the 60 backend acceptance-criteria items)
- Auth: JWT login/refresh/me/logout, bcrypt password hashing, RBAC (SUPER_ADMIN / ADMIN / TEACHER)
  with permission-code guards.
- Classes / Batches / Subjects CRUD.
- Students: full CRUD, search (name/code/WhatsApp), filters, pagination, soft-delete only.
- Attendance: bulk transactional save (all-or-nothing — a single invalid student_id fails the
  whole batch with zero rows written), same-date correction via upsert, per-record correction
  endpoint, absence → WhatsApp notification job creation, attendance summary calculation.
- Tests/Marks: configurable period_count per test session (not hardcoded), bulk marks save with
  hard server-side range validation (`0 <= obtained_marks <= total_marks`, HTTP 422
  `INVALID_MARKS_RANGE` otherwise — the frontend can never bypass this), percentage/grade
  computed server-side, marks → notification job creation.
- WhatsApp notifications: provider abstraction (`FakeProvider` for dev/tests, `MetaCloudProvider`
  for real WhatsApp Cloud API), DB-backed job queue, APScheduler background worker polling every
  `NOTIFICATION_WORKER_INTERVAL_SECONDS`, retry with max-3-attempts, templates editable via API.
- Monthly Reports: DRAFT → READY → APPROVED → SENT state machine (a report is *never* auto-sent —
  approval and send are always separate explicit actions), PDF generation (ReportLab), download
  endpoint.
- Excel exports (students/attendance/marks) via openpyxl.
- Dashboard: single aggregate-query summary endpoint (today's attendance, notification counts,
  academics, recent activity feed).
- Audit log: every mutating action recorded (who/what/when), read-only paginated API.
- Backups: `pg_dump`/`pg_restore` via subprocess, list/create/download/restore (SUPER_ADMIN only,
  restore requires explicit `confirm: true`).
- Academy settings API (name/address/contact/logo, late-counts-as-present toggle).
- **Test coverage**: 40 pytest tests against an isolated `acadexa_test_db`, covering auth/RBAC,
  students, attendance (incl. transactional-failure and duplicate-date correction), marks (incl.
  range validation), reports (incl. approval-gating), notification worker/retry. All passing.

### Frontend (all 12 modules built and wired)
Dashboard, Students, Classes, Batches, Subjects, Attendance (daily roster with per-student
status buttons, "mark all present", unsaved-changes browser warning), Tests (sessions + tests),
Marks (bulk entry grid with live client-side range validation mirroring the backend rule),
Reports (generate/approve/send/download), Notifications (job list + retry, template editor),
Users & Roles (SUPER_ADMIN only), Backups (create/download/restore with typed "RESTORE"
confirmation), Audit Logs, Settings (+ data export buttons).

Shared infrastructure: centralized Axios client with automatic JWT refresh-and-retry on 401
(with concurrent-request queueing), `AuthContext` (role/permission helpers), role-gated
navigation and routes, reusable components (Modal, Pagination, StatusBadge, ConfirmDialog, etc.),
`useDebounce`/`useOnlineStatus`/`useUnsavedChangesWarning` hooks.

**Bug caught and fixed during this build**: report/backup/export downloads require a Bearer
token; a plain `<a href>` cannot carry that header. Replaced with a `downloadFile()` helper that
fetches the file as an authenticated blob via the same Axios instance used for every other
request, then triggers the browser download — verified working end-to-end against the live
backend.

### Electron Desktop Shell
A **thin client** — it does not bundle the backend or PostgreSQL. On first launch it shows a
"Connect to your Academy Server" screen (`electron/config-ui/`) where the admin enters the
central server's address; this is tested live (`/health` check) and saved to
`app.getPath('userData')/config.json`, then injected into the React app as
`window.__ACADEXA_API_BASE_URL__` via `preload.js`. The frontend was switched to `HashRouter` +
relative asset paths so the exact same built bundle (`frontend/dist`) works both as a hosted web
app and loaded via `file://` inside Electron.

**Verified in this sandbox**: `electron-builder` successfully produced a real Windows installer —
`Acadexa-Setup-1.0.0.exe` (NSIS, ~81 MB, confirmed valid `PE32 executable ... Nullsoft Installer`
via `file`) — built using Wine directly in this Linux sandbox, plus an unpacked Linux build. The
installer has **not** been run on an actual Windows machine (not possible from here); the admin
should do a first real install/launch to confirm.

## Data Architecture
- **Storage**: PostgreSQL 17 (single central `acadexa_db` for production use; a separate
  `acadexa_test_db` is used only by the pytest suite).
- **Migrations**: Alembic, `backend/migrations/versions/` (1 migration currently: initial schema,
  19 tables).
- **Key tables**: users/roles/permissions, classes/batches/subjects, students, attendance,
  test_sessions/tests/marks, notification_templates/notification_jobs, monthly_reports,
  audit_logs/backups, academy_settings.

## Running It Yourself (VPS / Production)

### Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit DATABASE_URL, SECRET_KEY, CORS_ORIGINS, WHATSAPP_* for your setup
alembic upgrade head
python3 seed.py        # creates default Super Admin admin@acadexa.com / Admin@123 — CHANGE THIS PASSWORD
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Point `DATABASE_URL` at your production PostgreSQL instance. Run this on a VPS reachable from
every academy computer (over HTTPS behind a reverse proxy such as Caddy/Nginx is strongly
recommended for a real deployment — this sandbox build serves plain HTTP for local testing only).

### Frontend (as a hosted web app)
```bash
cd frontend
npm install
npm run build      # outputs frontend/dist
npx vite preview --host 0.0.0.0 --port 5173   # or serve frontend/dist with any static host
```
Set `VITE_API_BASE_URL` at build time (or serve behind the same reverse proxy as the backend
under `/api/v1`) if the frontend and backend are not on the same origin.

### Desktop (.exe) packaging
```bash
cd frontend && npm run build
cd ../electron
npm install
npm run dist:win     # -> electron/release/Acadexa-Setup-1.0.0.exe
```
Distribute the generated `.exe` to each academy computer. On first launch, staff enter the
central server's URL once; it's remembered thereafter (use the "Acadexa → Change Server URL..."
menu to update it later).

## Live Sandbox URLs (testing only, ~1hr lifetime)
- Frontend: https://5173-i92h3nmewyt2e9zidgzza-5185f4aa.sandbox.novita.ai
- Backend: https://8000-i92h3nmewyt2e9zidgzza-5185f4aa.sandbox.novita.ai/health
- Login: `admin@acadexa.com` / `Admin@123`

## Known Limitations / Recommended Next Steps
1. **Password**: change the seeded Super Admin password immediately in any real deployment.
2. **HTTPS/reverse proxy**: the sandbox runs plain HTTP; production must sit behind TLS.
3. **WhatsApp provider**: currently defaults to `fake` (logs instead of sending). Set
   `WHATSAPP_PROVIDER=meta` and supply Meta Cloud API credentials in `.env` to send real messages.
4. **Windows `.exe` not run on real Windows**: built and validated as a well-formed PE32 NSIS
   installer via Wine in this Linux sandbox; a real first-run smoke test on Windows is
   recommended before distributing to academy staff.
5. **Manual test data**: `acadexa_db` still contains sample rows created during development
   smoke-testing (one class/batch/student, a handful of attendance/marks/reports/backups). Wipe
   and reseed (`python3 seed.py`) before real production use.
6. **Tailwind/Font Awesome via CDN**: the frontend loads these from CDN `<script>`/`<link>` tags
   for simplicity — fine for a networked desktop app or hosted web app, but requires internet
   access at app startup (no offline mode).

## Deployment Status
- **Sandbox**: ✅ Backend + Frontend both running live under PM2, fully tested end-to-end.
- **Production VPS**: ❌ Not deployed — this sandbox is Linux/ephemeral, not a persistent host.
  Follow "Running It Yourself" above to deploy to your own VPS + PostgreSQL.
- **Windows `.exe`**: ✅ Built and validated in-sandbox; ⚠️ not yet smoke-tested on real Windows.
- **Tech Stack**: FastAPI + SQLAlchemy + Alembic + PostgreSQL · React + Vite · Electron.
- **Last Updated**: 2026-09-11.
