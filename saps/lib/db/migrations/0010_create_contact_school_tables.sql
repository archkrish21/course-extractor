-- ============================================================================
-- Migration 0010: Create contact_messages and school_requests tables
-- ============================================================================
-- These tables were referenced by raw SQL INSERTs in the contact and
-- school-request API routes but never created. The routes silently
-- swallowed the "table does not exist" errors and returned 201 anyway.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS: allow inserts from any role (including anon via PostgREST),
-- but no SELECT/UPDATE/DELETE. Only superuser (Drizzle) can read these.
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_messages_insert ON contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

ALTER TABLE school_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_requests_insert ON school_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
