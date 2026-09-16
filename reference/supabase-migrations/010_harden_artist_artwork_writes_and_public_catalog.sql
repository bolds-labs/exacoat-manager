BEGIN;

-- Keep catalog fields first-class so public consumers do not need metadata.
ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS is_nsfw boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_custom_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fandom text;

ALTER TABLE public.artworks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Artists read own artworks" ON public.artworks;
CREATE POLICY "Artists read own artworks"
  ON public.artworks FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND artist_id = auth.uid());

-- Replace every existing artwork write policy. service_role bypasses RLS, while
-- managers receive explicit policies below.
DO $policy_cleanup$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'artworks'
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.artworks', policy_record.policyname);
  END LOOP;
END
$policy_cleanup$;

DROP POLICY IF EXISTS "Managers insert artworks" ON public.artworks;
CREATE POLICY "Managers insert artworks"
  ON public.artworks FOR INSERT TO authenticated
  WITH CHECK (public.is_artmatter_manager());

DROP POLICY IF EXISTS "Managers update artworks" ON public.artworks;
CREATE POLICY "Managers update artworks"
  ON public.artworks FOR UPDATE TO authenticated
  USING (public.is_artmatter_manager())
  WITH CHECK (public.is_artmatter_manager());

DROP POLICY IF EXISTS "Managers delete artworks" ON public.artworks;
CREATE POLICY "Managers delete artworks"
  ON public.artworks FOR DELETE TO authenticated
  USING (public.is_artmatter_manager());

DROP POLICY IF EXISTS "Artists submit own artworks" ON public.artworks;
CREATE POLICY "Artists submit own artworks"
  ON public.artworks FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND artist_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Artists update own artworks" ON public.artworks;
CREATE POLICY "Artists update own artworks"
  ON public.artworks FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND artist_id = auth.uid()
    AND status IN ('pending', 'draft')
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND artist_id = auth.uid()
    AND status IN ('pending', 'draft')
  );

DROP POLICY IF EXISTS "Artists delete own unreviewed artworks" ON public.artworks;
CREATE POLICY "Artists delete own unreviewed artworks"
  ON public.artworks FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND artist_id = auth.uid() AND status IN ('pending', 'draft'));

CREATE OR REPLACE FUNCTION public.enforce_artist_artwork_write_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  caller_role text := coalesce(auth.role(), '');
  old_row jsonb;
  new_row jsonb;
  old_metadata jsonb;
  new_metadata jsonb;
  editable_columns constant text[] := ARRAY[
    'title', 'slug', 'description', 'short_description', 'orientation',
    'image_url', 'thumbnail_url', 'is_exclusive', 'is_nsfw',
    'subject', 'style', 'mood', 'color', 'fandom', 'collection', 'tags',
    'updated_at', 'metadata'
  ];
  editable_metadata constant text[] := ARRAY[
    'description', 'short_description', 'story', 'public_story',
    'r2_staging_key', 'original_width', 'original_height',
    'resolution_verified', 'submitted_at', 'feelform', 'feelform_mode',
    'artwork_feelform'
  ];
BEGIN
  -- SQL-editor/migration sessions have no JWT. service_role and manager requests
  -- retain unrestricted integration and back-office access.
  IF caller_role = '' OR caller_role = 'service_role' OR public.is_artmatter_manager() THEN
    RETURN NEW;
  END IF;

  IF caller_role <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Artwork write denied' USING ERRCODE = '42501';
  END IF;

  new_row := to_jsonb(NEW);
  new_metadata := coalesce(new_row -> 'metadata', '{}'::jsonb);

  IF TG_OP = 'INSERT' THEN
    IF NEW.artist_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Artwork ownership must match the authenticated artist' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'Artist submissions must start as pending' USING ERRCODE = '42501';
    END IF;
    IF nullif(new_row ->> 'wp_id', '') IS NOT NULL
      OR nullif(new_row ->> 'source', '') IS NOT NULL
      OR nullif(new_row ->> 'sku', '') IS NOT NULL
      OR nullif(new_row ->> 'product_url', '') IS NOT NULL
      OR nullif(new_row ->> 'master_file_url', '') IS NOT NULL
      OR coalesce((new_row ->> 'total_sales')::numeric, 0) <> 0
      OR coalesce((new_row ->> 'is_featured')::boolean, false)
      OR coalesce((new_row ->> 'is_pinned')::boolean, false)
      OR coalesce((new_row ->> 'has_3d')::boolean, false)
      OR coalesce((new_row ->> 'has_feelform')::boolean, false)
      OR coalesce((new_row ->> 'is_custom_order')::boolean, false)
      OR nullif(new_row ->> 'custom_order_code', '') IS NOT NULL
      OR nullif(new_row ->> 'custom_email', '') IS NOT NULL
      OR nullif(new_row ->> 'custom_notes', '') IS NOT NULL
      OR nullif(new_row ->> 'expires_at', '') IS NOT NULL
      OR nullif(new_row ->> 'rejection_reason', '') IS NOT NULL
      OR nullif(new_row ->> 'scheduled_removal_at', '') IS NOT NULL
    THEN
      RAISE EXCEPTION 'Artist submissions cannot set catalog, sales, or moderation fields' USING ERRCODE = '42501';
    END IF;
    IF (new_metadata - editable_metadata) <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Artist submission metadata contains protected keys' USING ERRCODE = '42501';
    END IF;
  ELSE
    old_row := to_jsonb(OLD);
    old_metadata := coalesce(old_row -> 'metadata', '{}'::jsonb);

    IF OLD.artist_id IS DISTINCT FROM auth.uid() OR NEW.artist_id IS DISTINCT FROM OLD.artist_id THEN
      RAISE EXCEPTION 'Artwork ownership cannot be changed' USING ERRCODE = '42501';
    END IF;
    IF OLD.status NOT IN ('pending', 'draft') OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Artists may only edit pending or draft artworks without changing status' USING ERRCODE = '42501';
    END IF;

    -- An artist may edit descriptive/submission fields, but every other current
    -- or future top-level field remains immutable unless added here deliberately.
    IF (new_row - editable_columns) IS DISTINCT FROM (old_row - editable_columns) THEN
      RAISE EXCEPTION 'Protected artwork fields cannot be changed' USING ERRCODE = '42501';
    END IF;
    IF (new_metadata - editable_metadata) IS DISTINCT FROM (old_metadata - editable_metadata) THEN
      RAISE EXCEPTION 'Protected artwork metadata cannot be changed' USING ERRCODE = '42501';
    END IF;

    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.enforce_artist_artwork_write_restrictions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_artist_artwork_write_restrictions ON public.artworks;
CREATE TRIGGER enforce_artist_artwork_write_restrictions
BEFORE INSERT OR UPDATE ON public.artworks
FOR EACH ROW EXECUTE FUNCTION public.enforce_artist_artwork_write_restrictions();

REVOKE INSERT, UPDATE, DELETE ON TABLE public.artworks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.artworks TO authenticated;
GRANT ALL ON TABLE public.artworks TO service_role;

-- WordPress sends complete top-level sync fields and only the metadata keys it
-- owns. Merge and update in one statement so concurrent metadata writers cannot
-- be lost between a REST read and PATCH.
CREATE OR REPLACE FUNCTION public.wordpress_atomic_merge_sync_record(
  p_table text,
  p_match_column text,
  p_match_value text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  target_table regclass;
  target_type text;
  match_cast text;
  set_clause text;
  invalid_columns text;
  updated_record jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role is required' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR p_payload = '{}'::jsonb THEN
    RAISE EXCEPTION 'p_payload must be a non-empty JSON object' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'metadata' AND jsonb_typeof(p_payload -> 'metadata') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'metadata must be a JSON object' USING ERRCODE = '22023';
  END IF;

  CASE p_table
    WHEN 'artists' THEN
      target_table := 'public.artists'::regclass;
      target_type := 'public.artists';
      CASE p_match_column
        WHEN 'id' THEN match_cast := 'uuid';
        WHEN 'wp_user_id' THEN match_cast := 'bigint';
        ELSE RAISE EXCEPTION 'Unsupported artists match column: %', p_match_column USING ERRCODE = '22023';
      END CASE;
    WHEN 'artworks' THEN
      target_table := 'public.artworks'::regclass;
      target_type := 'public.artworks';
      CASE p_match_column
        WHEN 'id' THEN match_cast := 'uuid';
        WHEN 'wp_id' THEN match_cast := 'bigint';
        ELSE RAISE EXCEPTION 'Unsupported artworks match column: %', p_match_column USING ERRCODE = '22023';
      END CASE;
    ELSE
      RAISE EXCEPTION 'Unsupported sync table: %', p_table USING ERRCODE = '22023';
  END CASE;

  SELECT string_agg(key, ', ' ORDER BY key)
  INTO invalid_columns
  FROM jsonb_object_keys(p_payload) payload_key(key)
  WHERE key IN ('id', 'created_at')
     OR NOT EXISTS (
       SELECT 1
       FROM pg_attribute
       WHERE attrelid = target_table
         AND attname = key
         AND attnum > 0
         AND NOT attisdropped
         AND attgenerated = ''
         AND attidentity = ''
     );

  IF invalid_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Unsupported or immutable % columns: %', p_table, invalid_columns USING ERRCODE = '22023';
  END IF;

  SELECT string_agg(
    CASE
      WHEN key = 'metadata' THEN
        format('%1$I = coalesce(target.%1$I, ''{}''::jsonb) || coalesce(patch.%1$I, ''{}''::jsonb)', key)
      ELSE format('%1$I = patch.%1$I', key)
    END,
    ', ' ORDER BY key
  )
  INTO set_clause
  FROM jsonb_object_keys(p_payload) payload_key(key);

  EXECUTE format(
    'UPDATE %1$s AS target SET %2$s FROM jsonb_populate_record(NULL::%1$s, $1) AS patch WHERE target.%3$I = $2::%4$s RETURNING to_jsonb(target)',
    target_type,
    set_clause,
    p_match_column,
    match_cast
  )
  INTO updated_record
  USING p_payload, p_match_value;

  RETURN updated_record;
END
$function$;

REVOKE ALL ON FUNCTION public.wordpress_atomic_merge_sync_record(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wordpress_atomic_merge_sync_record(text, text, text, jsonb) TO service_role;

-- A fixed, metadata-free public catalog contract. security_invoker keeps RLS in
-- force; anon receives only the columns used by this view.
CREATE OR REPLACE VIEW public.public_catalog_artworks
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  id,
  wp_id,
  artist_id,
  title,
  slug,
  status,
  short_description,
  description,
  image_url,
  product_url,
  orientation,
  fandom,
  collection,
  tags,
  subject,
  style,
  mood,
  color,
  is_exclusive,
  is_nsfw,
  is_custom_order,
  is_featured,
  total_sales,
  created_at,
  updated_at
FROM public.artworks
WHERE status IN ('publish', 'published', 'live')
  AND NOT coalesce(is_nsfw, false)
  AND NOT coalesce(is_custom_order, false);

REVOKE ALL ON TABLE public.artworks FROM anon;
GRANT SELECT (
  id, wp_id, artist_id, title, slug, status, short_description, description,
  image_url, product_url, orientation, fandom, collection, tags, subject,
  style, mood, color, is_exclusive, is_nsfw, is_custom_order, is_featured, total_sales,
  created_at, updated_at
) ON TABLE public.artworks TO anon;
REVOKE ALL ON TABLE public.public_catalog_artworks FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.public_catalog_artworks FROM anon, authenticated;
GRANT SELECT ON TABLE public.public_catalog_artworks TO anon, authenticated;

-- PostgREST on_conflict requires these exact unique keys. Abort the transaction
-- with an actionable error rather than deploying a sync path that will fail.
DO $uniqueness$
DECLARE
  duplicate_count bigint;
  wp_id_attnum smallint;
  wp_user_id_attnum smallint;
BEGIN
  SELECT count(*) INTO duplicate_count
  FROM (
    SELECT wp_id FROM public.artworks
    WHERE wp_id IS NOT NULL GROUP BY wp_id HAVING count(*) > 1
  ) duplicates;

  SELECT attnum INTO wp_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.artworks'::regclass AND attname = 'wp_id' AND NOT attisdropped;

  IF duplicate_count = 0 AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.artworks'::regclass
      AND contype = 'u' AND conkey = ARRAY[wp_id_attnum]::smallint[]
  ) THEN
    ALTER TABLE public.artworks ADD CONSTRAINT artworks_wp_id_unique UNIQUE (wp_id);
  ELSIF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot enforce artworks.wp_id uniqueness: % duplicate value group(s). Resolve duplicates before migration 010.', duplicate_count
      USING ERRCODE = '23505';
  END IF;

  SELECT count(*) INTO duplicate_count
  FROM (
    SELECT wp_user_id FROM public.artists
    WHERE wp_user_id IS NOT NULL GROUP BY wp_user_id HAVING count(*) > 1
  ) duplicates;

  SELECT attnum INTO wp_user_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.artists'::regclass AND attname = 'wp_user_id' AND NOT attisdropped;

  IF duplicate_count = 0 AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.artists'::regclass
      AND contype = 'u' AND conkey = ARRAY[wp_user_id_attnum]::smallint[]
  ) THEN
    ALTER TABLE public.artists ADD CONSTRAINT artists_wp_user_id_unique UNIQUE (wp_user_id);
  ELSIF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot enforce artists.wp_user_id uniqueness: % duplicate value group(s). Resolve duplicates before migration 010.', duplicate_count
      USING ERRCODE = '23505';
  END IF;

  SELECT count(*) INTO duplicate_count
  FROM (
    SELECT lower(btrim(username)) FROM public.artists
    WHERE nullif(btrim(username), '') IS NOT NULL
    GROUP BY lower(btrim(username)) HAVING count(*) > 1
  ) duplicates;

  IF duplicate_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS artists_username_normalized_unique
      ON public.artists (lower(btrim(username)))
      WHERE nullif(btrim(username), '') IS NOT NULL;
  ELSE
    RAISE EXCEPTION 'Cannot enforce normalized artists.username uniqueness: % duplicate value group(s). Resolve duplicates before migration 010.', duplicate_count
      USING ERRCODE = '23505';
  END IF;
END
$uniqueness$;

-- Prefer the managed fandom table when present. If it has not been deployed,
-- expose a stable minimal contract derived from published catalog values.
DO $fandom_contract$
DECLARE
  has_fandom_columns boolean;
BEGIN
  SELECT to_regclass('public.fandoms') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY['id', 'name', 'slug', 'banner_url', 'description', 'alias', 'artwork_count', 'is_featured', 'created_at', 'updated_at']) required(column_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'fandoms'
          AND c.column_name = required.column_name
      )
    )
  INTO has_fandom_columns;

  IF has_fandom_columns THEN
    ALTER TABLE public.fandoms ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public read fandoms" ON public.fandoms;
    CREATE POLICY "Public read fandoms"
      ON public.fandoms FOR SELECT TO anon, authenticated
      USING (true);
    REVOKE ALL ON TABLE public.fandoms FROM anon;
    GRANT SELECT (
      id, name, slug, banner_url, description, alias, artwork_count,
      is_featured, created_at, updated_at
    ) ON TABLE public.fandoms TO anon;

    EXECUTE $view$
      CREATE OR REPLACE VIEW public.public_catalog_fandoms
      WITH (security_invoker = true, security_barrier = true)
      AS SELECT
        id::text AS id,
        name::text AS name,
        slug::text AS slug,
        banner_url::text AS banner_url,
        description::text AS description,
        alias::text AS alias,
        artwork_count::bigint AS artwork_count,
        is_featured::boolean AS is_featured,
        created_at::timestamptz AS created_at,
        updated_at::timestamptz AS updated_at
      FROM public.fandoms
    $view$;
  ELSE
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.public_catalog_fandoms
      WITH (security_invoker = true, security_barrier = true)
      AS SELECT
        md5(lower(fandom)) AS id,
        fandom::text AS name,
        regexp_replace(lower(fandom), '[^a-z0-9]+', '-', 'g')::text AS slug,
        NULL::text AS banner_url,
        NULL::text AS description,
        NULL::text AS alias,
        count(*)::bigint AS artwork_count,
        false AS is_featured,
        min(created_at)::timestamptz AS created_at,
        max(updated_at)::timestamptz AS updated_at
      FROM public.public_catalog_artworks
      WHERE nullif(btrim(fandom), '') IS NOT NULL
      GROUP BY fandom
    $view$;
  END IF;
END
$fandom_contract$;

REVOKE ALL ON TABLE public.public_catalog_fandoms FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.public_catalog_fandoms FROM anon, authenticated;
GRANT SELECT ON TABLE public.public_catalog_fandoms TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
