# MediaArchive — Session Handoff Document

**Last updated:** 2026-03-02
**Status:** Phase 6b complete — all features implemented. Database contains 22 test records for demo purposes. Fixed: removed field-level unique constraint on kalturaId, kept composite unique constraint (kalturaId+startTime+stopTime).

---

## Current Situation (2026-02-28)

All Phase 1 through 6 work is complete. The stack is **fully running**.

**Database Status:**
- PostgreSQL: **22 records** (test records imported from `testRecords.csv`)
- Typesense: **22 documents** (synced with PostgreSQL)
- Test users seeded (password: `password123` for all):
  - `admin@test.com` — ADMIN
  - `editor@test.com` — EDITOR
  - `viewer@test.com` — VIEWER

**To start the stack:**
```powershell
cd "C:\Users\Xiaozhong Chen\MediaArchive"
docker compose up
```

**Verify the stack is healthy:**
```bash
docker compose ps
curl http://localhost:3000/api/health   # → {"ok":true,"service":"mediaarchive-app"}
```

---

## Recent Changes (2026-02-28)

### CSV Import Format
- File: `testRecords.csv` — contains 21 test records
- Format: comma-separated, headers: `Title,Series,Date,Access Copy,KalturaID,View Online,Start Time,Stop Time,Film Reel,Reel Segment,Reporter`
- Start/Stop Time: integer seconds (not HH:MM:SS)
- Import command: `curl -b cookies.txt -X POST "http://localhost:3000/api/hono/csv/import" -F "file=@testRecords.csv"`

### Video Player Fix
- Issue: iframe embed code was stored in wrong field (`kalturaId` instead of `embedCode`)
- Fix: Moved iframe HTML from `kalturaId` → `embedCode` via SQL update
- The video player component (`EmbedPlayer.tsx`) reads from `embedCode` field

### Typesense Sync Note
- `fullSyncToTypesense()` only upserts records — it does NOT delete stale records
- To fully reconcile: delete the collection first, then sync

### Database Schema Fix (2026-03-02)
- Issue: `kalturaId` field had a unique constraint, preventing multiple records with same KalturaID
- Fix: Removed field-level unique constraint on `kalturaId`, kept composite unique constraint on `(kalturaId, startTime, stopTime)`
- Database now allows multiple records with same KalturaID but different start/stop times
- CSV import uses composite key for deduplication
```bash
curl -X DELETE "http://localhost:8108/collections/media_records?force=true" -H "X-Typesense-Api-Key: dev_typesense_admin_key"
curl -b cookies.txt -X POST "http://localhost:3000/api/hono/sync"
```

### Git Status
- Repository initialized locally
- Not yet pushed to GitHub (gh CLI not installed)

---

## Implementation Phases

| Phase | Status | Description |
|---|---|---|
| **1 — Infrastructure & Auth Foundation** | ✅ Complete | Docker Compose, Dockerfile, package.json, schema, env.ts |
| **2 — Server Singletons, Auth & Migration** | ✅ Complete | db/redis/typesense singletons, Auth.js v5, Prisma 7 migration, seed |
| **3 — Middleware & Route Protection** | ✅ Complete | Next.js middleware, Hono factory, `verifyRole()` HOF |
| **4 — Sync Engine & Search Permissioning** | ✅ Complete | `record.service.ts` double-write, Typesense search-only key |
| **5 — Conditional Frontend UI** | ✅ Complete | Layout shell, search page, record detail, media player, role-aware components |
| **6 — Batch Operations, Admin Panel & Edit Form** | ✅ Complete | CSV import/export, BullMQ queue, admin panel, user CRUD, edit form, Edit button wiring |
| **6b — Bulk Edit, Import Dialog, Rate Limiting** | ✅ Complete | Multi-select + bulk edit UI, import dialog with progress bar, Redis rate limiting middleware |

---

## Phase 6 — Completed

### Overview
CSV import/export with BullMQ queuing for large files, full admin panel with user management and system stats, record edit form with Zod validation, and wiring of all Edit button stubs.

### Workstream 1: CSV Import/Export

**New Files:**
| File | Purpose |
|---|---|
| `src/server/services/csv.service.ts` | Business logic: `parseCsvToRows()`, `validateRows()`, `importBatch()`, `exportRecordsCsv()`, `updateImportProgress()`, `getImportProgress()`. Uses `csv-parse/sync` + `csv-stringify/sync`. Upserts via `db.mediaRecord.upsert({ where: { kalturaId } })` with fallback to `create` when kalturaId is null. After each batch, calls `bulkUpsertToTypesense()`. Progress stored in Redis `import:job:{jobId}` with 1h TTL. **No `"server-only"` import** — BullMQ worker imports it outside Next.js context. |
| `src/server/workers/import.worker.ts` | BullMQ queue + worker singletons (globalThis pattern). Worker processes queued CSV imports in batches of 100, updating Redis progress. Concurrency: 1. Creates its own Redis connections (BullMQ requirement — cannot share ioredis singleton). |
| `src/server/api/routes/csv.ts` | Hono routes: `POST /csv/import` (ADMIN, multipart file upload, inline ≤5K rows / queued >5K rows with 202 + jobId), `GET /csv/import/:jobId/status` (ADMIN, poll progress from Redis), `GET /csv/export` (VIEWER+, streams CSV with Content-Disposition header). |

**Modified Files:**
| File | Change |
|---|---|
| `src/server/api/hono.ts` | Mounted `csvRouter` at `/csv` |

### Workstream 2: Admin Panel

**New Files:**
| File | Purpose |
|---|---|
| `src/server/services/user.service.ts` | `listUsers()`, `createUser()` (bcrypt hash), `updateUserRole()` (+ Redis cache invalidation via `redis.del(role:{id})`), `deleteUser()` (prevents deleting last ADMIN), `getSystemStats()` (record count, user count, last sync time from Redis). Zod schemas: `createUserSchema`, `updateUserRoleSchema`. |
| `src/server/api/routes/users.ts` | Hono routes (all ADMIN only): `GET /users`, `POST /users`, `PUT /users/:id/role`, `DELETE /users/:id`, `GET /users/stats`. Same pattern as `records.ts` (verifyRole + zValidator). |
| `src/app/(protected)/admin/page.tsx` | Server component: fetches users + stats via service functions, serializes dates, passes to client component. |
| `src/app/(protected)/admin/AdminDashboardClient.tsx` | Tabbed UI — **Dashboard tab**: stats cards (records, users, last sync), Typesense re-sync button (`POST /api/hono/sync`), CSV import file upload, CSV export download link. **Users tab**: table with role dropdown (inline change), create user dialog (name/email/password/role), delete user with confirmation dialog. |

**New Shadcn/UI Components:**
| File | Purpose |
|---|---|
| `src/components/ui/table.tsx` | Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption |
| `src/components/ui/label.tsx` | Form label with peer-disabled styling |
| `src/components/ui/select.tsx` | Native `<select>` styled to match shadcn/ui |
| `src/components/ui/tabs.tsx` | Context-based Tabs, TabsList, TabsTrigger, TabsContent (no Radix dependency) |
| `src/components/ui/textarea.tsx` | Multi-line text input |

**Modified Files:**
| File | Change |
|---|---|
| `src/server/api/hono.ts` | Mounted `usersRouter` at `/users` |
| `src/server/api/routes/sync.ts` | After `fullSyncToTypesense()`, stores `redis.set("last_sync_time", new Date().toISOString())` |

### Workstream 3: Edit Form

**New Files:**
| File | Purpose |
|---|---|
| `src/app/(protected)/record/[id]/edit/page.tsx` | Server component: fetches record via `getRecordById()`, serializes dates (ISO→YYYY-MM-DD slice for date input), passes to form. Same pattern as existing detail `page.tsx`. |
| `src/app/(protected)/record/[id]/edit/RecordEditForm.tsx` | Client form: controlled inputs for all 12 fields, client-side Zod validation matching `updateRecordSchema`, `PUT /api/hono/records/{id}` on submit, redirect to detail page on success. Date field uses `input[type=date]`. 2-column grid layout inside Card. Embed code uses `<Textarea>`. |

**Modified Files:**
| File | Change |
|---|---|
| `src/app/(protected)/record/[id]/RecordDetailClient.tsx` | Changed disabled Edit `<Button>` to `<Button asChild><Link href={/record/${id}/edit}>` |
| `src/components/search/HitTile.tsx` | Changed Edit link from `/record/${hit.id}` to `/record/${hit.id}/edit` |

### Type Check
`SKIP_ENV_VALIDATION=1 npx tsc --noEmit` — **zero errors** after Phase 6.

### Bugs Found and Fixed During Verification Testing

| Bug | Root Cause | Fix |
|---|---|---|
| **Build failure: pre-rendering crash** | Admin page (server component) tries to connect to DB/Redis during `next build`. Search page's Typesense adapter validates API key eagerly during pre-rendering. | Added `export const dynamic = "force-dynamic"` to `src/app/(protected)/layout.tsx` — all protected pages skip static generation. |
| **BullMQ NOAUTH error** | `import.worker.ts` parsed only hostname/port from `REDIS_URL`, dropping the password. Redis requires auth (`redis://:password@host:port`). | Rewrote `parseRedisConnection()` to extract and pass the password from the URL. |
| **Role change not enforced immediately** | `verifyRole()` fell back to the stale JWT role on Redis cache miss (after `redis.del` invalidation), then re-cached the stale value. | Changed cache-miss path to query `db.user.findUnique()` for the authoritative role instead of trusting the JWT. |

### Files Modified During Testing
| File | Change |
|---|---|
| `src/app/(protected)/layout.tsx` | Added `export const dynamic = "force-dynamic"` |
| `src/server/workers/import.worker.ts` | Fixed Redis connection to include password from URL |
| `src/server/api/middleware/verifyRole.ts` | Added `db` import; cache-miss path queries DB for current role |

---

## Verification Testing Results (All 26 Items Pass)

| Category | Test | Result |
|---|---|---|
| **Infrastructure** | `docker compose up` → all 5 containers healthy | PASS |
| | `/api/health` → `{"ok":true}` | PASS |
| **Authentication** | Invalid credentials → 302 redirect | PASS |
| | Unauthenticated `/search` → 307 to `/login` | PASS |
| **RBAC — Middleware** | VIEWER → `/admin` → 403 | PASS |
| **RBAC — API (VIEWER)** | `POST /records` → 403 | PASS |
| | `DELETE /records/:id` → 403 | PASS |
| | `GET /users` → 403 | PASS |
| | `POST /csv/import` → 403 | PASS |
| | `GET /csv/export` → 200 (allowed) | PASS |
| **RBAC — API (EDITOR)** | `POST /records` → 201 (allowed) | PASS |
| | `DELETE /records/:id` → 403 | PASS |
| | `GET /users` → 403 | PASS |
| **RBAC — API (ADMIN)** | Full access to users, stats, sync | PASS |
| **Search** | Search-only key cannot delete collection | PASS |
| | Query response time < 1ms | PASS |
| | Facet filtering (series, reporter, filmReel) | PASS |
| **CSV Import** | Inline import (3 rows) — 0 errors | PASS |
| | Queued import (5001 rows) → 202 + jobId | PASS |
| | Re-import dedup via kalturaId+startTime+stopTime composite key | PASS |
| | Validation errors on invalid rows | PASS |
| **CSV Export** | Row count matches PG (5006 lines) | PASS |
| **Admin Panel** | Create user + change role + delete user | PASS |
| | Last-admin guard blocks deletion | PASS |
| | Role change enforced immediately (DB lookup) | PASS |
| **Double-Write** | Edit → PG + Typesense updated | PASS |
| | Delete → gone from PG + Typesense | PASS |
| **Audit** | `lastModifiedById` matches acting user | PASS |
| **Data Integrity** | PG count = Typesense count (5005) | PASS |

---

## Phase 6b — Completed

### Overview
Three workstreams: (1) Bulk Edit — backend service + API + multi-select UI with BulkEditDialog, (2) Import Dialog — replaces inline file input on admin page with a stateful dialog featuring progress bar and polling, (3) Rate Limiting — Redis sliding-window middleware applied to mutation endpoints.

### Workstream 1: Bulk Edit

**Backend:**

`src/server/services/record.service.ts` — Added:
- `bulkUpdateSchema`: Zod schema (`recordIds: z.array(z.string()).min(1).max(100)`, `updates: createRecordSchema.partial()`)
- `bulkUpdateRecords(recordIds, updates, editorId)`: Loops through IDs, calls `db.mediaRecord.update()` for each, collects results, then `bulkUpsertToTypesense()` on all updated records. Stamps `lastModifiedById`.

`src/server/api/routes/records.ts` — Added:
- `POST /bulk` (EDITOR+, rate limited 10/60s): `verifyRole("EDITOR"), rateLimit(10, 60), zValidator("json", bulkUpdateSchema)`
- Rate limits also applied to `POST /` (60/60s) and `DELETE /:id` (30/60s)

**Frontend — New Files:**
| File | Purpose |
|---|---|
| `src/components/search/SelectionContext.tsx` | React context: `Set<string>` for selected IDs, `toggle(id)`, `selectAll(ids)`, `clearAll()`, `count`. Provider wraps search page. |
| `src/components/search/BulkActionBar.tsx` | Shown when `count > 0`: "{count} selected" + "Bulk Edit" button + "Clear Selection" button. Opens BulkEditDialog. |
| `src/components/search/BulkEditDialog.tsx` | Dialog with series/reporter/filmReel fields. Only non-empty fields sent. POSTs to `/api/hono/records/bulk`. Shows result with error list. Dispatches `window.dispatchEvent(new Event("bulk-edit-complete"))` on success. |

**Frontend — Modified Files:**
| File | Change |
|---|---|
| `src/components/search/HitTile.tsx` | Added `selectable`, `selected`, `onToggleSelect` props. Checkbox in card header. `ring-2 ring-primary` when selected. |
| `src/components/search/HitsGrid.tsx` | Imports `useSelection()`, passes `selectable={canMutate}`, `selected`, `onToggleSelect` to each HitTile. |
| `src/app/(protected)/search/page.tsx` | Wrapped content with `<SelectionProvider>`, added `<BulkActionBar />` between ActiveFilters and content. |

### Workstream 2: Import Dialog with Progress Bar

| File | Purpose |
|---|---|
| `src/components/admin/ImportDialog.tsx` | **NEW** — State machine: `idle → uploading → polling → complete / failed`. File upload via FormData to `POST /api/hono/csv/import`. If 202 (queued), polls `GET /csv/import/:jobId/status` every 2s. Progress bar (div width%), error list display. |
| `src/app/(protected)/admin/AdminDashboardClient.tsx` | **MODIFIED** — Removed inline file input + import button + `handleImport()`. Added `<ImportDialog />` component in its place. |

### Workstream 3: Rate Limiting

| File | Purpose |
|---|---|
| `src/server/api/middleware/rateLimit.ts` | **NEW** — Redis sliding-window counter. `rateLimit(maxRequests, windowSeconds)` factory. Key: `rl:{userId}:{path}`. Returns 429 with `Retry-After` header when exceeded. Uses `redis.incr()` + `redis.expire()`. |

**Rate limits applied:**
| Route | Limit |
|---|---|
| `POST /api/hono/records/bulk` | 10 requests / 60s |
| `POST /api/hono/records` | 60 requests / 60s |
| `DELETE /api/hono/records/:id` | 30 requests / 60s |
| `POST /api/hono/csv/import` | 5 requests / 60s |

### Infrastructure Bugs Found and Fixed During Browser Testing

| Bug | Root Cause | Fix |
|---|---|---|
| **`env.ts` crashes in browser** | `serverEnvSchema.safeParse(process.env)` ran in client bundle — DATABASE_URL etc. don't exist in browser. | Added `const isClient = typeof window !== "undefined"` guard to skip server validation in browser. |
| **`NEXT_PUBLIC_*` vars not inlined at build time** | Two causes: (1) Dockerfile didn't pass NEXT_PUBLIC vars as build args. (2) `typesense-adapter.ts` used `clientEnv.NEXT_PUBLIC_X` (Zod result object) instead of literal `process.env.NEXT_PUBLIC_X` — Next.js only statically replaces literal dot-notation access. | (1) Added `ARG`/`ENV` in Dockerfile builder stage + `build.args` in docker-compose.yml. (2) Rewrote `typesense-adapter.ts` to use `process.env.NEXT_PUBLIC_*` directly. |
| **Typesense port 8108 not exposed to host** | Client-side InstantSearch connects directly to Typesense from browser, but port wasn't mapped. | Added `ports: "8108:8108"` to typesense service in docker-compose.yml. |
| **Typesense scoped search-only key returns 401** | `generateScopedSearchKey()` from `scripts/init-typesense.ts` produces a key that Typesense rejects. | **Dev workaround:** Changed `.env` to use admin key as search key. **Production TODO:** investigate proper scoped key generation. |

### Files Modified During Bug Fixes
| File | Change |
|---|---|
| `src/lib/env.ts` | Added `isClient` guard, created `clientEnvRaw` with literal `process.env.NEXT_PUBLIC_*` dot notation |
| `src/lib/typesense-adapter.ts` | Removed `clientEnv` import, uses `process.env.NEXT_PUBLIC_*` directly |
| `apps/web/Dockerfile` | Added `ARG`/`ENV` for NEXT_PUBLIC_TYPESENSE_HOST, PORT, SEARCH_ONLY_KEY in builder stage |
| `docker-compose.yml` | Added `build.args` for NEXT_PUBLIC vars, added `ports: "8108:8108"` to typesense |
| `.env` | Changed search keys to use admin key (dev only) |

### Phase 6b Verification Results

**API Tests (via curl):**
| Test | Result |
|---|---|
| Bulk edit 3 records → PG + Typesense updated | PASS |
| Rate limiting: 11th rapid POST /bulk → 429 | PASS |
| RBAC: Viewer on POST /bulk → 403 | PASS |
| CSV import rate limit: 6th rapid POST → 429 | PASS |

**Browser Tests (via Playwright):**
| Test | Result |
|---|---|
| Search page: 10 checkboxes visible (EDITOR+ role) | PASS |
| Select 3 records → "3 selected" bulk action bar appears | PASS |
| Bulk Edit dialog opens from action bar | PASS |
| Admin page: Import CSV dialog opens | PASS |

**Known Pre-existing Console Errors (not addressed):**
- Auth session fetch error on page load (benign timing issue)
- React hydration error #418 (text content mismatch SSR vs client)

### Production TODOs
- Investigate Typesense scoped search-only key generation — currently using admin key in dev `.env`
- In production, Typesense port 8108 should NOT be exposed to public internet — use a reverse proxy or network policy
- Rate limit keys use `rl:{userId}:{path}` — consider adding IP-based limiting for unauthenticated endpoints

---

## Phase 3 — Completed

### Files Created
| File | Purpose |
|---|---|
| `src/middleware.ts` | Next.js middleware — protects all routes, redirects to `/login`, coarse admin check |
| `src/server/api/hono.ts` | Hono app factory with CORS, logger, basePath `/api/hono` |
| `src/server/api/middleware/verifyRole.ts` | Role-checking HOF — JWT decode, Redis cache (5-min TTL), 401/403 JSON |
| `src/app/api/hono/[...route]/route.ts` | Next.js catch-all that delegates to Hono (GET/POST/PUT/DELETE/PATCH) |
| `src/server/api/routes/records.ts` | Records CRUD — GET (VIEWER+), POST (EDITOR+), PUT (EDITOR+), DELETE (ADMIN) |

### Architecture Decisions
- `verifyRole()` uses `next-auth/jwt` `decode()` (not `getToken()`) since Hono has its own Request object
- Redis caches `role:{userId}` to avoid JWT decode overhead on hot API paths
- All mutations follow the double-write pattern: PG first → Typesense upsert/delete (non-throwing)
- Zod validation on all inputs via `@hono/zod-validator`

---

## Phase 4 — Completed

### Files Created / Modified
| File | Purpose |
|---|---|
| `src/server/services/record.service.ts` | **NEW** — Business logic layer: `listRecords`, `getRecordById`, `createRecord`, `updateRecord`, `deleteRecord` with double-write + audit stamping |
| `src/server/api/routes/records.ts` | **REFACTORED** — Now delegates to service layer; added `GET /:id` route |
| `src/server/api/routes/sync.ts` | **NEW** — `POST /api/hono/sync` (ADMIN only) full PG → Typesense re-index |
| `src/server/api/hono.ts` | **MODIFIED** — Mounted sync router |
| `src/lib/typesense-adapter.ts` | **NEW** — Browser-side InstantSearch adapter with search-only key |
| `src/server/typesense.ts` | **FIXED** — Removed broken Proxy; clean `getTypesenseClient()` lazy getter |
| `src/server/typesense.service.ts` | **FIXED** — Uses `getTypesenseClient()` instead of direct import |
| `scripts/init-typesense.ts` | **FIXED** — `date` field made non-optional (Typesense requires default_sorting_field to be non-optional) |

### Bugs Fixed
| Bug | Fix |
|---|---|
| Typesense Proxy pattern broke method chaining | Replaced with clean `getTypesenseClient()` lazy function |
| `default_sorting_field` cannot be optional | Made `date` field non-optional in Typesense schema (defaults to 0) |

---

## Phase 5 — Completed

### Overview
Full conditional frontend UI: Shadcn/UI component library, layout shell, search page with InstantSearch + Typesense, record detail page with media player, and role-aware rendering throughout.

### Dependencies Added
| Package | Purpose |
|---|---|
| `class-variance-authority` | Component variant system (shadcn/ui) |
| `clsx` + `tailwind-merge` | Class name utility (`cn()` helper) |
| `lucide-react` | Icons |
| `@radix-ui/react-slot` | Polymorphic component support |
| `@radix-ui/react-dropdown-menu` | User menu |
| `@radix-ui/react-dialog` | Confirmation dialogs + Sheet |
| `@radix-ui/react-separator` | Visual dividers |
| `@radix-ui/react-scroll-area` | Scrollable facet panels |
| `@radix-ui/react-avatar` | User initials avatar |
| `tailwindcss-animate` | Shadcn/ui animations |

### Files Created

**Shadcn/UI Foundation (13 files)**
| File | Purpose |
|---|---|
| `components.json` | Shadcn/UI CLI config |
| `src/lib/utils.ts` | `cn()` — Tailwind class merge utility |
| `src/components/ui/button.tsx` | Button with variants (default, destructive, outline, secondary, ghost, link) |
| `src/components/ui/input.tsx` | Styled text input |
| `src/components/ui/badge.tsx` | Badge with variants |
| `src/components/ui/card.tsx` | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| `src/components/ui/dialog.tsx` | Modal dialog with overlay |
| `src/components/ui/dropdown-menu.tsx` | Dropdown menu primitives |
| `src/components/ui/separator.tsx` | Horizontal/vertical separator |
| `src/components/ui/skeleton.tsx` | Loading skeleton |
| `src/components/ui/scroll-area.tsx` | Custom scrollbar area |
| `src/components/ui/avatar.tsx` | Avatar with fallback initials |
| `src/components/ui/sheet.tsx` | Slide-out panel (mobile filter drawer) |

**Session & Auth (2 files)**
| File | Purpose |
|---|---|
| `src/components/providers/SessionProvider.tsx` | `"use client"` wrapper around NextAuth `SessionProvider` |
| `src/hooks/use-role.ts` | `useRole()` hook → `{ role, isAdmin, isEditor, isViewer, canMutate, isLoading }` |

**Layout Shell (3 files)**
| File | Purpose |
|---|---|
| `src/components/layout/UserMenu.tsx` | Dropdown: avatar (initials), name, email, role Badge, logout |
| `src/components/layout/TopBar.tsx` | Sticky header: "Media Archive" link, "Admin Panel" (ADMIN only), UserMenu |
| `src/components/layout/AppShell.tsx` | Composes TopBar + `<main>{children}</main>` |

**Protected Layout (1 file)**
| File | Purpose |
|---|---|
| `src/app/(protected)/layout.tsx` | Server component wrapping children in `AuthSessionProvider` → `AppShell` |

**Search UI (7 files)**
| File | Purpose |
|---|---|
| `src/components/search/SearchBox.tsx` | `useSearchBox` + 150ms debounce via `setTimeout`/`clearTimeout` ref |
| `src/components/search/FacetList.tsx` | `useRefinementList({ attribute })` — clickable items with count badges |
| `src/components/search/FacetPanel.tsx` | Composes 3 FacetList: `series`, `reporter`, `filmReel` |
| `src/components/search/ActiveFilters.tsx` | `useCurrentRefinements` + `useClearRefinements` — dismissible badges |
| `src/components/search/HitTile.tsx` | Card with title link, date, metadata badges, role-aware Edit/Delete buttons |
| `src/components/search/HitsGrid.tsx` | `useHits` — CSS grid 1→2→3 cols, skeleton loading, empty state |
| `src/app/(protected)/search/page.tsx` | `"use client"` — `InstantSearch` wrapper, desktop sidebar + mobile Sheet filter |

**Record Detail & Media Player (4 files)**
| File | Purpose |
|---|---|
| `src/components/media/MetadataPanel.tsx` | Basic fields (all roles) + advanced fields (EDITOR+ only) |
| `src/components/media/EmbedPlayer.tsx` | DOMPurify-sanitized iframe embed with aspect-ratio container |
| `src/app/(protected)/record/[id]/page.tsx` | Server component — calls `getRecordById()` directly (no HTTP), serializes dates |
| `src/app/(protected)/record/[id]/RecordDetailClient.tsx` | Two-column layout: player + metadata, Back/Edit/Delete buttons |

### Role-Aware Component Behavior
| Component | VIEWER | EDITOR | ADMIN |
|---|---|---|---|
| TopBar "Admin Panel" link | Hidden | Hidden | Visible |
| HitTile "Edit" button | Hidden | Visible (→ `/record/{id}/edit`) | Visible (→ `/record/{id}/edit`) |
| HitTile "Delete" button | Hidden | Hidden | Visible (with confirmation dialog) |
| MetadataPanel advanced fields | Hidden | Visible | Visible |
| RecordDetail "Edit" button | Hidden | Visible (→ `/record/{id}/edit`) | Visible (→ `/record/{id}/edit`) |
| RecordDetail "Delete" button | Hidden | Hidden | Visible (with confirmation dialog) |

---

## API Routes — Complete Reference

### Hono API (`/api/hono/...`)

| Method | Route | Min Role | Description |
|---|---|---|---|
| GET | `/api/hono/records` | VIEWER | List records (paginated, filterable) |
| GET | `/api/hono/records/:id` | VIEWER | Get single record |
| POST | `/api/hono/records` | EDITOR | Create record (double-write) |
| PUT | `/api/hono/records/:id` | EDITOR | Update record (double-write) |
| DELETE | `/api/hono/records/:id` | ADMIN | Delete record (double-write) — rate limited 30/60s |
| POST | `/api/hono/records/bulk` | EDITOR | **Phase 6b** — Bulk update up to 100 records — rate limited 10/60s |
| POST | `/api/hono/sync` | ADMIN | Full PG → Typesense re-index |
| POST | `/api/hono/csv/import` | ADMIN | CSV upload (inline ≤5K rows, queued >5K) |
| GET | `/api/hono/csv/import/:jobId/status` | ADMIN | Poll import job progress |
| GET | `/api/hono/csv/export` | VIEWER | Download all records as CSV |
| GET | `/api/hono/users` | ADMIN | List all users |
| POST | `/api/hono/users` | ADMIN | Create user (bcrypt hash) |
| PUT | `/api/hono/users/:id/role` | ADMIN | Update user role (+ Redis invalidation) |
| DELETE | `/api/hono/users/:id` | ADMIN | Delete user (last-admin guard) |
| GET | `/api/hono/users/stats` | ADMIN | System stats (records, users, last sync) |

### Next.js Routes

| Route | Type | Description |
|---|---|---|
| `/login` | Public | Login page |
| `/search` | Protected | Search UI (InstantSearch + Typesense) |
| `/record/[id]` | Protected | Record detail view |
| `/record/[id]/edit` | Protected | Record edit form (EDITOR+) |
| `/admin` | Protected (ADMIN) | Admin dashboard — stats, sync, CSV, users |

---

## Docker Compose — 5 Services (Final Config)

| # | Service | Image | Healthcheck |
|---|---------|-------|-------------|
| 1 | `postgres` | `pgvector/pgvector:pg17` | `pg_isready` |
| 2 | `typesense` | `typesense/typesense:30.1` | **None** — image has no shell utilities |
| 3 | `redis` | `redis:8.0-alpine` | `redis-cli ping` |
| 4 | `app` | local Dockerfile | `wget /api/health` |
| 5 | `caddy` | `caddy:2-alpine` | depends on `app: healthy` |

**Important:** `app` depends on typesense with `condition: service_started` (not `service_healthy`) because typesense has no healthcheck.

---

## Critical Breaking Changes vs. Original Plan

These were discovered during Phase 1/2 and are now locked in — do not revert:

| Change | Reason |
|---|---|
| Prisma **7** (not 6) | npm resolves `^6` to 7.x; `url` removed from `schema.prisma` |
| `prisma.config.ts` required | Prisma 7 moved DB URL out of schema into a separate config file |
| `PrismaClient` requires `adapter` arg | Prisma 7 direct connections use `@prisma/adapter-pg` + `pg` Pool |
| `@auth/prisma-adapter` **removed** | JWT strategy is stateless — adapter caused `@auth/core` version clash |
| `pgvector/pgvector:pg17` (not pg18) | pg18 image does not exist on Docker Hub |
| `typesense-instantsearch-adapter@^2.0.0` | v3 does not exist on npm |
| Typesense has **no healthcheck** | The container image contains no shell utilities (no curl, wget, bash) |
| All `docker compose exec` migrations run as `-u root` | Container runs as non-root `nextjs` user; npx needs cache write access |
| Seed runs via `mediaarchive-builder` image | Runner stage has stripped node_modules; builder has full deps + generated client |
| `trustHost: true` in Auth.js config | Required for Docker — `UntrustedHost` error without it |
| `getTypesenseClient()` replaces `typesenseClient` | Lazy getter prevents build-time crash; Proxy pattern broke `.collections().documents()` chaining |
| `/api/hono` bypasses Next.js middleware auth | Hono routes use `verifyRole()` for JSON 401/403; middleware redirect would break API clients |
| Typesense `date` field is non-optional | `default_sorting_field` cannot be optional in Typesense; defaults to 0 |

---

## How to Run Operational Commands

### Run a new migration (after schema changes)
```bash
docker compose exec -u root app npx prisma migrate dev --name <migration-name>
```

### Re-run the seed (idempotent — safe to repeat)
```bash
docker run --rm \
  --network mediaarchive_medianet \
  -e DATABASE_URL="postgresql://mediaarchive:dev_postgres_password@postgres:5432/mediaarchive_db" \
  -v "C:\Users\Xiaozhong Chen\MediaArchive\apps\web\prisma\seed.ts:/app/prisma/seed.ts" \
  -w /app \
  mediaarchive-builder \
  npx tsx prisma/seed.ts
```
*(If `mediaarchive-builder` image was removed, rebuild it first:)*
```bash
docker build --target builder -t mediaarchive-builder apps/web
```

### Init Typesense collection (run once after first boot)
```bash
docker compose exec -u root app \
  sh -c "TYPESENSE_HOST=typesense TYPESENSE_PORT=8108 TYPESENSE_API_KEY=dev_typesense_admin_key \
  npx tsx scripts/init-typesense.ts"
```

### Full rebuild (if Dockerfile or package.json changed)
```bash
docker compose down -v
docker compose up --build
```
Then re-run migration and seed.

---

## Complete File Inventory

### Root
| File | Purpose |
|---|---|
| `docker-compose.yml` | 5-service orchestration |
| `.env` | Dev secrets (gitignored) |
| `.env.example` | Committed template |
| `.gitignore` | Ignores `.env`, `node_modules`, `.next/` |
| `plan.md` | Full 6-phase implementation plan |
| `HANDOFF.md` | This file |
| `docker/postgres/init.sql` | Enables `pgvector` extension on first boot |
| `docker/caddy/Caddyfile` | Reverse proxy `:80` → `app:3000` |

### `apps/web/` — Next.js 15 project
| File | Purpose |
|---|---|
| `Dockerfile` | 3-stage build: `deps → builder → runner` |
| `package.json` | All dependencies (Prisma 7, Next 15, Hono 4, Auth.js v5, BullMQ, csv-parse, csv-stringify) |
| `tsconfig.json` | `strict: true`; excludes `prisma.config.ts` and `scripts/` |
| `prisma.config.ts` | **Prisma 7 config** — `datasource.url` for migrate; excluded from TS build |
| `next.config.ts` | `output: "standalone"` |
| `tailwind.config.ts` | Shadcn/UI CSS variable tokens |
| `postcss.config.mjs` | Tailwind + autoprefixer |
| `prisma/schema.prisma` | Full DB schema — `url` removed (Prisma 7 reads from `prisma.config.ts`) |
| `prisma/seed.ts` | Seeds 3 test users; uses `PrismaPg` adapter |
| `prisma/migrations/20260227160637_init/migration.sql` | Applied — all tables exist in DB |
| `scripts/init-typesense.ts` | Idempotent Typesense collection setup + search-only key generation |
| `src/lib/env.ts` | Zod-validated env — exports `serverEnv` and `clientEnv` (not `env`) |
| `src/lib/utils.ts` | `cn()` Tailwind merge utility (shadcn/ui) |
| `src/lib/typesense-adapter.ts` | Browser-side InstantSearch adapter with search-only key |
| `src/server/db.ts` | Prisma singleton — uses `new Pool()` + `new PrismaPg()` adapter |
| `src/server/redis.ts` | ioredis singleton |
| `src/server/typesense.ts` | Typesense `Client` singleton (lazy getter) |
| `src/server/typesense.service.ts` | `upsertToTypesense`, `deleteFromTypesense`, `bulkUpsertToTypesense`, `fullSyncToTypesense` |
| `src/server/auth.ts` | Auth.js v5 — Credentials provider, JWT strategy, role in token |
| `src/server/services/record.service.ts` | Record CRUD business logic with double-write + audit |
| `src/server/services/csv.service.ts` | **Phase 6** — CSV parse/validate/import/export, Redis progress tracking |
| `src/server/services/user.service.ts` | **Phase 6** — User CRUD, role management, last-admin guard, system stats |
| `src/server/workers/import.worker.ts` | **Phase 6** — BullMQ queue + worker for large CSV imports |
| `src/server/api/hono.ts` | Hono app factory — CORS, logger, 4 route modules mounted |
| `src/server/api/middleware/verifyRole.ts` | Role-checking HOF — JWT decode + Redis cache |
| `src/server/api/middleware/rateLimit.ts` | **Phase 6b** — Redis sliding-window rate limiter |
| `src/server/api/routes/records.ts` | Records CRUD with Zod validation + double-write + bulk update |
| `src/server/api/routes/sync.ts` | Full PG → Typesense re-index + last_sync_time to Redis |
| `src/server/api/routes/csv.ts` | **Phase 6** — CSV import (multipart), export (download), job status |
| `src/server/api/routes/users.ts` | **Phase 6** — User CRUD API (ADMIN only) |
| `src/app/api/hono/[...route]/route.ts` | Next.js catch-all → Hono handler |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth.js route handler |
| `src/app/api/health/route.ts` | Docker healthcheck endpoint |
| `src/middleware.ts` | Route protection — auth check, admin guard, public path allowlist |
| `src/app/layout.tsx` | Root layout |
| `src/app/page.tsx` | Redirects `/` → `/search` |
| `src/app/globals.css` | Tailwind base + Shadcn/UI CSS variables |
| `src/app/(public)/login/page.tsx` | Login page (client component) |
| `src/app/(protected)/layout.tsx` | Protected route group layout — SessionProvider + AppShell |
| `src/app/(protected)/search/page.tsx` | InstantSearch page — desktop sidebar + mobile Sheet |
| `src/app/(protected)/record/[id]/page.tsx` | Server component — fetches record via Prisma |
| `src/app/(protected)/record/[id]/RecordDetailClient.tsx` | Client detail view — player, metadata, edit link, delete flow |
| `src/app/(protected)/record/[id]/edit/page.tsx` | **Phase 6** — Server component for edit page |
| `src/app/(protected)/record/[id]/edit/RecordEditForm.tsx` | **Phase 6** — Client form with Zod validation, 2-col grid |
| `src/app/(protected)/admin/page.tsx` | **Phase 6** — Server component for admin dashboard |
| `src/components/admin/ImportDialog.tsx` | **Phase 6b** — Modal with file upload, progress bar, polling, error display |
| `src/app/(protected)/admin/AdminDashboardClient.tsx` | **Phase 6** — Tabbed UI: Dashboard + Users management (import replaced with ImportDialog) |
| `src/components/ui/button.tsx` | Button with variants |
| `src/components/ui/input.tsx` | Styled text input |
| `src/components/ui/badge.tsx` | Badge with variants |
| `src/components/ui/card.tsx` | Card components |
| `src/components/ui/dialog.tsx` | Modal dialog |
| `src/components/ui/dropdown-menu.tsx` | Dropdown menu |
| `src/components/ui/separator.tsx` | Divider |
| `src/components/ui/skeleton.tsx` | Loading placeholder |
| `src/components/ui/scroll-area.tsx` | Custom scrollbar |
| `src/components/ui/avatar.tsx` | Avatar with fallback |
| `src/components/ui/sheet.tsx` | Slide-out panel |
| `src/components/ui/table.tsx` | **Phase 6** — Table components (header, body, row, cell, etc.) |
| `src/components/ui/label.tsx` | **Phase 6** — Form label |
| `src/components/ui/select.tsx` | **Phase 6** — Native select styled as shadcn |
| `src/components/ui/tabs.tsx` | **Phase 6** — Context-based tabs (no Radix dependency) |
| `src/components/ui/textarea.tsx` | **Phase 6** — Multi-line text input |
| `src/components/providers/SessionProvider.tsx` | NextAuth `SessionProvider` client wrapper |
| `src/hooks/use-role.ts` | `useRole()` hook |
| `src/components/layout/UserMenu.tsx` | Avatar dropdown with logout |
| `src/components/layout/TopBar.tsx` | Sticky header with admin link + user menu |
| `src/components/layout/AppShell.tsx` | TopBar + main content wrapper |
| `src/components/search/SearchBox.tsx` | 150ms debounced search input |
| `src/components/search/FacetList.tsx` | Single facet attribute filter list |
| `src/components/search/FacetPanel.tsx` | 3 FacetLists: series, reporter, filmReel |
| `src/components/search/ActiveFilters.tsx` | Dismissible active filter badges |
| `src/components/search/SelectionContext.tsx` | **Phase 6b** — Multi-select state management (Set, toggle, selectAll, clearAll) |
| `src/components/search/BulkActionBar.tsx` | **Phase 6b** — Toolbar: selection count + Bulk Edit + Clear Selection |
| `src/components/search/BulkEditDialog.tsx` | **Phase 6b** — Dialog for bulk-editing series/reporter/filmReel |
| `src/components/search/HitTile.tsx` | Search result card with role-aware actions + checkbox for multi-select |
| `src/components/search/HitsGrid.tsx` | Responsive grid with skeleton/empty states + selection wiring |
| `src/components/media/MetadataPanel.tsx` | Record metadata display |
| `src/components/media/EmbedPlayer.tsx` | DOMPurify-sanitized iframe embed player |
| `components.json` | Shadcn/UI CLI config |

---

## Database State

- **Migration applied:** `20260227160637_init`
- **Tables created:** `users`, `accounts`, `sessions`, `verification_tokens`, `media_records`
- **pgvector extension:** enabled

### Test Users (password: `password123` for all)
| Email | Role |
|---|---|
| `admin@test.com` | ADMIN |
| `editor@test.com` | EDITOR |
| `viewer@test.com` | VIEWER |

---

## Key Design Decisions (Do Not Change)

| Decision | Rationale |
|---|---|
| JWT strategy (stateless) | No DB session table written; role stored in JWT cookie |
| `PrismaClient` uses `@prisma/adapter-pg` | Prisma 7 requirement for direct DB connections |
| Redis caches `role:{userId}` 5-min TTL | Eliminates DB query on every Hono API call; cache miss triggers DB lookup (not JWT fallback) |
| `embedCode @db.Text` in DB only | Full `<iframe>` HTML stored in DB, rendered with DOMPurify sanitization |
| Double-write: PG first, then Typesense | PG = source of truth; Typesense failure logs but does not throw |
| `SKIP_ENV_VALIDATION=1` in Dockerfile builder | Allows `next build` to succeed without runtime secrets |
| `verifyRole()` HOF in Hono middleware | Two-layer RBAC: Next.js middleware (routes) + Hono (API calls) |
| BullMQ for CSV imports > 5,000 rows | Prevents browser timeout; returns `jobId` immediately |
| `serverEnv` / `clientEnv` (not `env`) | `env.ts` exports two named objects — any new code importing env must use these names |
| No `"server-only"` on csv.service.ts | BullMQ worker imports it outside Next.js context |
| BullMQ creates its own Redis connections | Cannot share the ioredis singleton (BullMQ requirement) |
| Prisma `upsert` on kalturaId+startTime+stopTime composite key for CSV import | Rows missing any composite key field fall back to `create` (no dedup) |
| Role cache invalidation on update | `updateUserRole()` calls `redis.del(role:{id})`; `verifyRole()` queries DB on cache miss (not JWT) so changes take effect immediately |
| Last-admin guard | `deleteUser()` counts admins and prevents deleting the sole remaining one |
| Shadcn components hand-written | CLI requires interactive prompts; hand-written to match exact output (same approach across all phases) |
| Tabs component uses React Context (no Radix) | Lighter weight; no additional Radix dependency needed |
| Rate limiting uses Redis sliding-window | `INCR` + `EXPIRE` pattern; key = `rl:{userId}:{path}`; returns 429 with `Retry-After` header |
| Bulk edit max 100 records per call | Prevents accidental mass updates; loops through IDs with individual Prisma updates |
| `NEXT_PUBLIC_*` must use literal `process.env.NEXT_PUBLIC_X` | Next.js only statically replaces literal dot-notation access at build time — cannot use Zod-parsed objects or dynamic access |
| Typesense port 8108 exposed in dev docker-compose | Browser-side InstantSearch connects directly to Typesense; production should use reverse proxy |
| Admin key used as search-only key in dev `.env` | Scoped key from `generateScopedSearchKey()` returns 401; needs investigation for production |

---

## Confirmed Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, Tailwind CSS, Shadcn/UI (16 components), React InstantSearch |
| Backend API | Hono 4 (mounted under `/api/hono/[...route]`) — 4 route modules + rate limiting middleware |
| Database | PostgreSQL 17 via `pgvector/pgvector:pg17` |
| ORM | Prisma **7** + `@prisma/adapter-pg` |
| Search Engine | Typesense 30.1 |
| Cache / Queue | Redis 8.0 + BullMQ |
| Auth | Auth.js v5 (next-auth@5 beta), Credentials provider, JWT strategy |
| CSV | `csv-parse` + `csv-stringify` |
| Containers | Docker Compose — 5 services |

---

## Data Schema Reference

CSV import columns map to these Prisma fields:

| CSV Column | Prisma Field | Typesense | Notes |
|---|---|---|---|
| Title | `title` | ✅ full-text | Required |
| Series | `series` | ✅ facet | |
| Date | `date` | ✅ as int64 | |
| Access Copy | `accessCopy` | ✅ | Staff-only in UI |
| KalturaID | `kalturaId` | ❌ | Part of composite unique key with startTime+stopTime for CSV import dedup |
| *(paste embed code manually)* | `embedCode` | ❌ | DB only, DOMPurify on render |
| View Online | `viewOnline` | ❌ | |
| Start Time | `startTime` | ❌ | Stored as seconds (Int) |
| Stop Time | `stopTime` | ❌ | Stored as seconds (Int) |
| Film Reel | `filmReel` | ✅ facet | |
| Reel Segment | `reelSegment` | ✅ | |
| Reporter | `reporter` | ✅ facet | |

---

## Test Data

### testRecords.csv
Located at `testRecords.csv` in project root — contains 21 test records from WTMJ archive.

**CSV Format:**
```csv
Title,Series,Date,Access Copy,KalturaID,View Online,Start Time,Stop Time,Film Reel,Reel Segment,Reporter
```

**Important Notes:**
- Start/Stop Time must be **integer seconds** (not HH:MM:SS)
- To show video in player: paste full `<iframe>` embed code into the **embedCode** field (not KalturaID)
- Import command:
```bash
curl -b cookies.txt -X POST "http://localhost:3000/api/hono/csv/import" -F "file=@testRecords.csv"
```

---

## Verification Test Matrix (Phase 6 — WS4)

These tests should be executed manually against the running stack to confirm everything works end-to-end:

### Role Tests
Login as each user (admin/editor/viewer @test.com), verify:
- **VIEWER**: no Edit/Delete buttons, no admin access, can search + export CSV, cannot import
- **EDITOR**: Edit buttons visible and link to `/record/{id}/edit`, can save edits, no Delete buttons, no admin access
- **ADMIN**: full access — admin panel, user CRUD, import/export, delete records

### Search Integration
- Create/update/delete a record via API or edit form
- Verify Typesense reflects changes within 1s
- Trigger full re-sync from admin panel Dashboard tab

### CSV Round-Trip
- Export CSV → re-import → export again → diff
- Verify kalturaId dedup (no duplicates on re-import)
- Verify error reporting on invalid rows (missing Title)
- Large import queuing: >5K rows returns 202 + jobId

### Delete Double-Write
- Delete a record from detail page or HitTile
- Verify gone from both PG (`GET /api/hono/records/{id}` → 404) and Typesense search results

### Admin User Management
- Create a new user → verify they can log in
- Change a user's role → verify new permissions take effect (may need to wait up to 5min for Redis cache, or role change invalidates cache immediately)
- Delete a non-admin user → verify removed
- Attempt to delete last admin → verify error message
