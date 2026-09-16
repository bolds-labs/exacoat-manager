BEGIN;

CREATE OR REPLACE FUNCTION public.log_artist_self_audit_event(
  p_entity_type text,
  p_entity_id uuid,
  p_event text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  owned_artist_id uuid;
  owns_entity boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT artists.id INTO owned_artist_id
  FROM public.artists AS artists
  WHERE artists.auth_user_id = auth.uid()
  LIMIT 1;

  IF owned_artist_id IS NULL THEN RAISE EXCEPTION 'Artist profile not found'; END IF;

  CASE p_entity_type
    WHEN 'artist' THEN
      owns_entity := p_entity_id = owned_artist_id;
    WHEN 'artwork' THEN
      owns_entity := EXISTS (
        SELECT 1 FROM public.artworks
        WHERE artworks.id = p_entity_id AND artworks.artist_id = owned_artist_id
      );
    WHEN 'payout' THEN
      owns_entity := EXISTS (
        SELECT 1 FROM public.payouts
        WHERE payouts.id = p_entity_id AND payouts.artist_id = owned_artist_id
      );
    ELSE
      owns_entity := false;
  END CASE;

  IF NOT owns_entity THEN RAISE EXCEPTION 'Audit event denied'; END IF;

  INSERT INTO public.audit_logs (entity_type, entity_id, event, performed_by, payload, created_at)
  VALUES (
    p_entity_type,
    p_entity_id,
    left(p_event, 160),
    coalesce(auth.jwt() ->> 'email', auth.uid()::text),
    coalesce(p_payload, '{}'::jsonb),
    now()
  );
END
$function$;

REVOKE ALL ON FUNCTION public.log_artist_self_audit_event(text, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_artist_self_audit_event(text, uuid, text, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
