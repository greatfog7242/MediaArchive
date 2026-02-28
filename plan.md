# MediaArchive: Implementation Plan

## Context
Building a greenfield production-grade media archive search system. No source code exists yet — only project skill/config files. The system needs advanced faceted search, a media player driven by stored embed codes, role-based access, batch import/export, and full audit logging — all containerized via Docker Compose.

---

## Confirmed Decisions
- **Auth:** Email + Password (Credentials provider via Auth.js v5; JWT strategy — stateless cookies, no DB session table needed)
- **Session Performance:** Redis caches decoded role lookups (`userId → role`, 5-min TTL) in `verifyRole()` — eliminates repeated JWT decoding on every API request
- **Media Player:** Render stored Kaltura `<iframe>` embed code directly from the DB
- **Deployment:** Local/internal server (Caddy included but optional; dev runs on port 3000)

---

## Tech Stack (from project SKILL.md — non-negotiable)
| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, Tailwind CSS, Shadcn/UI, React InstantSearch |
| Backend API | Hono (mounted under Next.js API routes) |
| Database | PostgreSQL 18 via `pgvector/pgvector:pg18` |
| ORM | Prisma 6 |
| Search Engine | Typesense 30.1 |
| Cache | Redis 8.0 |
| Auth | Auth.js v5 (NextAuth) |
| Containers | Docker Compose — 5 services |

---

## Project Directory Structure

```
MediaArchive/
├── docker-compose.yml
├── .env                         # local secrets (gitignored)
├── .env.example                 # committed template
├── .gitignore
├── CLAUDE.md
├── plan.md                      # this file
├── docker/
│   ├── postgres/init.sql
│   └── caddy/Caddyfile
└── apps/web/
    ├── Dockerfile               # multi-stage: deps → builder → runner
    ├── package.json
    ├── tsconfig.json            # strict: true
    ├── next.config.ts           # output: "standalone"
    ├── tailwind.config.ts
    ├── prisma/schema.prisma
    └── src/
        ├── middleware.ts        # RBAC edge middleware
        ├── app/
        │   ├── layout.tsx
        │   ├── globals.css
        │   ├── (public)/login/page.tsx
        │   ├── (protected)/
        │   │   ├── layout.tsx
        │   │   ├── search/page.tsx
        │   │   └── record/[id]/page.tsx
        │   ├── (admin)/
        │   │   ├── layout.tsx
        │   │   └── admin/
        │   │       ├── page.tsx
        │   │       └── users/page.tsx
        │   └── api/
        │       ├── auth/[...nextauth]/route.ts
        │       └── hono/[...route]/route.ts
        ├── server/
        │   ├── auth.ts
        │   ├── db.ts
        │   ├── redis.ts
        │   ├── typesense.ts
        │   ├── api/
        │   │   ├── index.ts
        │   │   ├── middleware/
        │   │   │   └── verify-role.ts     # ← verifyRole() HOF
        │   │   └── routes/
        │   │       ├── records.ts
        │   │       ├── import.ts
        │   │       ├── export.ts
        │   │       ├── bulk.ts
        │   │       ├── sync.ts
        │   │       └── users.ts
        │   ├── actions/record.actions.ts
        │   ├── queues/
        │   │   └── import.queue.ts        # BullMQ job queue for large CSV imports
        │   └── services/
        │       ├── record.service.ts
        │       ├── typesense.service.ts
        │       ├── import.service.ts
        │       └── user.service.ts
        ├── components/
        │   ├── ui/
        │   ├── layout/
        │   │   ├── AppShell.tsx
        │   │   ├── TopBar.tsx
        │   │   └── UserMenu.tsx
        │   ├── search/
        │   │   ├── SearchBox.tsx
        │   │   ├── HitsGrid.tsx           # responsive tile grid container
        │   │   ├── HitTile.tsx            # individual tile card
        │   │   ├── FacetPanel.tsx
        │   │   ├── FacetList.tsx
        │   │   └── ActiveFilters.tsx
        │   ├── media/
        │   │   ├── EmbedPlayer.tsx        # session-gated iframe renderer
        │   │   └── MetadataPanel.tsx      # full / staff-only split
        │   └── admin/
        │       ├── RecordForm.tsx
        │       ├── RecordTable.tsx
        │       ├── BulkEditDialog.tsx
        │       ├── ImportDialog.tsx
        │       ├── ExportMenu.tsx
        │       └── UserTable.tsx          # ADMIN only
        ├── hooks/
        │   ├── use-debounce.ts
        │   └── use-role.ts
        ├── lib/
        │   ├── env.ts                     # Zod env validation
        │   ├── typesense-adapter.ts
        │   └── utils.ts
        └── types/
            ├── auth.d.ts
            ├── media-record.ts
            └── api.ts
```

---

## Prisma Schema (Critical)

```prisma
enum Role { ADMIN  EDITOR  VIEWER }

model User {
  id               String        @id @default(cuid())
  email            String        @unique
  name             String?
  image            String?
  passwordHash     String?
  role             Role          @default(VIEWER)
  emailVerified    DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  accounts         Account[]
  sessions         Session[]
  modifiedRecords  MediaRecord[] @relation("LastModifiedBy")
  @@map("users")
}

model MediaRecord {
  id               String    @id @default(cuid())
  title            String
  series           String?
  date             DateTime?
  accessCopy       String?
  kalturaId        String?   @unique
  embedCode        String?   @db.Text   // full <iframe> HTML
  viewOnline       String?
  startTime        Int?                 // seconds
  stopTime         Int?                 // seconds
  filmReel         String?
  reelSegment      String?
  reporter         String?
  lastModified     DateTime  @updatedAt
  createdAt        DateTime  @default(now())

  // Audit: which EDITOR last touched this record
  lastModifiedById String?
  lastModifiedBy   User?     @relation("LastModifiedBy", fields: [lastModifiedById], references: [id])

  @@index([series])
  @@index([reporter])
  @@index([filmReel])
  @@index([lastModifiedById])
  @@map("media_records")
}
// + Auth.js adapter models: Account, Session, VerificationToken
```

**Key fields:**
- `embedCode @db.Text` — no length limit; excluded from Typesense
- `lastModifiedById` — audit trail: FK to User; set on every mutation by the service layer
- `kalturaId @unique` — deduplication anchor for CSV imports

---

## Typesense Collection Schema

- **Facet fields:** `series`, `reporter`, `filmReel`
- **Full-text query fields:** `title, series, reporter, filmReel, reelSegment, accessCopy`
- `date` / `lastModified` stored as `int64` Unix timestamps (range filtering + sorting)
- `embedCode`, `lastModifiedById` — **excluded** (DB-only fields)
- **Two API keys:**
  - Admin key (server-only, in `serverEnv`) — full read/write access
  - Search-only key (browser-safe, `NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY`) — query + facet only; cannot delete index
- **Key generation:** `scripts/init-typesense.ts` runs automatically via Docker `ENTRYPOINT` on first `docker compose up`. Generates the search-only key using Typesense's keys API. Key is written back to the running env (or logged for manual insertion into `.env`).
- **Future-proofing:** Key generated with `embedded_operations_only: false` and optionally `filter_by` constraints so private collections can be scoped per-user in a future phase without regenerating keys.

---

## Secrets Management (.env.example)

```bash
# Database
POSTGRES_USER=mediaarchive
POSTGRES_PASSWORD=changeme
POSTGRES_DB=mediaarchive_db
DATABASE_URL=postgresql://mediaarchive:changeme@postgres:5432/mediaarchive_db

# Auth.js v5
AUTH_SECRET=changeme_min_32_chars
NEXTAUTH_URL=http://localhost:3000

# Typesense
TYPESENSE_API_KEY=changeme_admin_key
TYPESENSE_SEARCH_ONLY_KEY=changeme_search_only_key   # generated at first startup

# Redis
REDIS_PASSWORD=changeme

# Public (safe for browser bundle)
NEXT_PUBLIC_TYPESENSE_HOST=localhost
NEXT_PUBLIC_TYPESENSE_PORT=8108
NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY=changeme_search_only_key
```

All env vars validated at startup via `src/lib/env.ts` (Zod). App will **crash fast** with a clear error if any required var is missing.

---

## Media Player Design

**Component:** `src/components/media/EmbedPlayer.tsx`

- **Session-gated:** Component checks for a valid session before rendering the iframe. If no session, shows a "Sign in to view" placeholder — prevents unauthenticated embed access.
- **XSS sanitization:** `DOMPurify` (client-only import) strips everything except `<iframe>` tags from `*.kaltura.com`

```tsx
export function EmbedPlayer({ embedCode, session }: Props) {
  if (!session) return <SignInPrompt />;
  if (!embedCode) return <PlaceholderPoster />;
  const clean = DOMPurify.sanitize(embedCode, {
    ALLOWED_TAGS: ["iframe"],
    ALLOWED_ATTR: ["src", "width", "height", "allowfullscreen", "frameborder", "style"],
    ALLOWED_URI_REGEXP: /^https:\/\/([\w-]+\.)?kaltura\.com/,
  });
  return <div className="aspect-video w-full" dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

---

## Docker Compose (5 Services)

| # | Service | Image | Host Port | Volume |
|---|---------|-------|-----------|--------|
| 1 | postgres | `pgvector/pgvector:pg18` | — | `pgdata` |
| 2 | typesense | `typesense/typesense:30.1` | `8108` | `tsdata` |
| 3 | redis | `redis:8.0-alpine` | — | `redis_data` |
| 4 | app | local Dockerfile | `3000` | — |
| 5 | caddy | `caddy:2-alpine` | `80`, `443` | Caddyfile |

- `app` depends on postgres/typesense/redis with `condition: service_healthy`
- Named volumes prevent data loss across `docker compose down`

---

## RBAC Summary

| Action | VIEWER | EDITOR | ADMIN |
|--------|--------|--------|-------|
| Search & view records | ✅ | ✅ | ✅ |
| View media player | ✅* | ✅ | ✅ |
| View basic metadata | ✅ | ✅ | ✅ |
| View **advanced metadata** | ❌ | ✅ | ✅ |
| Add / Edit records | ❌ | ✅ | ✅ |
| Delete records | ❌ | ❌ | ✅ |
| Batch import / export | ❌ | ✅ | ✅ |
| Manage users / roles | ❌ | ❌ | ✅ |
| Re-sync Typesense index | ❌ | ❌ | ✅ |

*Session required — unauthenticated users cannot see the player.

**Advanced Metadata** (EDITOR/ADMIN only): `accessCopy`, `kalturaId`, `embedCode` preview, `lastModifiedBy`, `createdAt`. These are internal operational fields not relevant to end-user search.

Enforced at **two independent layers:**
1. **Next.js Middleware** (`middleware.ts`) — redirects by route prefix before any server code runs
2. **Hono `verifyRole()` middleware** — re-checks session role on every API call independently

---

## Hono `verifyRole()` Middleware

**File:** `src/server/api/middleware/verify-role.ts`

Uses Redis to cache the decoded role per `userId` (5-min TTL). On the first request the JWT is decoded and the role is written to Redis. Subsequent requests for the same user within the TTL skip JWT decoding entirely.

```typescript
import type { Context, Next } from "hono";
import { auth } from "@/server/auth";
import { redis } from "@/server/redis";
import type { Role } from "@prisma/client";

export function verifyRole(allowedRoles: Role[]) {
  return async (c: Context, next: Next) => {
    const session = await auth();
    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Redis role cache: key = "role:{userId}", TTL = 300s
    const cacheKey = `role:${session.user.id}`;
    let role = (await redis.get(cacheKey)) as Role | null;
    if (!role) {
      role = session.user.role as Role;
      await redis.setex(cacheKey, 300, role);
    }

    if (!allowedRoles.includes(role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    c.set("session", { ...session, user: { ...session.user, role } });
    await next();
  };
}

// Note: when an ADMIN changes a user's role, invalidate their cache key:
// await redis.del(`role:${userId}`);

// Usage in routes:
// app.post("/records", verifyRole(["ADMIN", "EDITOR"]), async (c) => { ... });
// app.delete("/records/:id", verifyRole(["ADMIN"]), async (c) => { ... });
```

---

## API Endpoints

| Method | Path | Min Role | Notes |
|--------|------|----------|-------|
| GET | `/api/hono/records` | VIEWER | Paginated list |
| GET | `/api/hono/records/:id` | VIEWER | Includes embedCode |
| POST | `/api/hono/records` | EDITOR | Create + double-write; sets `lastModifiedById` |
| PUT | `/api/hono/records/:id` | EDITOR | Update + double-write; updates `lastModifiedById` |
| DELETE | `/api/hono/records/:id` | ADMIN | Delete from PG + Typesense |
| POST | `/api/hono/import` | EDITOR | CSV upload → batch upsert |
| GET | `/api/hono/export` | EDITOR | `?format=csv\|json` |
| POST | `/api/hono/bulk` | EDITOR | Bulk field update; updates `lastModifiedById` on all affected records |
| POST | `/api/hono/sync` | ADMIN | Full PG → Typesense re-index |
| GET | `/api/hono/users` | ADMIN | List users |
| PUT | `/api/hono/users/:id/role` | ADMIN | Change role |
| DELETE | `/api/hono/users/:id` | ADMIN | Remove user |

---

## Double-Write Pattern (record.service.ts)

Every mutation also stamps the audit field:

```typescript
async update(id: string, data: UpdateInput, editorId: string) {
  // 1. Write to PostgreSQL with audit stamp
  const record = await prisma.mediaRecord.update({
    where: { id },
    data: { ...data, lastModifiedById: editorId },
  });
  // 2. Sync to Typesense (log on failure, do NOT throw)
  try {
    await typesenseService.upsert(record);
  } catch (err) {
    console.error(`[Typesense] sync failed for ${record.id}:`, err);
  }
  return record;
}
```

`embedCode` and `lastModifiedById` are written to PostgreSQL only — excluded from the Typesense document.

---

## Batch Import/Export

**Import (CSV) — two paths based on file size:**

*Small files (≤ 5,000 rows):*
- Drag-drop in `ImportDialog` → POST multipart to `/api/hono/import`
- Stream-parse via `csv-parse`, validate each row with Zod
- `prisma.mediaRecord.createMany({ skipDuplicates: true })` in batches of 500
- Typesense bulk upsert via JSONL endpoint
- Synchronous response: `{ imported, skipped, errors: [{ row, reason }] }`

*Large files (> 5,000 rows):*
- Same upload endpoint detects row count after parse; offloads to a **BullMQ job** (`src/server/queues/import.queue.ts`) backed by Redis
- API returns immediately with `{ jobId }` — browser doesn't wait for writes to finish
- Frontend polls `GET /api/hono/import/status/:jobId` (or uses **Server-Sent Events**) to stream progress: `{ processed, total, errors }`
- `ImportDialog` shows a live progress bar during the job
- Prevents browser timeout on 10,000+ row imports

**Export:** Streaming response via `csv-stringify` / NDJSON. Respects active search filters.

**Bulk Edit:** `updateMany` on selected IDs → Typesense batch upsert. Sets `lastModifiedById` on all affected rows.

---

## Conditional Frontend UI

Components check `session.user.role` from `useSession()` / Server Component session:

| Component | Condition |
|-----------|-----------|
| `EmbedPlayer` | Renders only if `session` exists |
| Edit / Delete buttons in `HitTile` | Rendered only if role is `ADMIN` or `EDITOR` |
| `BulkEditDialog`, `ImportDialog`, `ExportMenu` | EDITOR+ only |
| **Advanced Metadata** section in `MetadataPanel` | EDITOR+ only (hides `accessCopy`, `kalturaId`, `lastModifiedBy`) |
| Admin Panel link in `TopBar` | ADMIN only |
| `UserTable` page | ADMIN only (enforced at route + middleware level) |

The `use-role.ts` hook encapsulates this logic: `const { isAdmin, isEditor, canMutate } = useRole()`.

---

## Frontend Layout

```
┌─────────────────── TopBar ────────────────────────┐ [Login / Avatar]
├──────────────┬────────────────────────────────────┤
│ FacetPanel   │  SearchBox (150ms debounce)         │
│              ├────────────────────────────────────┤
│ ▸ Series     │  HitsGrid (responsive tile grid)   │
│ ▸ Reporter   │  ┌────────┐ ┌────────┐ ┌────────┐ │
│ ▸ Film Reel  │  │[thumb] │ │[thumb] │ │[thumb] │ │
│              │  │ Title  │ │ Title  │ │ Title  │ │
│ ActiveFilter │  │ Series │ │ Series │ │ Series │ │
│              │  │ Date   │ │ Date   │ │ Date   │ │
│              │  │[E][D]* │ │[E][D]* │ │[E][D]* │ │
│              │  └────────┘ └────────┘ └────────┘ │
│              │  ┌────────┐ ┌────────┐  ...        │
└──────────────┴────────────────────────────────────┘
  Grid: 2 cols (md) → 3 cols (lg) → 4 cols (xl)
  * [E]dit / [D]elete only visible to EDITOR/ADMIN

Record Detail page:
┌───────────────────────────────────────────────────┐
│  EmbedPlayer (session-gated iframe, aspect-video) │
├───────────────────────────────────────────────────┤
│  MetadataPanel                                    │
│    Basic fields (all roles)                       │
│    ── Advanced Metadata (EDITOR/ADMIN only) ──    │
│    accessCopy │ kalturaId │ lastModifiedBy        │
└───────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1 — Infrastructure & Auth Foundation
*Goal: 5 containers running + identity layer in place*
1. `docker-compose.yml` — all 5 services with healthchecks and named volumes
2. `apps/web/Dockerfile` — multi-stage, `output: "standalone"`
3. `apps/web/package.json` — all dependencies
4. `.env`, `.env.example`, `.gitignore`
5. `src/lib/env.ts` — Zod env schema (fails fast if secrets missing)
6. `src/server/auth.ts` — Credentials provider; JWT strategy (stateless, no session table); role embedded in JWT token
7. `src/app/api/auth/[...nextauth]/route.ts`
8. `src/app/(public)/login/page.tsx`
9. `docker compose up --build` → verify all healthchecks pass; seed 3 test users

### Phase 2 — Enhanced Data Modeling (RBAC Schema)
*Goal: Canonical schema with audit trail*
1. `prisma/schema.prisma` — User (with `passwordHash`, `role`), MediaRecord (with `embedCode`, `lastModifiedById`), Auth.js adapter tables
2. `prisma migrate dev --name init`
3. `src/server/db.ts`, `typesense.ts`, `redis.ts` singletons
4. `src/server/services/typesense.service.ts` — collection schema, upsert/delete/bulk-sync
5. `scripts/init-typesense.ts` — create collection + generate search-only key with scoped constraints; triggered automatically by Docker `ENTRYPOINT` wrapper on first `docker compose up`; idempotent (skips if collection already exists)
6. `src/server/api/middleware/verify-role.ts` — Redis role cache (`role:{userId}`, 5-min TTL); invalidate on role change
7. Verify `lastModifiedById` FK populates on record create/update

### Phase 3 — Middleware & Route Protection
*Goal: All 3 role "walls" enforced*
1. `src/middleware.ts` — Next.js edge middleware: `/admin/*` → ADMIN only; `/search/*` → any session
2. `src/server/api/middleware/verify-role.ts` — `verifyRole()` HOF for Hono routes
3. `src/server/api/index.ts` — Hono app factory with logger + CORS
4. `src/app/api/hono/[...route]/route.ts` — mount Hono
5. All route files apply `verifyRole()` per the endpoint table above
6. Manual test: VIEWER curl → `DELETE /api/hono/records/:id` must return 403

### Phase 4 — Sync Engine & Search Permissioning
*Goal: Double-write pattern + secure search keys*
1. `src/server/services/record.service.ts` — `create`, `update`, `delete` with double-write + `lastModifiedById` stamping
2. `src/server/api/routes/records.ts` — full CRUD using `verifyRole()`
3. Search-only Typesense key generated in `init-typesense.ts`; stored as `TYPESENSE_SEARCH_ONLY_KEY` env var
4. `src/lib/typesense-adapter.ts` — InstantSearch adapter configured with search-only key
5. `src/server/api/routes/sync.ts` — full PG → Typesense re-index (ADMIN only)
6. Test: update a record → verify PG updated AND Typesense document updated within 1s

### Phase 5 — Conditional Frontend UI
*Goal: Search + media player + role-aware components*
1. `InstantSearchProvider`, `SearchBox` (150ms debounce), `HitsGrid`, `HitTile`, `FacetPanel`, `FacetList`, `ActiveFilters`
2. `AppShell`, `TopBar`, `UserMenu` (login/avatar)
3. `use-role.ts` hook — `isAdmin`, `isEditor`, `canMutate` helpers
4. Edit/Delete buttons in `HitCard` — conditionally rendered via `canMutate`
5. `EmbedPlayer.tsx` — session-gated; DOMPurify sanitized
6. `MetadataPanel.tsx` — basic fields for VIEWER; advanced section for EDITOR/ADMIN
7. `app/(protected)/search/page.tsx` and `record/[id]/page.tsx`
8. Test: VIEWER sees no Edit/Delete buttons; Advanced Metadata section hidden

### Phase 6 — Batch Operations, Admin Panel & Testing
*Goal: Full feature completeness + security verification*
1. `import.service.ts`, `import.ts` (with size-based routing), `export.ts`, `bulk.ts` routes
2. `src/server/queues/import.queue.ts` — BullMQ worker; processes large CSV jobs in background; emits progress events
3. `GET /api/hono/import/status/:jobId` — SSE endpoint for live progress streaming
4. `ImportDialog` (with progress bar for large files), `ExportMenu`, `BulkEditDialog` components
3. `RecordForm`, `RecordTable` — admin records management page
4. `users.ts` route + `UserTable` — ADMIN user management
5. **Role impersonation tests:**
   - VIEWER: `POST /api/hono/records` → 403
   - VIEWER: `DELETE /api/hono/records/:id` → 403 (even with valid session token)
   - EDITOR: `DELETE /api/hono/records/:id` → 403
   - EDITOR: `PUT /api/hono/users/:id/role` → 403
6. **Audit log test:** Edit a record as EDITOR → query `lastModifiedBy` on the record → returns the EDITOR's user ID
7. Redis caching for hot search queries; Hono rate limiting
8. `tsc --noEmit` — zero type errors; ESLint `no-explicit-any: error`

---

## Verification Checklist

**Infrastructure**
- [ ] `docker compose up` → all 5 containers show `healthy`
- [ ] App crashes at startup if `AUTH_SECRET` is missing (Zod env check)

**Authentication**
- [ ] Login with valid credentials → JWT contains `role`
- [ ] Invalid credentials → 401 from Auth.js
- [ ] Unauthenticated request to `/search` → redirected to `/login`

**RBAC — Middleware Layer**
- [ ] VIEWER navigates to `/admin` → redirected (not 404, not 500)
- [ ] ADMIN navigates to `/admin/users` → renders correctly

**RBAC — API Layer (curl/Postman with VIEWER session token)**
- [ ] `POST /api/hono/records` → 403
- [ ] `DELETE /api/hono/records/:id` → 403
- [ ] `PUT /api/hono/users/:id/role` → 403

**Search**
- [ ] Search-only Typesense key cannot delete a collection (returns 401 from Typesense)
- [ ] Search results appear within 150ms of debounce
- [ ] Series / Reporter / Film Reel facets filter correctly

**Media Player**
- [ ] Unauthenticated user on `/record/:id` → sees "Sign in to view" placeholder
- [ ] VIEWER with session → EmbedPlayer renders Kaltura iframe
- [ ] Malicious `<script>` in `embedCode` → DOMPurify strips it, only iframe remains

**Conditional UI**
- [ ] VIEWER: Edit/Delete buttons absent from HitCard
- [ ] VIEWER: Advanced Metadata section absent from MetadataPanel
- [ ] EDITOR: Advanced Metadata visible; Delete button absent

**Audit Trail**
- [ ] EDITOR creates a record → `lastModifiedById` in DB = EDITOR's user ID
- [ ] EDITOR updates a record → `lastModifiedById` updated correctly
- [ ] ADMIN bulk-edits 5 records → all 5 show ADMIN's `lastModifiedById`

**Batch Operations**
- [ ] Import 100-row CSV (small path) → all rows in PG + Typesense; error rows reported
- [ ] Import 6,000-row CSV (large path) → returns `jobId` immediately; progress bar increments; completes without browser timeout
- [ ] Role change for a user → Redis cache key `role:{userId}` invalidated; next API call reflects new role within same request
- [ ] Export CSV → row count matches `prisma.mediaRecord.count()`
- [ ] Bulk edit `series` on 10 records → all 10 updated in PG + Typesense
- [ ] `docker compose up` on fresh machine → `init-typesense.ts` runs automatically; search-only key generated; app starts without manual intervention
