-- PostgreSQL initialization script
-- Prisma manages the schema via migrations (prisma migrate deploy).
-- This file is a placeholder executed once on first container startup.

-- Enable pgvector extension (pre-installed in pgvector/pgvector:pg17 image)
CREATE EXTENSION IF NOT EXISTS vector;
