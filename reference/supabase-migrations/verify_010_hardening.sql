-- Run with psql after migration 010. This script is transactionally isolated
-- and requires at least one artwork with an artist_id.
BEGIN;

DO $verify_fixture$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.artworks WHERE artist_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Verification requires one artwork with a non-null artist_id';
  END IF;
END
$verify_fixture$;

CREATE TEMP TABLE migration_010_fixture ON COMMIT DROP AS
SELECT id, artist_id, title, status, metadata
FROM public.artworks
WHERE artist_id IS NOT NULL
LIMIT 1;

GRANT SELECT ON TABLE migration_010_fixture TO anon, authenticated, service_role;

-- Put the fixture in an artist-editable state using integration privileges.
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
UPDATE public.artworks
SET status = 'pending'
WHERE id = (SELECT id FROM migration_010_fixture);

-- The owner can edit a pending artwork but cannot alter its moderation status.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', (SELECT artist_id FROM migration_010_fixture))::text,
  true
);
DO $artist_pending_update$
DECLARE
  affected integer;
BEGIN
  UPDATE public.artworks
  SET title = title || ' [migration-010-artist-test]'
  WHERE id = (SELECT id FROM migration_010_fixture);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Artist could not update an owned pending artwork';
  END IF;
END
$artist_pending_update$;

DO $artist_status_update$
DECLARE
  affected integer;
BEGIN
  BEGIN
    UPDATE public.artworks
    SET status = 'live'
    WHERE id = (SELECT id FROM migration_010_fixture);
    GET DIAGNOSTICS affected = ROW_COUNT;
  EXCEPTION
    WHEN insufficient_privilege THEN
      affected := 0;
  END;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'Artist unexpectedly changed artwork status';
  END IF;
END
$artist_status_update$;

-- Once service_role publishes it, the owner cannot materially update it.
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
UPDATE public.artworks
SET status = 'live'
WHERE id = (SELECT id FROM migration_010_fixture);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', (SELECT artist_id FROM migration_010_fixture))::text,
  true
);
DO $artist_live_update$
DECLARE
  affected integer;
BEGIN
  UPDATE public.artworks
  SET title = title || ' [forbidden]'
  WHERE id = (SELECT id FROM migration_010_fixture);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'Artist unexpectedly updated a live artwork';
  END IF;
END
$artist_live_update$;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
UPDATE public.artworks
SET status = 'rejected'
WHERE id = (SELECT id FROM migration_010_fixture);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', (SELECT artist_id FROM migration_010_fixture))::text,
  true
);
DO $artist_rejected_update$
DECLARE
  affected integer;
BEGIN
  UPDATE public.artworks
  SET title = title || ' [forbidden-rejected]'
  WHERE id = (SELECT id FROM migration_010_fixture);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'Artist unexpectedly updated a rejected artwork';
  END IF;
END
$artist_rejected_update$;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
UPDATE public.artworks
SET status = 'live'
WHERE id = (SELECT id FROM migration_010_fixture);

-- Anon can use the catalog view but cannot select metadata from the base table.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $anon_catalog$
BEGIN
  IF has_column_privilege('anon', 'public.artworks', 'metadata', 'SELECT') THEN
    RAISE EXCEPTION 'Anon unexpectedly has metadata SELECT privilege';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.public_catalog_artworks
    WHERE status NOT IN ('publish', 'published', 'live')
  ) THEN
    RAISE EXCEPTION 'Anon catalog view exposed an unpublished artwork';
  END IF;
  PERFORM count(*) FROM public.public_catalog_artworks;
END
$anon_catalog$;

-- A manager can update a live artwork through the explicit manager policy.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001","email":"admin@artmatter.co"}',
  true
);
DO $manager_update$
DECLARE
  affected integer;
BEGIN
  UPDATE public.artworks
  SET title = title || ' [migration-010-manager-test]'
  WHERE id = (SELECT id FROM migration_010_fixture);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Manager could not update a live artwork';
  END IF;
END
$manager_update$;

-- The service RPC updates top-level fields and merges, rather than replaces,
-- metadata. Its EXECUTE grant must not be available to browser roles.
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
UPDATE public.artworks
SET metadata = coalesce(metadata, '{}'::jsonb) || '{"migration_010_preserved":true}'::jsonb
WHERE id = (SELECT id FROM migration_010_fixture);

SELECT public.wordpress_atomic_merge_sync_record(
  'artworks',
  'id',
  (SELECT id::text FROM migration_010_fixture),
  '{"title":"Migration 010 RPC verification","metadata":{"migration_010_added":true}}'::jsonb
);

DO $service_rpc$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.artworks
    WHERE id = (SELECT id FROM migration_010_fixture)
      AND title = 'Migration 010 RPC verification'
      AND metadata @> '{"migration_010_preserved":true,"migration_010_added":true}'::jsonb
  ) THEN
    RAISE EXCEPTION 'Service RPC did not atomically update and merge metadata';
  END IF;
  IF has_function_privilege('anon', 'public.wordpress_atomic_merge_sync_record(text,text,text,jsonb)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.wordpress_atomic_merge_sync_record(text,text,text,jsonb)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'Browser role unexpectedly has EXECUTE on WordPress sync RPC';
  END IF;
END
$service_rpc$;

ROLLBACK;
