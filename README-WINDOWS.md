# Running Acadexa Locally on Windows

This guide gets the full stack (PostgreSQL + FastAPI backend + React frontend) running on a
single Windows machine for local testing. This is the same setup you'd use to try the Electron
`.exe` against your own local server before pointing it at a real central VPS.

Two ways to run it:
- **Option A (recommended first)** — run everything in a normal browser via `npm run dev`. Fastest
  to get working, easiest to debug.
- **Option B** — run the packaged `Acadexa-Setup-1.0.0.exe` desktop app pointed at your local
  backend. Do this after Option A works.

---

## 0. Prerequisites (install these first)

| Tool | Version | Download |
|---|---|---|
| Python | 3.11+ | https://www.python.org/downloads/windows/ — **check "Add Python to PATH"** during install |
| Node.js | 20 LTS | https://nodejs.org/ |
| PostgreSQL | 16 or 17 | https://www.postgresql.org/download/windows/ |
| Git | latest | https://git-scm.com/download/win |

During the PostgreSQL installer, you'll be asked to set a password for the `postgres` superuser —
remember it, you'll need it once in step 2. Keep "Stack Builder" unchecked (not needed).

Open **PowerShell** (or Command Prompt) for all commands below.

---

## 1. Get the code

Once I've pushed it to your GitHub repo, run:
```powershell
git clone <your-repo-url> acadexa
cd acadexa
```
(If you already have the folder some other way — e.g. copied from this sandbox — just `cd` into it.)

---

## 2. Set up PostgreSQL

Open **pgAdmin** (installed alongside PostgreSQL) or use `psql` from the Start Menu
("SQL Shell (psql)"). Using SQL Shell (psql), press Enter to accept the defaults until it asks
for the postgres password — enter the password you set during install. Then run:

```sql
CREATE USER acadexa WITH PASSWORD 'choose_a_password_here';
CREATE DATABASE acadexa_db OWNER acadexa;
CREATE DATABASE acadexa_test_db OWNER acadexa;
\q
```

Remember the password you chose — you'll put it in `backend\.env` next.

---

## 3. Set up the backend

```powershell
cd acadexa\backend

python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt
```

Copy the Windows env template and edit it:
```powershell
copy .env.windows.example .env
notepad .env
```
In `.env`, set:
- `DATABASE_URL=postgresql+psycopg2://acadexa:choose_a_password_here@localhost:5432/acadexa_db`
  (use the exact password from step 2)
- `SECRET_KEY=` — any long random string (e.g. mash the keyboard for 40+ characters)
- Leave everything else as-is for local testing.

Run migrations and seed default data:
```powershell
alembic upgrade head
python seed.py
```
This creates the default Super Admin login: **admin@acadexa.com / Admin@123**
(change this password once you're logged in, via the Users & Roles page).

Start the backend:
```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Leave this window open. Test it worked by opening **http://localhost:8000/health** in a browser
— you should see `{"status":"ok",...}`. Interactive API docs are at **http://localhost:8000/docs**.

---

## 4. Set up the frontend

Open a **second** PowerShell window (keep the backend running in the first one):
```powershell
cd acadexa\frontend
npm install
npm run dev
```
This starts the Vite dev server (with hot reload) at **http://localhost:5173**, already
configured to proxy `/api` to the backend on port 8000.

Open **http://localhost:5173** in your browser and log in with `admin@acadexa.com` / `Admin@123`.

You now have the full app running locally — Students, Attendance, Marks, Reports, etc. all
working against your local PostgreSQL database.

### PostgreSQL backup/restore feature note
The Backups page uses `pg_dump`/`pg_restore`. On Windows these live inside your PostgreSQL
install, e.g. `C:\Program Files\PostgreSQL\17\bin\`. Either:
- add that folder to your Windows PATH, **or**
- in `backend\.env` set full paths:
  ```
  PG_DUMP_PATH=C:\Program Files\PostgreSQL\17\bin\pg_dump.exe
  PG_RESTORE_PATH=C:\Program Files\PostgreSQL\17\bin\pg_restore.exe
  ```
  then restart the backend (Ctrl+C in its window, re-run the `uvicorn` command).

---

## 5. (Optional) Run the packaged Electron desktop app instead of the browser

If you'd rather use the actual `Acadexa-Setup-1.0.0.exe` desktop app instead of a browser tab:

1. Make sure the backend from step 3 is still running (`http://localhost:8000`).
2. Download and run `Acadexa-Setup-1.0.0.exe` (built for you already — see chat for the download
   link) and follow the installer.
3. Launch **Acadexa** from the Start Menu / desktop shortcut.
4. On first launch you'll see "Connect to your Academy Server" — enter:
   ```
   http://localhost:8000
   ```
   Click **Test Connection** (should say "Connected: Acadexa (development)"), then **Save & Continue**.
5. Log in with `admin@acadexa.com` / `Admin@123`.

To point the desktop app at a different server later (e.g. once you deploy to a real VPS), use
the menu: **Acadexa → Change Server URL...**

> Note: this `.exe` was built and validated (as a well-formed Windows installer) inside a Linux
> sandbox using Wine — this will be its first real run on an actual Windows machine. If the
> installer or app has any issue, tell me the exact error and I'll fix it and rebuild.

---

## 6. Building the Electron app yourself from source (optional, Windows)

If you'd rather build the `.exe` yourself on your own Windows machine (instead of using the one
I already built for you), after step 4 works:

```powershell
cd acadexa\frontend
npm run build

cd ..\electron
npm install
npm run dist:win
```
The installer will be created at `acadexa\electron\release\Acadexa-Setup-1.0.0.exe`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `uvicorn` fails with a DB connection error | Double-check the password/port in `backend\.env` matches what you set in step 2; make sure PostgreSQL service is running (Services app → "postgresql-x64-17" → Running) |
| `alembic upgrade head` fails | Usually means `DATABASE_URL` is wrong, or `acadexa_db` wasn't created — redo step 2 |
| Frontend loads but API calls fail (network error) | Confirm the backend window is still running and shows no errors; confirm you're using `http://localhost:5173` (not opening `frontend/dist/index.html` directly with a `file://` URL — that only works for the Electron app, not a browser) |
| `pip install` fails on `psycopg2-binary` | Make sure you're using 64-bit Python 3.11+ (the wheel is prebuilt, should just work — if not, install "Microsoft C++ Build Tools" from https://visualstudio.microsoft.com/visual-cpp-build-tools/) |
| Electron app shows blank white screen | Confirm the backend is running and the server URL you entered is reachable in a normal browser first |
| Port 8000 or 5173 already in use | Something else is using it — stop that process, or change the port (`--port 8001` for uvicorn; edit `frontend/vite.config.js` `server.port` for Vite, matching the proxy target) |

Once you're comfortable running it locally, the same backend can be moved to a VPS (see the main
`README.md` "Running It Yourself" section) so multiple academy computers can share one live
database over the internet.
