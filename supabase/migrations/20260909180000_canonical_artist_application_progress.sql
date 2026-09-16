BEGIN;

CREATE OR REPLACE FUNCTION public.advance_artist_application_progress()
RETURNS public.artists
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  artist_record public.artists;
  qualifying_count integer := 0;
  current_status text;
  next_status text;
  next_metadata jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO artist_record
  FROM public.artists
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF artist_record.id IS NULL THEN RAISE EXCEPTION 'Artist profile not found'; END IF;

  SELECT count(*) INTO qualifying_count
  FROM public.artworks
  WHERE artist_id = artist_record.id
    AND status IN ('pending', 'publish');

  current_status := coalesce(
    nullif(artist_record.application_status, ''),
    nullif(artist_record.metadata ->> 'application_status', ''),
    'not_started'
  );
  next_status := current_status;

  IF current_status IN ('not_started', 'in_progress', 'pending') THEN
    IF qualifying_count >= 3 THEN
      next_status := 'under_review';
    ELSIF qualifying_count > 0 THEN
      next_status := 'in_progress';
    END IF;
  END IF;

  next_metadata := jsonb_set(
    coalesce(artist_record.metadata, '{}'::jsonb),
    '{application_status}',
    to_jsonb(next_status),
    true
  );
  IF next_status = 'under_review' AND current_status <> 'under_review' THEN
    next_metadata := jsonb_set(next_metadata, '{application_submitted_at}', to_jsonb(now()), true);
  END IF;

  PERFORM set_config('artmatter.allow_application_progress', 'on', true);
  UPDATE public.artists
  SET application_status = next_status,
      metadata = next_metadata,
      updated_at = now()
  WHERE id = artist_record.id
  RETURNING * INTO artist_record;

  RETURN artist_record;
END
$function$;

REVOKE ALL ON FUNCTION public.advance_artist_application_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_artist_application_progress() TO authenticated;

ALTER TABLE public.artists DISABLE TRIGGER enforce_artist_update_restrictions;

WITH artwork_counts AS (
  SELECT artist_id, count(*)::integer AS qualifying_count
  FROM public.artworks
  WHERE status IN ('pending', 'publish')
  GROUP BY artist_id
), progress AS (
  SELECT
    artists.id,
    CASE
      WHEN artwork_counts.qualifying_count >= 3 THEN 'under_review'
      WHEN artwork_counts.qualifying_count > 0 THEN 'in_progress'
      ELSE coalesce(nullif(artists.application_status, ''), 'not_started')
    END AS next_status
  FROM public.artists AS artists
  JOIN artwork_counts ON artwork_counts.artist_id = artists.id
  WHERE coalesce(artists.application_status, artists.metadata ->> 'application_status', 'not_started')
    IN ('not_started', 'in_progress', 'pending')
)
UPDATE public.artists AS artists
SET application_status = progress.next_status,
    metadata = jsonb_set(
      coalesce(artists.metadata, '{}'::jsonb),
      '{application_status}',
      to_jsonb(progress.next_status),
      true
    ),
    updated_at = now()
FROM progress
WHERE artists.id = progress.id;

ALTER TABLE public.artists ENABLE TRIGGER enforce_artist_update_restrictions;

NOTIFY pgrst, 'reload schema';

COMMIT;
