# MediaArchive

A production-grade media archive search system with advanced faceted search, role-based access control, and batch import/export capabilities.

## Quick Start

### Prerequisites

- Docker Desktop (Windows/macOS/Linux)
- 4GB RAM minimum
- Ports 3000, 5432, 6379, 8108, 80, 443 available

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/greatfog7242/MediaArchive.git
   cd MediaArchive
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Start the stack**
   ```bash
   docker compose up -d
   ```

4. **Verify health**
   ```bash
   curl http://localhost:3000/api/health
   # → {"ok":true,"service":"mediaarchive-app"}
   ```

5. **Access the application**
   - URL: http://localhost:3000
   - Login: http://localhost:3000/login

### Default Test Users

| Email | Password | Role |
|-------|----------|------|
| admin@test.com | password123 | ADMIN |
| editor@test.com | password123 | EDITOR |
| viewer@test.com | password123 | VIEWER |

---

## User Manual

### Authentication

The system uses email/password authentication. Upon successful login, a JWT token is stored as an HTTP-only cookie.

### Roles & Permissions

| Feature | VIEWER | EDITOR | ADMIN |
|---------|--------|--------|-------|
| Search & view records | ✅ | ✅ | ✅ |
| View media player | ✅* | ✅ | ✅ |
| Add new records | ❌ | ✅ | ✅ |
| Edit records | ❌ | ✅ | ✅ |
| Delete records | ❌ | ❌ | ✅ |
| Bulk edit | ❌ | ✅ | ✅ |
| CSV import | ❌ | ✅ | ✅ |
| CSV export | ✅ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ✅ |
| Re-sync search index | ❌ | ❌ | ✅ |

*Session required — unauthenticated users see "Sign in" placeholder

### Searching

- **Search bar**: Full-text search across title, series, reporter, film reel
- **Facets**: Filter by Series, Reporter, Film Reel
- **Debounce**: 150ms delay before search executes
- **Results**: Responsive grid (1→2→3→4 columns)

### Importing Records

CSV format:
```csv
Title,Series,Date,Access Copy,KalturaID,View Online,Start Time,Stop Time,Film Reel,Reel Segment,Reporter
```

**Important:**
- `Start Time` and `Stop Time` must be **integer seconds** (not HH:MM:SS)
- To display video: paste full `<iframe>` embed code into the **embedCode** field (edit the record after import)
- `KalturaID` is used for deduplication — re-importing with same ID updates existing record

**Small files** (≤5,000 rows): Processed synchronously
**Large files** (>5,000 rows): Queued in background, returns job ID for progress tracking

### Exporting Records

Export all records as CSV:
- Navigate to Admin Panel → Dashboard
- Click "Export CSV"

Or use API:
```bash
curl -b cookies.txt http://localhost:3000/api/hono/csv/export -o export.csv
```

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 App Router, Tailwind CSS, Shadcn/UI, React InstantSearch |
| Backend API | Hono (mounted under Next.js API routes) |
| Database | PostgreSQL 17 via `pgvector/pgvector:pg17` |
| ORM | Prisma 7 |
| Search Engine | Typesense 30.1 |
| Cache / Queue | Redis 8.0 + BullMQ |
| Auth | Auth.js v5 (Credentials provider, JWT strategy) |

### System Diagram

```
┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Next.js    │
└─────────────┘     │   (Hono)    │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │PostgreSQL│      │Typesense │      │   Redis  │
   │   (PG)   │◀────▶│ (Search) │      │ (Cache)  │
   └──────────┘      └──────────┘      └──────────┘
```

### API Routes

| Method | Endpoint | Min Role | Description |
|--------|----------|----------|-------------|
| GET | `/api/hono/records` | VIEWER | List/search records |
| GET | `/api/hono/records/:id` | VIEWER | Get single record |
| POST | `/api/hono/records` | EDITOR | Create record |
| PUT | `/api/hono/records/:id` | EDITOR | Update record |
| DELETE | `/api/hono/records/:id` | ADMIN | Delete record |
| POST | `/api/hono/records/bulk` | EDITOR | Bulk update |
| POST | `/api/hono/csv/import` | ADMIN | Import CSV |
| GET | `/api/hono/csv/export` | VIEWER | Export CSV |
| POST | `/api/hono/sync` | ADMIN | Re-sync search index |
| GET | `/api/hono/users` | ADMIN | List users |
| POST | `/api/hono/users` | ADMIN | Create user |
| PUT | `/api/hono/users/:id/role` | ADMIN | Change user role |
| DELETE | `/api/hono/users/:id` | ADMIN | Delete user |

### Database Schema

**users**
| Column | Type | Description |
|--------|------|-------------|
| id | String (cuid) | Primary key |
| email | String | Unique |
| name | String | Display name |
| passwordHash | String | Bcrypt hash |
| role | Enum | ADMIN, EDITOR, VIEWER |

**media_records**
| Column | Type | Description |
|--------|------|-------------|
| id | String (cuid) | Primary key |
| title | String | Required |
| series | String | Faceted |
| date | DateTime | Sortable |
| accessCopy | String | Staff-only |
| kalturaId | String | Unique, for dedup |
| embedCode | Text | Full iframe HTML |
| viewOnline | String | External link |
| startTime | Int | Seconds |
| stopTime | Int | Seconds |
| filmReel | String | Faceted |
| reelSegment | String | |
| reporter | String | Faceted |
| lastModifiedById | String | FK to user |

### Double-Write Pattern

Every data mutation writes to PostgreSQL first, then synchronizes to Typesense:

```
User Request → Validate → PostgreSQL → Typesense (non-throwing)
                                ↓
                           Log on failure
```

If Typesense sync fails, the operation still succeeds (PostgreSQL is the source of truth), and the failure is logged for manual reconciliation.

### Rate Limiting

Applied to mutation endpoints:

| Endpoint | Limit |
|----------|-------|
| POST /records/bulk | 10/min |
| POST /records | 60/min |
| DELETE /records/:id | 30/min |
| POST /csv/import | 5/min |

---

## Development

### Project Structure

```
MediaArchive/
├── docker-compose.yml          # 5-container orchestration
├── .env                       # secrets (gitignored)
├── .env.example               # template
├── docker/
│   ├── postgres/init.sql      # pgvector extension
│   └── caddy/Caddyfile       # reverse proxy
└── apps/web/
    ├── Dockerfile             # multi-stage build
    ├── prisma/
    │   ├── schema.prisma     # DB schema
    │   └── seed.ts           # test users
    └── src/
        ├── app/               # Next.js pages
        ├── components/         # React components
        ├── hooks/              # custom hooks
        ├── lib/                # utilities
        └── server/             # API, services, workers
```

### Running Commands

**Database migration:**
```bash
docker compose exec -u root app npx prisma migrate dev --name <name>
```

**Seed database:**
```bash
docker compose exec app npx tsx prisma/seed.ts
```

**Init Typesense:**
```bash
docker compose exec -u root app sh -c "
  TYPESENSE_HOST=typesense TYPESENSE_PORT=8108 TYPESENSE_API_KEY=your_key
  npx tsx scripts/init-typesense.ts
"
```

### Troubleshooting

**Container won't start:**
```bash
docker compose logs app
```

**Database connection error:**
- Check PostgreSQL container: `docker compose ps`
- Verify DATABASE_URL in .env

**Search not working:**
- Check Typesense: `curl http://localhost:8108/collections`
- Re-sync: POST /api/hono/sync (as ADMIN)

**Session expired immediately:**
- Check AUTH_SECRET is at least 32 characters
- Verify Redis is healthy

---

## Deployment

### Production Considerations

1. **Secrets**: Use strong passwords, store in secrets manager
2. **Typesense**: Don't expose port 8108 publicly — use reverse proxy
3. **HTTPS**: Configure Caddy with valid certificates
4. **Backup**: Set up automated PostgreSQL backups
5. **Monitoring**: Add healthcheck alerts

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| POSTGRES_USER | DB username | mediaarchive |
| POSTGRES_PASSWORD | DB password | changeme |
| POSTGRES_DB | Database name | mediaarchive_db |
| AUTH_SECRET | JWT signing key | 32+ random chars |
| NEXTAUTH_URL | App URL | https://archive.example.com |
| TYPESENSE_API_KEY | Admin API key | changeme |
| REDIS_PASSWORD | Redis password | changeme |

---

## License

Private — All rights reserved.
