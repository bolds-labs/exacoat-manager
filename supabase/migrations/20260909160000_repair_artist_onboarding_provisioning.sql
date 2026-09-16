BEGIN;

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS application_status text;

ALTER TABLE public.artists DISABLE TRIGGER enforce_artist_update_restrictions;

UPDATE public.artists
SET application_status = coalesce(
  nullif(metadata ->> 'application_status', ''),
  CASE
    WHEN status = 'active' THEN 'approved'
    WHEN status = 'suspended' AND coalesce((metadata ->> 'is_rejected')::boolean, false) THEN 'not_approved'
    ELSE 'not_started'
  END
)
WHERE application_status IS NULL;

ALTER TABLE public.artists
  ALTER COLUMN application_status SET DEFAULT 'not_started';

UPDATE public.artists AS artist
SET auth_user_id = auth_user.id,
    email = coalesce(artist.email, lower(btrim(auth_user.email))),
    updated_at = now()
FROM auth.users AS auth_user
WHERE artist.auth_user_id IS NULL
  AND (
    artist.id = auth_user.id
    OR (
      artist.email IS NOT NULL
      AND auth_user.email IS NOT NULL
      AND lower(btrim(artist.email)) = lower(btrim(auth_user.email))
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.artists AS linked
    WHERE linked.auth_user_id = auth_user.id
  );

ALTER TABLE public.artists ENABLE TRIGGER enforce_artist_update_restrictions;

CREATE OR REPLACE FUNCTION public.ensure_artist_self_profile()
RETURNS public.artists
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  result public.artists;
  caller_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  caller_metadata jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  base_username text;
  available_username text;
  display_name text;
  suffix integer := 1;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO result
  FROM public.artists
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF result.id IS NOT NULL THEN RETURN result; END IF;

  SELECT * INTO result
  FROM public.artists
  WHERE auth_user_id IS NULL
    AND (
      id = auth.uid()
      OR (caller_email <> '' AND lower(btrim(email)) = caller_email)
    )
  ORDER BY (id = auth.uid()) DESC, created_at ASC
  LIMIT 1;

  IF result.id IS NOT NULL THEN
    PERFORM set_config('artmatter.allow_auth_link', 'on', true);
    UPDATE public.artists
    SET auth_user_id = auth.uid(),
        email = coalesce(email, nullif(caller_email, '')),
        application_status = coalesce(application_status, nullif(metadata ->> 'application_status', ''), 'not_started'),
        updated_at = now()
    WHERE id = result.id
    RETURNING * INTO result;
    RETURN result;
  END IF;

  display_name := left(coalesce(
    nullif(btrim(caller_metadata ->> 'full_name'), ''),
    nullif(btrim(caller_metadata ->> 'name'), ''),
    nullif(split_part(caller_email, '@', 1), ''),
    'Artist'
  ), 30);

  base_username := left(regexp_replace(lower(coalesce(
    nullif(caller_metadata ->> 'username', ''),
    nullif(split_part(caller_email, '@', 1), ''),
    'artist-' || left(auth.uid()::text, 6)
  )), '[^a-z0-9_.-]+', '-', 'g'), 30);
  base_username := trim(both '-' from base_username);
  IF length(base_username) < 3 THEN base_username := 'artist-' || left(auth.uid()::text, 6); END IF;
  available_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.artists WHERE lower(username) = lower(available_username)) LOOP
    available_username := left(base_username, greatest(1, 29 - length(suffix::text))) || '-' || suffix::text;
    suffix := suffix + 1;
  END LOOP;

  INSERT INTO public.artists (
    id,
    auth_user_id,
    name,
    display_name,
    username,
    email,
    country,
    identity_status,
    commission_rate,
    status,
    application_status,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    auth.uid(),
    auth.uid(),
    display_name,
    NULL,
    available_username,
    nullif(caller_email, ''),
    NULL,
    'unverified',
    12.5,
    'pending',
    'not_started',
    jsonb_build_object(
      'registered_email', nullif(caller_email, ''),
      'basic_profile_completed', false,
      'application_status', 'not_started',
      'registered_at', now()
    ),
    now(),
    now()
  )
  RETURNING * INTO result;

  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION public.ensure_artist_self_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_artist_self_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_artist_self_profile(p_updates jsonb)
RETURNS public.artists
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  result public.artists;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  result := public.ensure_artist_self_profile();

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
    application_status = coalesce(p_updates->>'application_status', application_status),
    metadata = CASE WHEN p_updates ? 'metadata' THEN coalesce(metadata, '{}'::jsonb) || coalesce(p_updates->'metadata', '{}'::jsonb) ELSE metadata END,
    updated_at = now()
  WHERE auth_user_id = auth.uid()
  RETURNING * INTO result;

  IF result.id IS NULL THEN RAISE EXCEPTION 'Artist profile not found'; END IF;
  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION public.update_artist_self_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_artist_self_profile(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
