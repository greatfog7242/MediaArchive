# MediaArchive — Media Archive Search System

A production-grade media archive search system with advanced faceted search, role-based access control, and batch import/export capabilities. Built for archival institutions to manage and search media collections with fine-grained access control.

## 📋 Table of Contents
1. [🚀 Quick Start](#-quick-start)
   - [Prerequisites](#prerequisites)
   - [One-Command Setup](#one-command-setup)
   - [First-Time Setup](#first-time-setup-commands)
   - [Default Test Users](#default-test-users)

2. [📖 User Manual](#-user-manual)
   - [Getting Started](#getting-started)
   - [Authentication & Security](#-authentication--security)
   - [Roles & Permissions](#-roles--permissions)
   - [Search Interface](#-search-interface)
   - [Working with Records](#-working-with-records)
   - [Bulk Operations](#-bulk-operations)
   - [Admin Panel](#-admin-panel-admin-only)

3. [🏗️ Architecture](#-architecture)
   - [Tech Stack](#tech-stack-2026)
   - [System Architecture](#system-architecture-diagram)
   - [Double-Write Pattern](#-double-write-search-pattern)
   - [Performance & Scalability](#-performance--scalability)

4. [🛠️ Development](#-development)
   - [Project Structure](#project-structure)
   - [Development Commands](#development-commands)
   - [Troubleshooting Guide](#-troubleshooting-guide)

5. [📡 API Reference](#-api-reference)
   - [Records API](#records-api)
   - [CSV API](#csv-api)
   - [Users API](#users-api-admin-only)
   - [System API](#system-api)

6. [🚀 Deployment](#-deployment)
   - [Production Checklist](#production-checklist)
   - [Environment Variables](#environment-variables-reference)
   - [Deployment Options](#deployment-options)
   - [Monitoring & Maintenance](#monitoring--maintenance)

7. [❓ FAQ](#-faq)
   - [General Questions](#general-questions)
   - [Data Management](#data-management)
   - [Technical Questions](#technical-questions)
   - [Troubleshooting](#troubleshooting-1)
   - [Scaling & Performance](#scaling--performance)

8. [📄 License & Support](#-license)

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** (Windows/macOS/Linux) or Docker Engine + Docker Compose
- **4GB RAM** minimum (8GB recommended for production)
- **Ports available**: 3000, 5432, 6379, 8108, 80, 443
- **Disk space**: 2GB minimum for database and media storage

### One-Command Setup

```bash
# 1. Clone the repository
git clone https://github.com/greatfog7242/MediaArchive.git
cd MediaArchive

# 2. Copy environment template
cp .env.example .env

# 3. Start all services
docker compose up -d

# 4. Wait for services to be healthy (check status)
docker compose ps

# 5. Verify application is running
curl http://localhost:3000/api/health
# Expected: {"ok":true,"service":"mediaarchive-app"}

# 6. Access the application
# Open browser to: http://localhost:3000
# Login page: http://localhost:3000/login
```

### First-Time Setup Commands

After starting the stack for the first time, run these initialization commands:

```bash
# Initialize Typesense search index (run once)
docker compose exec -u root app \
  sh -c "TYPESENSE_HOST=typesense TYPESENSE_PORT=8108 TYPESENSE_API_KEY=dev_typesense_admin_key \
  npx tsx scripts/init-typesense.ts"

# Seed database with test users
docker compose exec app npx tsx prisma/seed.ts

# Import sample data (optional)
curl -b cookies.txt -X POST "http://localhost:3000/api/hono/csv/import" \
  -F "file=@testRecords.csv"
```

### Default Test Users

| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| admin@test.com | password123 | ADMIN | Full system access |
| editor@test.com | password123 | EDITOR | Create, edit, search records |
| viewer@test.com | password123 | VIEWER | Search and view records only |

**Security Note**: Change these passwords immediately in production!

---

## 📖 User Manual

### Getting Started

1. **Login**: Navigate to http://localhost:3000/login
2. **Choose role**: Use appropriate test credentials based on your needs
3. **Dashboard**: After login, you'll be redirected to the search page

### Navigation

- **Search Page** (`/search`): Main interface for searching and browsing records
- **Record Detail** (`/record/[id]`): View individual record with media player
- **Admin Panel** (`/admin`): ADMIN-only dashboard for system management
- **User Menu** (top-right): Profile, role badge, logout

### 🔐 Authentication & Security

The system uses **Auth.js v5** with JWT strategy for authentication:
- **Email/Password**: Primary authentication method
- **JWT Tokens**: Stored as HTTP-only cookies (secure, not accessible via JavaScript)
- **Session Management**: Automatic token refresh, 30-day session duration
- **Password Security**: Bcrypt hashing with 10 rounds

### 👥 Roles & Permissions

#### VIEWER Role
- ✅ Search and browse records
- ✅ View record details and metadata
- ✅ Watch embedded media (if available)
- ✅ Export records as CSV
- ❌ Cannot modify any data
- ❌ Cannot access admin features

#### EDITOR Role (includes all VIEWER permissions)
- ✅ Create new records via form
- ✅ Edit existing records
- ✅ Bulk edit multiple records
- ✅ Import records via CSV
- ❌ Cannot delete records
- ❌ Cannot manage users

#### ADMIN Role (includes all EDITOR permissions)
- ✅ Delete records (with confirmation)
- ✅ Manage users (create, update roles, delete)
- ✅ View system statistics
- ✅ Force re-sync search index
- ✅ Full CSV import/export capabilities

### 🔍 Search Interface

#### Basic Search
1. **Search Box**: Type any keyword in the search bar at the top
2. **Instant Results**: Results update as you type (150ms debounce)
3. **Full-Text Search**: Searches across:
   - Title
   - Series name
   - Reporter name
   - Film reel identifier
   - Reel segment

#### Advanced Filtering
- **Series Filter**: Filter by media series (e.g., "News", "Documentary")
- **Reporter Filter**: Filter by reporter/correspondent
- **Film Reel Filter**: Filter by physical film reel identifier
- **Active Filters**: Clear individual filters or reset all

#### Search Results
- **Responsive Grid**: Automatically adjusts from 1 to 4 columns based on screen size
- **Record Cards**: Each result shows:
  - Title (click to view details)
  - Date
  - Series badge
  - Reporter badge
  - Action buttons (role-dependent)
- **Empty State**: Helpful message when no results found
- **Loading State**: Skeleton loader during search

### 📋 Working with Records

#### Viewing a Record
1. Click any record title from search results
2. **Two-Column Layout**:
   - **Left Column**: Media player (if embed code exists)
   - **Right Column**: Metadata fields
3. **Metadata Sections**:
   - **Basic Information**: Title, date, series (visible to all roles)
   - **Advanced Information**: Access copy, view online link, technical details (EDITOR+ only)
   - **Clip Information**: Start/stop times, film reel, segment
4. **Action Buttons**:
   - **Back**: Return to search
   - **Edit** (EDITOR+): Open edit form
   - **Delete** (ADMIN): Delete with confirmation dialog

#### Creating a New Record (EDITOR+)
1. Navigate to search page
2. Click "Add New Record" button (top-right, EDITOR+ only)
3. Fill in the form with:
   - **Required**: Title
   - **Optional**: All other metadata fields
   - **Kaltura Embed**: Paste full iframe embed code
4. Click "Save" to create record

#### Editing a Record (EDITOR+)
1. From search results: Click "Edit" button on record card
2. From record detail: Click "Edit" button
3. **Edit Form Features**:
   - All fields are editable
   - Date picker for date field
   - Textarea for embed code
   - Client-side validation
4. Changes are saved to both database and search index automatically

#### Deleting a Record (ADMIN only)
1. From search results: Click "Delete" button (with confirmation)
2. From record detail: Click "Delete" button (with confirmation)
3. **Safety Features**:
   - Confirmation dialog prevents accidental deletion
   - Record is removed from both database and search index
   - Action is logged with user audit trail

### 📤 Bulk Operations

#### Bulk Edit (EDITOR+)
1. **Select Records**: Check the checkbox on multiple record cards
2. **Bulk Action Bar**: Appears showing count of selected records
3. **Click "Bulk Edit"**: Opens dialog with common fields
4. **Apply Changes**: Only non-empty fields will be updated
5. **Results**: Shows success count and any errors

**Note**: Limited to 100 records per bulk operation, rate limited to 10 operations per minute.

#### CSV Import (ADMIN only)

##### CSV Format Requirements
```csv
Title,Series,Date,Access Copy,KalturaID,View Online,Start Time,Stop Time,Film Reel,Reel Segment,Reporter
```

##### Field Specifications
| Column | Required | Format | Notes |
|--------|----------|--------|-------|
| Title | Yes | Text | Record title |
| Series | No | Text | Will be available as facet filter |
| Date | No | YYYY-MM-DD | Any valid date format |
| Access Copy | No | Text | Staff-only notes |
| KalturaID | No | Text | **Unique with StartTime+StopTime** - composite key for deduplication |
| View Online | No | URL | External viewing link |
| Start Time | No | Integer | **Seconds** (not HH:MM:SS) from clip start |
| Stop Time | No | Integer | **Seconds** (not HH:MM:SS) from clip start |
| Film Reel | No | Text | Will be available as facet filter |
| Reel Segment | No | Text | Segment identifier |
| Reporter | No | Text | Will be available as facet filter |

##### Import Process
1. **Navigate to Admin Panel** → Dashboard tab
2. **Click "Import CSV"**: Opens import dialog
3. **Select File**: Choose CSV file from your computer
4. **Upload**: File uploads with progress indicator
5. **Processing**:
   - **Small files** (≤5,000 rows): Processed immediately
   - **Large files** (>5,000 rows): Queued for background processing
6. **Results**: Shows import statistics and any validation errors

##### Deduplication Logic
- Records are deduplicated using composite key: `(KalturaID, Start Time, Stop Time)`
- If all three fields match an existing record, it's updated
- If any field differs or is missing, a new record is created
- Records without KalturaID are always created as new

##### Adding Video Embed Codes
After CSV import, you need to add video embed codes:
1. Edit each record that needs video
2. Paste the full Kaltura iframe embed code into the "Embed Code" field
3. Save the record

**Tip**: Use the bulk edit feature to add embed codes to multiple records at once!

#### CSV Export (VIEWER+)

##### Web Interface
1. Navigate to Admin Panel → Dashboard tab
2. Click "Export CSV" button
3. File downloads automatically as `media-archive-export-YYYY-MM-DD.csv`

##### API Export
```bash
# Get authentication cookie first (login)
curl -c cookies.txt -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=viewer@test.com&password=password123"

# Export CSV
curl -b cookies.txt http://localhost:3000/api/hono/csv/export -o export.csv
```

##### Export Format
- Includes all records in the database
- Same format as import template
- Suitable for backup or migration to other systems

### 👑 Admin Panel (ADMIN only)

#### Dashboard Tab
- **System Statistics**: Record count, user count, last sync time
- **Search Index Management**: "Re-sync Search Index" button
- **CSV Operations**: Import and export buttons
- **Quick Actions**: Links to common admin tasks

#### Users Tab
- **User List**: Table of all registered users
- **Role Management**: Dropdown to change user roles (immediate effect)
- **Create User**: Dialog with name, email, password, role
- **Delete User**: With confirmation (prevents deleting last ADMIN)
- **Last Login**: Shows user activity timestamps

#### System Monitoring
- **Service Health**: Visual indicators for all services
- **Performance Metrics**: Response times, queue status
- **Audit Trail**: Track who modified which records

---

## 🏗️ Architecture

### Tech Stack 2026

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15 App Router | Server-side rendering, routing |
| **UI Framework** | Tailwind CSS + Shadcn/UI | Consistent, accessible components |
| **Search UI** | React InstantSearch | Faceted search interface |
| **Backend API** | Hono 4 | Lightweight, fast API framework |
| **Database** | PostgreSQL 17 + pgvector | Primary data store with vector support |
| **ORM** | Prisma 7 | Type-safe database access |
| **Search Engine** | Typesense 30.1 | Blazing-fast faceted search |
| **Cache/Queue** | Redis 8.0 + BullMQ | Session cache & background jobs |
| **Authentication** | Auth.js v5 | JWT-based auth with role management |
| **Containerization** | Docker Compose | Consistent development/production environment |
| **Reverse Proxy** | Caddy 2 | Automatic HTTPS, load balancing |

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Browser                           │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS (Port 80/443)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Caddy Reverse Proxy                       │
│                    (Automatic HTTPS)                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   App Router    │  │   API Routes    │  │   Hono API  │  │
│  │  (Pages/SSR)    │  │  (/api/*)       │  │  (/api/hono)│  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────┬──────────────────────┬────────────────────────┘
              │                      │
              ▼                      ▼
    ┌─────────────────┐    ┌─────────────────┐
    │   PostgreSQL    │    │    Typesense    │
    │  (Primary DB)   │    │  (Search Index) │
    │  Port: 5432     │    │  Port: 8108     │
    └─────────────────┘    └─────────────────┘
              │                      │
              └──────────┬───────────┘
                         │
                         ▼
                 ┌─────────────────┐
                 │      Redis      │
                 │ (Cache/Queue)   │
                 │   Port: 6379    │
                 └─────────────────┘
```

### Data Flow

1. **User Request** → Browser sends HTTP request
2. **Caddy Proxy** → Routes to Next.js app (port 3000)
3. **Authentication** → Auth.js middleware validates JWT
4. **Role Check** → `verifyRole()` middleware enforces permissions
5. **Business Logic** → Service layer processes request
6. **Data Persistence** → Double-write to PostgreSQL + Typesense
7. **Response** → JSON (API) or HTML (pages) returned to user

### 🔄 Double-Write Search Pattern

The system implements a **double-write pattern** to maintain consistency between the primary database (PostgreSQL) and search index (Typesense):

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│ PostgreSQL  │───▶│ Typesense   │
│   Request   │    │ (Source of  │    │ (Search     │
└─────────────┘    │   Truth)    │    │   Index)    │
                   └─────────────┘    └─────────────┘
                        │                    │
                        └─────┬──────────────┘
                              ▼
                     ┌─────────────┐
                     │   Success   │
                     │  Response   │
                     └─────────────┘
```

**Key Principles:**
1. **PostgreSQL First**: All writes go to PostgreSQL first
2. **Typesense Sync**: Non-blocking sync to search index
3. **Graceful Degradation**: Search failures don't block data operations
4. **Manual Recovery**: `POST /api/hono/sync` reconciles discrepancies

**Audit Trail**: Every record modification tracks:
- `lastModified`: Timestamp of change
- `lastModifiedById`: User who made the change
- Automatic timestamp updates via Prisma `@updatedAt`

### ⚡ Performance & Scalability

#### Search Performance
- **Typesense**: Sub-millisecond search response times
- **Faceted Search**: Instant filtering without page reloads
- **Pagination**: Efficient cursor-based pagination
- **Caching**: Redis cache for frequently accessed data

#### Rate Limiting
Protects against abuse with Redis-based sliding window limits:

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| POST `/records/bulk` | 10 | 60 seconds | Prevent mass updates |
| POST `/records` | 60 | 60 seconds | Prevent record spam |
| DELETE `/records/:id` | 30 | 60 seconds | Prevent mass deletions |
| POST `/csv/import` | 5 | 60 seconds | Prevent import abuse |

**429 Response**: Returns `Retry-After` header when limit exceeded

#### Background Processing
- **BullMQ**: Redis-based job queue for large CSV imports
- **Worker Process**: Dedicated worker handles >5,000 row imports
- **Progress Tracking**: Real-time progress via Redis
- **Job Persistence**: Survives container restarts

---

## 🛠️ Development

### Project Structure

```
MediaArchive/
├── 📁 docker/                    # Docker configuration
│   ├── postgres/init.sql       # pgvector extension setup
│   └── caddy/Caddyfile        # Reverse proxy configuration
├── 📁 apps/web/                 # Next.js application
│   ├── 📁 prisma/              # Database schema & migrations
│   │   ├── schema.prisma      # Prisma schema definition
│   │   └── seed.ts            # Database seeding script
│   ├── 📁 scripts/             # Utility scripts
│   │   └── init-typesense.ts  # Typesense initialization
│   └── 📁 src/                 # Application source code
│       ├── 📁 app/             # Next.js App Router pages
│       │   ├── (public)/      # Public routes (login)
│       │   ├── (protected)/   # Authenticated routes
│       │   └── api/           # API routes
│       ├── 📁 components/      # React components
│       │   ├── ui/            # Shadcn/UI components
│       │   ├── layout/        # Layout components
│       │   ├── search/        # Search interface components
│       │   ├── media/         # Media player components
│       │   └── admin/         # Admin panel components
│       ├── 📁 hooks/           # Custom React hooks
│       ├── 📁 lib/             # Utilities and shared code
│       └── 📁 server/          # Server-side code
│           ├── api/           # Hono API routes & middleware
│           ├── services/      # Business logic services
│           └── workers/       # BullMQ background workers
├── 📄 docker-compose.yml       # 5-service Docker orchestration
├── 📄 .env.example            # Environment template
├── 📄 .env                    # Local secrets (gitignored)
├── 📄 README.md              # This user manual
├── 📄 HANDOFF.md             # Technical handoff document
├── 📄 plan.md                # Original implementation plan
└── 📄 testRecords.csv        # Sample test data
```

### Development Commands

#### Database Operations
```bash
# Create new migration
docker compose exec -u root app npx prisma migrate dev --name <migration-name>

# Apply pending migrations
docker compose exec -u root app npx prisma migrate deploy

# Generate Prisma Client
docker compose exec -u root app npx prisma generate

# Open Prisma Studio (database GUI)
docker compose exec -u root app npx prisma studio

# Seed database with test users
docker compose exec app npx tsx prisma/seed.ts
```

#### Search Engine Operations
```bash
# Initialize Typesense collection (first time only)
docker compose exec -u root app \
  sh -c "TYPESENSE_HOST=typesense TYPESENSE_PORT=8108 TYPESENSE_API_KEY=dev_typesense_admin_key \
  npx tsx scripts/init-typesense.ts"

# Check Typesense health
curl http://localhost:8108/health

# List Typesense collections
curl -H "X-Typesense-Api-Key: dev_typesense_admin_key" \
  http://localhost:8108/collections

# Delete and recreate collection (force re-sync)
curl -X DELETE "http://localhost:8108/collections/media_records?force=true" \
  -H "X-Typesense-Api-Key: dev_typesense_admin_key"
```

#### Application Development
```bash
# Run TypeScript type check
docker compose exec app npx tsc --noEmit

# View application logs
docker compose logs -f app

# Rebuild application
docker compose up -d --build app

# Full stack rebuild
docker compose down -v && docker compose up -d --build
```

### 🐛 Troubleshooting Guide

#### Common Issues & Solutions

**1. Containers Won't Start**
```bash
# Check all container logs
docker compose logs

# Check specific service logs
docker compose logs app
docker compose logs postgres
docker compose logs typesense

# Check container status
docker compose ps

# Restart all services
docker compose restart
```

**2. Database Connection Errors**
```bash
# Test PostgreSQL connection
docker compose exec postgres psql -U mediaarchive -d mediaarchive_db -c "\l"

# Check if tables exist
docker compose exec postgres psql -U mediaarchive -d mediaarchive_db -c "\dt"

# Reset database (destructive!)
docker compose down -v && docker compose up -d
```

**3. Search Not Working**
```bash
# Test Typesense connection
curl http://localhost:8108/health

# Check collection exists
curl -H "X-Typesense-Api-Key: dev_typesense_admin_key" \
  http://localhost:8108/collections

# Force re-sync (as ADMIN user)
# Login as admin@test.com, go to Admin Panel → Dashboard → "Re-sync Search Index"
```

**4. Authentication Issues**
```bash
# Check Redis is running
docker compose exec redis redis-cli ping

# Verify AUTH_SECRET is set
grep AUTH_SECRET .env

# Clear all sessions (development only)
docker compose exec redis redis-cli FLUSHALL
```

**5. CSV Import Problems**
```bash
# Check BullMQ worker logs
docker compose logs app | grep -i "worker\|bullmq\|import"

# Check Redis queue status
docker compose exec redis redis-cli KEYS "*bull*"

# Test small import
curl -b cookies.txt -X POST "http://localhost:3000/api/hono/csv/import" \
  -F "file=@testRecords.csv"
```

**6. Performance Issues**
```bash
# Check memory usage
docker stats

# Check CPU usage
docker compose top

# Clear Redis cache
docker compose exec redis redis-cli FLUSHDB
```

### Development Tips

1. **Hot Reload**: The Next.js app supports hot reload in development
2. **Type Safety**: Always run `npx tsc --noEmit` after changes
3. **Database Changes**: Always create migrations, never edit database directly
4. **Environment Variables**: Use `.env` for local development, never commit secrets
5. **Testing**: Use the test users for different role testing scenarios

---

## 📡 API Reference

### Authentication
All API endpoints require authentication via JWT token in cookies.

### Records API

#### List/Search Records
```http
GET /api/hono/records
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `q`: Search query (optional)
- `page`: Page number (optional, default: 1)
- `limit`: Items per page (optional, default: 20)
- `series`: Filter by series (optional)
- `reporter`: Filter by reporter (optional)
- `filmReel`: Filter by film reel (optional)

**Response:**
```json
{
  "records": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

#### Get Single Record
```http
GET /api/hono/records/:id
Authorization: Bearer <jwt-token>
```

#### Create Record (EDITOR+)
```http
POST /api/hono/records
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "title": "Record Title",
  "series": "News",
  "date": "2024-01-15",
  "kalturaId": "1_abc123",
  "startTime": 120,
  "stopTime": 300,
  "embedCode": "<iframe...></iframe>"
}
```

#### Update Record (EDITOR+)
```http
PUT /api/hono/records/:id
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "title": "Updated Title",
  "series": "Documentary"
}
```

#### Delete Record (ADMIN only)
```http
DELETE /api/hono/records/:id
Authorization: Bearer <jwt-token>
```

#### Bulk Update (EDITOR+)
```http
POST /api/hono/records/bulk
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "recordIds": ["id1", "id2", "id3"],
  "updates": {
    "series": "Updated Series",
    "reporter": "New Reporter"
  }
}
```

### CSV API

#### Import CSV (ADMIN only)
```http
POST /api/hono/csv/import
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data

file: @data.csv
```

**Responses:**
- `200 OK`: Small file processed synchronously
- `202 Accepted`: Large file queued (returns `jobId`)
- `429 Too Many Requests`: Rate limit exceeded

#### Check Import Status
```http
GET /api/hono/csv/import/:jobId/status
Authorization: Bearer <jwt-token>
```

#### Export CSV (VIEWER+)
```http
GET /api/hono/csv/export
Authorization: Bearer <jwt-token>
```

### Users API (ADMIN only)

#### List Users
```http
GET /api/hono/users
Authorization: Bearer <jwt-token>
```

#### Create User
```http
POST /api/hono/users
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "role": "EDITOR"
}
```

#### Update User Role
```http
PUT /api/hono/users/:id/role
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "role": "ADMIN"
}
```

#### Delete User
```http
DELETE /api/hono/users/:id
Authorization: Bearer <jwt-token>
```

### System API

#### Health Check
```http
GET /api/health
```

**Response:**
```json
{"ok": true, "service": "mediaarchive-app"}
```

#### Re-sync Search Index (ADMIN only)
```http
POST /api/hono/sync
Authorization: Bearer <jwt-token>
```

#### Get System Stats (ADMIN only)
```http
GET /api/hono/users/stats
Authorization: Bearer <jwt-token>
```

---

## 🚀 Deployment

### Production Checklist

#### Security
- [ ] Change all default passwords in `.env`
- [ ] Use strong, random AUTH_SECRET (32+ characters)
- [ ] Enable HTTPS with valid certificates
- [ ] Set up firewall rules
- [ ] Regular security updates

#### Infrastructure
- [ ] Use production-grade PostgreSQL instance
- [ ] Configure automated backups
- [ ] Set up monitoring and alerts
- [ ] Configure log aggregation
- [ ] Plan for scaling (load balancer, CDN)

#### Application
- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Configure Caddy with production certificates
- [ ] Set appropriate CORS headers
- [ ] Configure rate limiting thresholds
- [ ] Test backup/restore procedures

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | Yes | - | Database username |
| `POSTGRES_PASSWORD` | Yes | - | Database password |
| `POSTGRES_DB` | Yes | `mediaarchive_db` | Database name |
| `DATABASE_URL` | Yes | - | Full PostgreSQL connection URL |
| `AUTH_SECRET` | Yes | - | JWT signing secret (32+ chars) |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` | Application URL |
| `NEXTAUTH_SECRET` | Yes | - | Auth.js secret (same as AUTH_SECRET) |
| `TYPESENSE_HOST` | Yes | `typesense` | Typesense hostname |
| `TYPESENSE_PORT` | Yes | `8108` | Typesense port |
| `TYPESENSE_API_KEY` | Yes | - | Typesense admin API key |
| `NEXT_PUBLIC_TYPESENSE_HOST` | Yes | `localhost` | Client-side Typesense host |
| `NEXT_PUBLIC_TYPESENSE_PORT` | Yes | `8108` | Client-side Typesense port |
| `NEXT_PUBLIC_TYPESENSE_SEARCH_ONLY_KEY` | Yes | - | Typesense search-only key |
| `REDIS_URL` | Yes | `redis://redis:6379` | Redis connection URL |
| `REDIS_PASSWORD` | No | - | Redis password (if enabled) |
| `NODE_ENV` | No | `development` | `development` or `production` |

### Deployment Options

#### Option 1: Docker Compose (Simple)
```bash
# Production docker-compose.prod.yml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
  
  # ... other services with production config
```

#### Option 2: Kubernetes
```yaml
# Sample Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mediaarchive-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mediaarchive
  template:
    metadata:
      labels:
        app: mediaarchive
    spec:
      containers:
      - name: app
        image: your-registry/mediaarchive:latest
        envFrom:
        - secretRef:
            name: mediaarchive-secrets
```

#### Option 3: Cloud Services
- **Database**: AWS RDS, Google Cloud SQL, Azure Database
- **Cache**: AWS ElastiCache, Google Memorystore, Azure Cache
- **Search**: Managed Typesense, Algolia, Elasticsearch
- **Compute**: AWS ECS, Google Cloud Run, Azure Container Instances

### Monitoring & Maintenance

#### Health Checks
```bash
# Application health
curl https://your-domain.com/api/health

# Database health
docker compose exec postgres pg_isready

# Redis health
docker compose exec redis redis-cli ping

# Typesense health
curl https://your-domain.com:8108/health
```

#### Backup Procedures
```bash
# Database backup
docker compose exec postgres pg_dump -U mediaarchive mediaarchive_db > backup.sql

# Redis backup
docker compose exec redis redis-cli SAVE

# Typesense backup
curl -X POST "http://localhost:8108/operations/snapshot" \
  -H "X-Typesense-Api-Key: ${TYPESENSE_API_KEY}"
```

#### Performance Monitoring
- **PostgreSQL**: `pg_stat_statements`, `EXPLAIN ANALYZE`
- **Redis**: `INFO` command, memory usage monitoring
- **Typesense**: Query latency, cache hit rates
- **Application**: Response times, error rates, queue lengths

---

## ❓ FAQ

### General Questions

**Q: What browsers are supported?**
A: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+) with JavaScript enabled.

**Q: Is there a mobile app?**
A: No, but the web interface is fully responsive and works on mobile devices.

**Q: Can I use SSO (Single Sign-On)?**
A: Currently only email/password authentication is supported. SSO can be added via Auth.js providers.

### Data Management

**Q: How do I backup my data?**
A: Use the CSV export feature for records, and database backup tools for users and system data.

**Q: What's the maximum file size for CSV import?**
A: There's no hard limit, but files >5,000 rows are processed in the background.

**Q: Can I import video files directly?**
A: No, the system only stores metadata and embed codes. Videos must be hosted on Kaltura or similar platforms.

### Technical Questions

**Q: Why are there two databases (PostgreSQL and Typesense)?**
A: PostgreSQL is for transactional data with ACID compliance, Typesense is for blazing-fast search with faceting.

**Q: How often should I re-sync the search index?**
A: Normally automatic sync is sufficient. Manual re-sync is only needed if search results become inconsistent.

**Q: Can I customize the search fields?**
A: Yes, modify the Typesense schema in `scripts/init-typesense.ts` and update the frontend components.

**Q: How do I add new user roles?**
A: Update the `Role` enum in `prisma/schema.prisma`, then update all role-checking logic.

### Troubleshooting

**Q: Search returns no results but I know records exist**
A: Try re-syncing the search index from the Admin Panel.

**Q: I can't login even with correct credentials**
A: Check Redis is running and AUTH_SECRET is properly set.

**Q: CSV import fails with "validation error"**
A: Check that Start Time and Stop Time are integers (seconds), not HH:MM:SS format.

**Q: Video doesn't play in the media player**
A: Ensure the embed code is a complete iframe, not just a Kaltura ID.

### Scaling & Performance

**Q: How many records can the system handle?**
A: Tested with 50,000+ records. Performance depends on hardware, but Typesense can handle millions.

**Q: Can I run this on a single server?**
A: Yes, the Docker Compose setup is designed for single-server deployment.

**Q: How do I improve search performance?**
A: Add more RAM for Redis and Typesense, use SSDs for PostgreSQL.

---

## 📄 License

**MediaArchive** © 2026 — Private Software, All Rights Reserved.

This software is proprietary and confidential. Unauthorized copying, transfer, or reproduction is strictly prohibited.

### Usage Restrictions
- For internal organizational use only
- No redistribution without explicit permission
- No commercial use of the software itself
- Source code modifications must be documented

### Support
For support, bug reports, or feature requests, contact the development team.

---

## 📞 Support & Contact

**Repository**: https://github.com/greatfog7242/MediaArchive  
**Documentation**: This README and `HANDOFF.md`  
**Issue Tracking**: GitHub Issues  

### Getting Help
1. Check the [Troubleshooting](#-troubleshooting-guide) section
2. Review the `HANDOFF.md` for technical details
3. Search existing GitHub issues
4. Contact the development team

### Contributing
While this is a private repository, internal contributions are welcome. Please:
1. Create a feature branch
2. Add tests for new functionality
3. Update documentation
4. Submit a pull request for review

---

*Last Updated: March 2026*  
*Version: 1.0.0*
