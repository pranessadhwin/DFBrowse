# DFBrowse

A focused study browser and policy management system. DFBrowse only allows websites on your study allowlist, and modifying the allowlist is protected by a **Feature Password**.

DFBrowse is available in two modes:
1. **Full-Stack Web Application** (React, TypeScript, Node.js, Express, PostgreSQL)
2. **Desktop Electron App** (Windows / macOS / Linux)

---

## 1. Web Application (Full-Stack React + Node.js + PostgreSQL)

The web application brings DFBrowse's strict allowlist study environment to any browser, powered by a Multi-User SaaS PostgreSQL backend and a React + TypeScript frontend.

### Architecture

```
DFBrowse/
├── client/          # React 18 + TypeScript + Vite + CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── BrowserToolbar.tsx   # URL bar, Back/Forward, Focus Status Pill
│   │   │   ├── Sidebar.tsx          # Focus Timer (25m/5m), Allowed list, Quick Notes
│   │   │   ├── HomeScreen.tsx       # Quick-launch study links
│   │   │   ├── ProxyWebView.tsx     # Proxied study frame & interactive launch view
│   │   │   ├── AllowlistModal.tsx   # Feature-Password protected allowlist manager
│   │   │   ├── AuthModal.tsx        # Multi-user authentication & demo switcher
│   │   │   └── StudyStatsModal.tsx  # PostgreSQL navigation logs & session analytics
│   │   └── services/api.ts          # API client wrapper
├── server/          # Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── config/db.ts             # PostgreSQL connection & schema initializer
│   │   ├── routes/
│   │   │   ├── auth.ts              # Login, register, feature-password verify
│   │   │   ├── allowlist.ts         # User allowlist CRUD & domain normalization
│   │   │   ├── study.ts             # Study sessions, navigation audit logs, quick notes
│   │   │   └── proxy.ts             # Secure focus proxy (/api/proxy/check & /view)
│   │   └── utils/                   # Ported policy logic & scrypt password hashing
```

### Key Web Features

- **Backend-Proxied Study Browser (`/api/proxy`)**: Validates domain names against the user's allowlist policy. Allowed sites are proxied/rendered in a focus view; unapproved sites are blocked with a clear focus warning.
- **Multi-User PostgreSQL Schema**:
  - `users`: Account login & optional feature password hash.
  - `allowed_sites`: User-specific allowed domain list (`leetcode.com`, `claude.ai`, `github.com`, etc.).
  - `study_sessions`: Records completed 25-minute focus timer and 5-minute break sessions.
  - `navigation_logs`: Persistent audit log of all `ALLOWED` and `BLOCKED` navigation attempts.
  - `user_notes`: Persistent quick study notes.
- **Feature Password Protection**: Changing or resetting the allowlist requires entering the user's Feature Password (`4321` by default), preventing impulsive distractions during study time.
- **Zero-Config Database Startup**:
  - Connects to a standard PostgreSQL database when `DATABASE_URL` is provided.
  - Automatically falls back to an embedded PostgreSQL engine (`@electric-sql/pglite`) in `./server/data/pglite-db` when no external PostgreSQL server is set.

### Getting Started (Web Application)

#### Demo Account
A default student account is automatically seeded on startup:
- **Email**: `student@dfbrowse.com`
- **Password**: `study123`
- **Feature Password**: `4321`

#### Commands
```bash
# Install dependencies for root, client, and server
npm install
cd client && npm install
cd ../server && npm install && cd ..

# Run production build (compiles client React SPA and server TS)
npm run build:web

# Start all-in-one production server on http://0.0.0.0:3001
npm run start:web

# Or run client and server in dev mode concurrently
npm run dev
```

---

## 2. Desktop Application (Electron)

### Install on Windows

1. Download **DFBrowseSetup-1.0.0.exe** from the [Releases](https://github.com/pranessadhwin/DFBrowse/releases) page.
2. Run the installer (it installs like any other browser — you can choose the install folder and whether to create shortcuts).
3. Open DFBrowse and click **Set default** in the banner at the top, or set it in **Windows Settings → Apps → Default apps → Web browser**. Once set, links you click anywhere in Windows open directly in DFBrowse.

### Development (Electron)

```bash
npm install          # install dependencies
npm run start:electron # run Electron desktop app from source
npm run build:win    # build the Windows installer (NSIS)
npm run test:policy  # run policy unit tests
```

The Windows installer is also built automatically by GitHub Actions (`.github/workflows/build-windows.yml`) and published as a release.
