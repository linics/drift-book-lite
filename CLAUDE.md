# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**drift-book-lite** is a school library management system consisting of three Node.js applications:
- **Backend** (Express + Prisma + SQLite): REST API server
- **Frontend** (React 19 + Vite + Tailwind): Student-facing web interface
- **Admin Frontend** (React 19 + Vite + Tailwind): Administrator management console

The codebase uses a monorepo structure under `drift-book-lite/` with independent `package.json` files per application.

## Architecture & Key Decisions

### Database Design
- **SQLite with WAL mode** for better concurrency (R-008 optimization)
- **Prisma ORM** for type-safe database access
- Database file: `drift-book-lite/backend/prisma/dev.db` (development)
- Core entities: `AdminUser`, `Book`, `BookReview`, `StudentRoster`, `ImportBatch`, `SiteAsset`, `SensitiveWord`

### Backend Performance (R-008)
The backend includes the following optimizations to support ~100 concurrent users:
1. **SQLite WAL mode** (`PRAGMA journal_mode=WAL`) for parallel reads with writes
2. **gzip compression** via Express middleware for JSON responses (60-80% reduction)
3. **Module-level TTL caching**: sensitive words (60s), homepage data (30s)
4. **HTTP Cache-Control headers** on static/frequently-accessed endpoints (1hr for assets, 30-60s for data)

Sensitive word cache invalidation triggered after CRUD operations; homepage cache invalidated after review status/featured flag changes.

### Authentication & Authorization
- JWT-based admin authentication via `adminRouter` (`src/routes/admin.js`)
- Public endpoints in `publicRouter` (`src/routes/public.js`)
- Middleware checks `req.adminUser` populated from JWT

## Development Workflow

### Initial Setup
```bash
cd drift-book-lite/backend && npm install
cd drift-book-lite/frontend && npm install
cd drift-book-lite/admin-frontend && npm install
```

### Running Applications

**Backend** (runs on port 3001):
```bash
cd drift-book-lite/backend
npm run dev                    # Run with nodemon
npm test                       # Run full test suite
npm test -- --testNamePattern="specific test" # Run single test
```

**Frontend** (runs on port 5173):
```bash
cd drift-book-lite/frontend
npm run dev                    # Vite dev server
npm run build                  # Production build
```

**Admin Frontend** (runs on port 5174):
```bash
cd drift-book-lite/admin-frontend
npm run dev
npm run build
```

### Environment Configuration
Create `.env` files in respective app directories:

**Backend** (`drift-book-lite/backend/.env`):
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174"
# UPLOADS_DIR defaults to drift-book-lite/uploads; omit or use absolute path
```

### Database Migrations
```bash
cd drift-book-lite/backend
npx prisma migrate dev --name "migration name"  # Create and apply migration
npx prisma db push                              # Push schema to database
npx prisma studio                               # Launch Prisma Studio (GUI)
```

## File Organization

```
drift-book-lite/
├── backend/
│   ├── src/
│   │   ├── app.js                        # Express app setup
│   │   ├── server.js                     # Server entry point
│   │   ├── lib/
│   │   │   ├── prisma.js                 # Prisma client + WAL pragmas
│   │   │   └── env.js                    # Environment variable loading
│   │   ├── services/
│   │   │   ├── library.js                # Core book/review/sensitive-word logic + caching
│   │   │   ├── assets.js                 # Site assets (carousel, logo)
│   │   │   ├── bootstrap.js              # Admin user initialization
│   │   │   ├── defaultSensitiveWords.js  # Default word list import from resources/
│   │   │   └── studentRoster.js          # Student data helpers
│   │   ├── routes/
│   │   │   ├── public.js                 # Public API endpoints
│   │   │   └── admin.js                  # Admin-protected endpoints
│   │   ├── middleware/
│   │   │   ├── adminAuth.js              # JWT authentication guard
│   │   │   └── uploads.js                # Multer file upload handlers
│   │   └── utils/
│   │       ├── auth.js                   # JWT signing + password verification
│   │       ├── httpError.js              # Custom error class
│   │       └── paths.js                  # Path utilities
│   ├── prisma/
│   │   ├── schema.prisma                 # Database schema
│   │   └── dev.db                        # SQLite database (dev)
│   └── package.json
├── frontend/                              # Student interface
│   ├── src/
│   │   ├── components/                   # React components
│   │   ├── pages/                        # Page-level components
│   │   ├── hooks/                        # Custom React hooks
│   │   ├── lib/                          # API client + helpers
│   │   ├── App.jsx
│   │   └── main.jsx                      # Entry point
│   ├── vite.config.js
│   └── package.json
└── admin-frontend/                        # Admin interface
    └── [same structure as frontend]
```

## Testing & Quality

### Backend Tests
Tests live in `drift-book-lite/backend/test/` and use Node's built-in test runner.

Run tests:
```bash
npm test                       # Run all tests
npm test -- --grep "pattern"  # Filter by test name
```

Key test areas:
- Sensitive word detection and caching invalidation
- Admin CRUD operations
- File upload/import logic
- Cache TTL behavior

### Code Review
The project uses Codex for adversarial code review:
```bash
/codex:review --base main     # Review working tree against main
```

## Deployment

### Docker Deployment
The project includes Docker support:
```bash
docker-compose up                    # Run all three services
docker-compose down                  # Stop services
```

Services run on:
- Backend: http://localhost:3001
- Frontend: http://localhost:5173
- Admin: http://localhost:5174

### Environment Variables for Production
Set via `.env` or container env vars:
- `DATABASE_URL`: Prisma connection string
- `JWT_SECRET`: Secure random key
- `ALLOWED_ORIGINS`: CORS whitelist
- `UPLOADS_DIR`: File upload directory path

## Key Implementation Details

### Cache Invalidation Pattern
When writing admin endpoints that modify sensitive words or review data:
1. Import invalidation functions from `library.js`:
   ```javascript
   const { invalidateSensitiveWordsCache, invalidateHomepageCache } = require("../services/library");
   ```
2. Call after mutations:
   ```javascript
   await prisma.sensitiveWord.create(...);
   invalidateSensitiveWordsCache();  // Clear TTL cache
   ```

### Data & Reference Files
Project-level reference files (CSV/XLSX book catalogs, requirement docs) live in `data/` at the repo root. This directory is gitignored and not committed — files there are local-only and will not be present after a clean clone.

Application-level resources (default site assets, sensitive word lists) live in `drift-book-lite/resources/`.

**Student roster** has deployment-specific paths and must NOT be placed in `data/`:
- Docker: `./2025学年学生信息.xls` at repo root (mounted by `docker-compose.yml`)
- Windows no-Docker: `package-data\student-roster.xls` (falls back to root `2025学年学生信息.xls`)

Placing the roster under `data/` will cause `loadStudentRosterRows()` to return an empty set and student identity validation to fail.

### API Response Format
All endpoints return JSON with consistent error handling:
- Success: `{ data: {...} }` or direct data for simple responses
- Error: `{ message: "User-friendly error message" }` (HTTP status codes: 400 for validation, 409 for conflicts, 500 for server errors)

### File Uploads
- Stored in `drift-book-lite/uploads/` (default; override with absolute `UPLOADS_DIR` env var)
- Served via `GET /uploads/:filename`
- Multer middleware validates and limits file size

## Current Status & Requirements

**Completed (P0-P1)**:
- R-001: Large file import optimization (batch strategies, transaction fixes)
- R-002: Admin password management (independent per-admin, safe initialization)
- R-003: Carousel asset deletion
- R-008: Backend performance optimizations (WAL mode, gzip, caching)

**In Progress / Pending**:
- R-004: Student data import (needs student ID format confirmation)
- R-005: Review export functionality (needs format and schema design)
- R-006: Non-Docker deployment simplification
- R-007: Frontend text/UX refinements
- R-009: Teacher data import (future scope)
- R-010: iPad whitelist access control (likely network-level, not code)

See `REQUIREMENTS.md` for detailed status and notes.

## Debugging Tips

**Backend doesn't start?**
- Check `.env` file exists with `DATABASE_URL` set
- Verify no port 3001 conflict: `lsof -i :3001`
- Check Prisma migrations applied: `npx prisma migrate status`

**Database locked or slow?**
- WAL files (`*.db-wal`, `*.db-shm`) appearing is normal and expected
- Check `.gitignore` includes WAL test artifacts
- SQLite is write-limited; if hit production limits, consider PostgreSQL

**Admin login fails?**
- Ensure admin user created: `npm run bootstrap` (if script available)
- Check JWT_SECRET set in both backend and frontend `.env`
- Verify token expiry not the issue

**Cache not updating?**
- Check invalidation functions called after mutations
- TTL timeout: sensitive words (60s), homepage (30s)
- Use `npm test` to verify cache behavior

## Quick Reference

| Task | Command |
|------|---------|
| Dev: Start all services | `npm run dev` (in each `drift-book-lite/*` dir) |
| Dev: Run backend tests | `cd drift-book-lite/backend && npm test` |
| Dev: Reset database | `rm drift-book-lite/backend/prisma/dev.db && npx prisma migrate dev` |
| Lint/Format | Check individual `package.json` for eslint/prettier scripts |
| Build for production | `npm run build` in frontend and admin-frontend |
| Docker: Full stack | `docker-compose up` from repo root |
| Review code | `/codex:review --base main` |
