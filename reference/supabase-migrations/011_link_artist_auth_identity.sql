BEGIN;

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- The existing self-profile guard intentionally rejects arbitrary artist
-- updates. Disable only that trigger inside this migration transaction while
-- the deterministic email identity link is backfilled.
ALTER TABLE public.artists DISABLE TRIGGER enforce_artist_update_restrictions;

UPDATE public.artists AS artist
SET auth_user_id = auth_user.id
FROM auth.users AS auth_user
WHERE artist.auth_user_id IS NULL
  AND artist.email IS NOT NULL
  AND lower(btrim(artist.email)) = lower(btrim(auth_user.email));

ALTER TABLE public.artists ENABLE TRIGGER enforce_artist_update_restrictions;

DROP POLICY IF EXISTS "Artists private read access" ON public.artists;
CREATE POLICY "Artists private read access"
  ON public.artists FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_artmatter_manager());

DROP POLICY IF EXISTS "Artists private update access" ON public.artists;
CREATE POLICY "Artists private update access"
  ON public.artists FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_artmatter_manager())
  WITH CHECK (auth_user_id = auth.uid() OR public.is_artmatter_manager());

DROP POLICY IF EXISTS "Artists private insert access" ON public.artists;
CREATE POLICY "Artists private insert access"
  ON public.artists FOR INSERT TO authenticated
  WITH CHECK (
    (auth_user_id = auth.uid() AND NOT EXISTS (
      SELECT 1 FROM public.artists existing
      WHERE existing.auth_user_id = auth.uid()
    ))
    OR public.is_artmatter_manager()
  );

DO $constraints$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.artists
    WHERE auth_user_id IS NOT NULL
    GROUP BY auth_user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate artists.auth_user_id values must be resolved before applying migration 011'
      USING ERRCODE = '23505';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.artists'::regclass
      AND conname = 'artists_auth_user_id_unique'
  ) THEN
    ALTER TABLE public.artists
      ADD CONSTRAINT artists_auth_user_id_unique UNIQUE (auth_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.artists'::regclass
      AND conname = 'artists_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.artists
      ADD CONSTRAINT artists_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$constraints$;

DROP POLICY IF EXISTS "Artists read own artworks" ON public.artworks;
CREATE POLICY "Artists read own artworks"
  ON public.artworks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.artists
      WHERE artists.id = artworks.artist_id
        AND artists.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Artists submit own artworks" ON public.artworks;
CREATE POLICY "Artists submit own artworks"
  ON public.artworks FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.artists
      WHERE artists.id = artworks.artist_id
        AND artists.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Artists update own artworks" ON public.artworks;
CREATE POLICY "Artists update own artworks"
  ON public.artworks FOR UPDATE TO authenticated
  USING (
    status IN ('pending', 'draft')
    AND EXISTS (
      SELECT 1
      FROM public.artists
      WHERE artists.id = artworks.artist_id
        AND artists.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('pending', 'draft')
    AND EXISTS (
      SELECT 1
      FROM public.artists
      WHERE artists.id = artworks.artist_id
        AND artists.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Artists delete own unreviewed artworks" ON public.artworks;
CREATE POLICY "Artists delete own unreviewed artworks"
  ON public.artworks FOR DELETE TO authenticated
  USING (
    status IN ('pending', 'draft')
    AND EXISTS (
      SELECT 1
      FROM public.artists
      WHERE artists.id = artworks.artist_id
        AND artists.auth_user_id = auth.uid()
    )
  );

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
  canonical_artist_id uuid;
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
  IF caller_role = '' OR caller_role = 'service_role' OR public.is_artmatter_manager() THEN
    RETURN NEW;
  END IF;

  IF caller_role <> 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Artwork write denied' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO canonical_artist_id
  FROM public.artists
  WHERE auth_user_id = auth.uid();

  IF canonical_artist_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user is not linked to an artist' USING ERRCODE = '42501';
  END IF;

  new_row := to_jsonb(NEW);
  new_metadata := coalesce(new_row -> 'metadata', '{}'::jsonb);

  IF TG_OP = 'INSERT' THEN
    IF NEW.artist_id IS DISTINCT FROM canonical_artist_id THEN
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
    IF OLD.status NOT IN ('pending', 'draft') OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only pending or draft artworks can be edited without review' USING ERRCODE = '42501';
    END IF;
    IF OLD.artist_id IS DISTINCT FROM canonical_artist_id OR NEW.artist_id IS DISTINCT FROM OLD.artist_id THEN
      RAISE EXCEPTION 'Artwork ownership cannot be changed' USING ERRCODE = '42501';
    END IF;
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

CREATE OR REPLACE FUNCTION public.enforce_artist_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.is_artmatter_manager() THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR OLD.auth_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Artist update denied';
  END IF;
  IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
    OR NEW.identity_status IS DISTINCT FROM OLD.identity_status
    OR NEW.government_id_url IS DISTINCT FROM OLD.government_id_url
    OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
    OR NEW.badge IS DISTINCT FROM OLD.badge
    OR NEW.previous_badge IS DISTINCT FROM OLD.previous_badge
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.unpaid_balance_usd IS DISTINCT FROM OLD.unpaid_balance_usd
    OR NEW.total_earned_usd IS DISTINCT FROM OLD.total_earned_usd
    OR NEW.total_sales_count IS DISTINCT FROM OLD.total_sales_count
    OR NEW.total_artwork_published IS DISTINCT FROM OLD.total_artwork_published
    OR NEW.total_artwork_pending IS DISTINCT FROM OLD.total_artwork_pending
    OR NEW.withholding_tax IS DISTINCT FROM OLD.withholding_tax
    OR (
      coalesce(current_setting('artmatter.allow_payout_update', true), '') <> 'on'
      AND (
        NEW.payout_method IS DISTINCT FROM OLD.payout_method
        OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
        OR NEW.bank_account IS DISTINCT FROM OLD.bank_account
        OR NEW.paypal_email IS DISTINCT FROM OLD.paypal_email
      )
    )
  THEN
    RAISE EXCEPTION 'Protected artist fields cannot be changed';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.update_artist_self_profile(p_updates jsonb)
RETURNS public.artists
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result public.artists;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.artists SET
    username = coalesce(p_updates->>'username', username),
    display_name = coalesce(p_updates->>'display_name', display_name),
    name = coalesce(p_updates->>'name', name),
    email = coalesce(p_updates->>'email', email),
    bio = coalesce(p_updates->>'bio', bio),
    about_me = coalesce(p_updates->>'about_me', about_me),
    country = coalesce(p_updates->>'country', country),
    profile_picture_url = coalesce(p_updates->>'profile_picture_url', profile_picture_url),
    banner_image_url = coalesce(p_updates->>'banner_image_url', banner_image_url),
    banner_url = coalesce(p_updates->>'banner_url', banner_url),
    metadata = CASE WHEN p_updates ? 'metadata' THEN coalesce(metadata, '{}'::jsonb) || coalesce(p_updates->'metadata', '{}'::jsonb) ELSE metadata END,
    updated_at = now()
  WHERE auth_user_id = auth.uid()
  RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Artist profile not found'; END IF;
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION public.update_artist_payout_details(
  p_payout_method text,
  p_bank_name text DEFAULT NULL,
  p_bank_account text DEFAULT NULL,
  p_paypal_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_payout_method NOT IN ('bank_transfer', 'paypal') THEN RAISE EXCEPTION 'Invalid payout method'; END IF;
  IF length(coalesce(p_bank_name, '')) > 120 OR length(coalesce(p_bank_account, '')) > 120 OR length(coalesce(p_paypal_email, '')) > 254 THEN
    RAISE EXCEPTION 'Payout detail is too long';
  END IF;
  PERFORM set_config('artmatter.allow_payout_update', 'on', true);
  UPDATE public.artists SET
    payout_method = p_payout_method,
    bank_name = nullif(trim(coalesce(p_bank_name, '')), ''),
    bank_account = nullif(trim(coalesce(p_bank_account, '')), ''),
    paypal_email = nullif(lower(trim(coalesce(p_paypal_email, ''))), ''),
    updated_at = now()
  WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Artist profile not found'; END IF;
END
$function$;

DROP POLICY IF EXISTS "Authenticated manage fandoms" ON public.fandoms;
DROP POLICY IF EXISTS "Allow authenticated users to manage fandoms" ON public.fandoms;
DROP POLICY IF EXISTS "Manager manage fandoms" ON public.fandoms;
CREATE POLICY "Manager manage fandoms"
  ON public.fandoms FOR ALL TO authenticated
  USING (public.is_artmatter_manager())
  WITH CHECK (public.is_artmatter_manager());

NOTIFY pgrst, 'reload schema';

COMMIT;
