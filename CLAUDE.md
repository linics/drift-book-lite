# CLAUDE.md

This file gives Claude Code guidance for working in this repository. Treat `AGENTS.md`, `REQUIREMENTS.md`, and the current source as the source of truth if they disagree with older notes.

## Project Overview

`drift-book-lite` is a school library activity system with three Node.js apps:

- Backend: Express + Prisma + SQLite API server
- Student frontend: React 19 + Vite + Tailwind
- Admin frontend: React 19 + Vite + Tailwind

The application code lives under `drift-book-lite/`. Repo-root files mostly cover deployment, requirements, local data, and agent instructions.

## Current Ports And URLs

Use the current environment templates, not older 3001/5173/5174 assumptions:

| Service | Default port | Local URL |
| --- | ---: | --- |
| Backend API | `8080` | `http://localhost:8080/api` |
| Student frontend | `5174` | `http://localhost:5174` |
| Admin frontend | `5175` | `http://localhost:5175` |

For LAN deployment, browser-facing API URLs must use the deployment machine IP, for example `http://192.168.1.50:8080/api`. Do not leave frontend API URLs as `localhost` when other devices need access.

## Repository Workflow

- Check `git status --short --branch` before starting.
- Use a separate branch for each requirement or coherent task. Requirement branches prefer names like `r009`; docs-only branches can use `docs/...`.
- Do not overwrite or revert user changes unless explicitly asked.
- Read existing implementation and tests before changing code.
- Requirement work must update `REQUIREMENTS.md`: status, notes, and change log.
- Before completion, run `git diff --check` and the relevant test commands.
- After merging to `main`, rerun relevant tests on `main` before pushing.

## Setup

Install dependencies independently in each app:

```bash
cd drift-book-lite/backend && npm install
cd ../frontend && npm install
cd ../admin-frontend && npm install
```

For deterministic installs in deployment scripts, use `npm ci`.

## Environment Files

Environment templates:

- Root deployment template: `.env.example`
- Backend local template: `drift-book-lite/backend/.env.example`
- Student frontend template: `drift-book-lite/frontend/.env.example`
- Admin frontend template: `drift-book-lite/admin-frontend/.env.example`

Important backend variables:

| Variable | Purpose | Default or typical value |
| --- | --- | --- |
| `DATABASE_URL` | SQLite database URL | `file:./dev.db` |
| `PORT` | Backend listener port | `8080` |
| `JWT_SECRET` | Admin JWT signing key | change in real deployments |
| `ADMIN_USERNAMES` | Comma-separated admin users | `admin1,admin2,admin3` |
| `ADMIN_PASSWORD` | Initial password for missing admins | change in real deployments |
| `APP_BASE_URL` | Student frontend origin for CORS | `http://localhost:5174` |
| `ADMIN_APP_BASE_URL` | Admin frontend origin for CORS | `http://localhost:5175` |
| `DEFAULT_SITE_ASSETS_DIR` | Default logo/carousel source directory | `drift-book-lite/resources/default-site-assets` |
| `DEFAULT_SENSITIVE_WORDS_DIR` | Default sensitive word source directory | `drift-book-lite/resources/default-sensitive-words` |
| `DEFAULT_BOOK_CATALOG_PATH` | Default 7th-floor book catalog | `drift-book-lite/resources/default-book-catalog/图书馆7楼流通室数据.xlsx` |
| `DEFAULT_STUDENT_ROSTER_PATH` | Optional local default student roster source | `drift-book-lite/resources/default-student-roster/2025学年学生信息.xls` |
| `STUDENT_ROSTER_PATH` | Optional deployment-specific student roster override | takes priority over `DEFAULT_STUDENT_ROSTER_PATH` |
| `TEACHER_ROSTER_PATH` | Cleaned teacher roster source | `drift-book-lite/resources/default-teacher-roster/2025-teachers.txt` |
| `UPLOADS_DIR` | Runtime upload copies | `drift-book-lite/uploads` |

Frontend variables:

- Both frontends use `VITE_API_BASE_URL`.
- In local Vite dev with a proxy, `/api` is valid.
- In LAN/static builds, use the full backend URL with the deployment host IP.

Never use `change-this-secret` or `change-this-password` in production or externally accessible environments.

## Running Locally

Backend:

```bash
cd drift-book-lite/backend
npm run dev
```

Student frontend:

```bash
cd drift-book-lite/frontend
npm run dev
```

Admin frontend:

```bash
cd drift-book-lite/admin-frontend
npm run dev
```

Windows no-Docker helpers live in `scripts/windows/`. The generated backend `.env` should include the default book catalog, default assets, sensitive words, teacher roster, student roster, and uploads paths.

## Database

- Prisma schema: `drift-book-lite/backend/prisma/schema.prisma`
- Development SQLite database: `drift-book-lite/backend/prisma/dev.db`
- Tests recreate `drift-book-lite/backend/prisma/test.db`
- There is no committed Prisma migration directory; current workflows use `npx prisma db push`.

Useful backend commands:

```bash
cd drift-book-lite/backend
npm run prisma:generate
npm run prisma:push
npm test
```

SQLite WAL mode is enabled in `src/lib/prisma.js`; `*.db-wal` and `*.db-shm` files are expected runtime artifacts and must not be committed.

## Testing

Run the matching tests for the area changed:

```bash
cd drift-book-lite/backend && npm test
cd drift-book-lite/frontend && npm test
cd drift-book-lite/admin-frontend && npm test
```

The backend test runner is `node tests/run-tests.js`; it resets `prisma/test.db`, runs `prisma db push`, generates Prisma Client, then runs Vitest. Frontend/admin tests use Vitest.

Deployment/config changes should keep `drift-book-lite/backend/tests/deployment-config.test.js` current.

## Project Structure

```text
.
├── AGENTS.md
├── CLAUDE.md
├── REQUIREMENTS.md
├── README.md
├── docker-compose.yml
├── data/                         # local-only reference files, gitignored
├── scripts/
│   ├── windows/                  # no-Docker Windows helpers
│   └── windows-docker/           # Windows Docker helpers
└── drift-book-lite/
    ├── backend/
    │   ├── prisma/schema.prisma
    │   ├── src/
    │   │   ├── app.js
    │   │   ├── lib/env.js
    │   │   ├── lib/prisma.js
    │   │   ├── routes/
    │   │   └── services/
    │   └── tests/
    ├── frontend/
    ├── admin-frontend/
    └── resources/
        ├── default-book-catalog/
        ├── default-student-roster/  # local roster files are gitignored
        ├── default-site-assets/
        ├── default-sensitive-words/
        └── default-teacher-roster/
```

## Data And Resource Rules

- `data/` is local-only and gitignored. Do not rely on it in application runtime code.
- The default 7th-floor book catalog is committed under `drift-book-lite/resources/default-book-catalog/图书馆7楼流通室数据.xlsx`.
- Student roster files are deployment data and must not be committed. A local default can be placed at `drift-book-lite/resources/default-student-roster/2025学年学生信息.xls`; `STUDENT_ROSTER_PATH` may override it in deployments.
- Default site images are committed under `drift-book-lite/resources/default-site-assets`.
- Default sensitive word files are committed under `drift-book-lite/resources/default-sensitive-words`.
- The cleaned teacher roster is committed under `drift-book-lite/resources/default-teacher-roster/2025-teachers.txt`.
- Uploaded runtime copies live under `UPLOADS_DIR`; do not delete them unless no configuration references them.

## Current Functional Notes

- R-001 completed: large catalog import and bad-batch deletion were optimized/fixed.
- R-002 completed: admin users can manage passwords independently; bootstrap only creates missing accounts.
- R-003 completed: admin carousel deletion removes uploaded copies while preserving default source assets.
- R-008 completed: SQLite WAL, compression, sensitive word cache, and homepage cache are in place.
- R-009 completed: teacher roster uses a cleaned one-time built-in list; teacher review submissions validate by teacher name only.
- R-004, R-005, R-006, R-007, and R-010 still require confirmation or future implementation. Check `REQUIREMENTS.md` for exact status.

## Backend Behavior Pointers

- Public routes: `drift-book-lite/backend/src/routes/public.js`
- Admin routes: `drift-book-lite/backend/src/routes/admin.js`
- Core library/review/import logic: `drift-book-lite/backend/src/services/library.js`
- Student roster logic: `drift-book-lite/backend/src/services/studentRoster.js`
- Teacher roster logic: `drift-book-lite/backend/src/services/teacherRoster.js`
- Default sensitive word import: `drift-book-lite/backend/src/services/defaultSensitiveWords.js`
- Site assets: `drift-book-lite/backend/src/services/assets.js`

Review identity behavior:

- Student submissions require system ID and student name; ID-card suffix is checked when present in the roster.
- Teacher submissions require teacher name and validate against `TeacherRoster.normalizedName`.
- Public display names are derived server-side; teacher reviews display as `教师 {姓名}`.

Cache invalidation:

- Sensitive words cache TTL: 60 seconds.
- Homepage cache TTL: 30 seconds.
- Mutations that affect sensitive words, review status, or featured reviews should invalidate the related cache.

## Deployment Notes

Docker Compose still exists and is covered by deployment config tests, but R-006 tracks simplifying deployment and reducing Docker dependence. For school Windows deployments, prefer the maintained no-Docker instructions in `scripts/windows/WINDOWS-NO-DOCKER-DEPLOY.md` unless the user explicitly wants Docker.

Root `.env` drives Docker Compose:

- `BACKEND_PORT`, `FRONTEND_PORT`, `ADMIN_FRONTEND_PORT`
- `APP_BASE_URL`, `ADMIN_APP_BASE_URL`
- `FRONTEND_API_BASE_URL`, `ADMIN_FRONTEND_API_BASE_URL`
- `JWT_SECRET`, `ADMIN_USERNAMES`, `ADMIN_PASSWORD`
- Student and teacher roster paths are set inside `docker-compose.yml` to container paths.

When adding a new bundled resource directory, update all of these together:

- `docker-compose.yml`
- `.env.example`
- `drift-book-lite/backend/.env.example`
- Windows deploy scripts if they generate `.env`
- README/deployment docs
- `deployment-config.test.js`

## Completion Checklist

Before saying a task is done:

```bash
git status --short --branch
git diff --check
```

Then run the relevant test commands and report exact results. If work was merged to `main`, rerun relevant tests on `main` before pushing.
