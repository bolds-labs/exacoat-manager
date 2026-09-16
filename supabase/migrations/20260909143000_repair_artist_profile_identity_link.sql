BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_artist_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  is_verified_self_link boolean := coalesce(
    coalesce(current_setting('artmatter.allow_auth_link', true), '') = 'on'
    AND OLD.auth_user_id IS NULL
    AND NEW.auth_user_id = auth.uid()
    AND lower(btrim(OLD.email)) = lower(btrim(coalesce(auth.jwt() ->> 'email', ''))),
    false
  );
BEGIN
  IF auth.role() = 'service_role' OR public.is_artmatter_manager() THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR (OLD.auth_user_id IS DISTINCT FROM auth.uid() AND NOT is_verified_self_link) THEN
    RAISE EXCEPTION 'Artist update denied';
  END IF;
  IF (NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id AND NOT is_verified_self_link)
    OR NEW.identity_status IS DISTINCT FROM OLD.identity_status
    OR NEW.government_id_url IS DISTINCT FROM OLD.government_id_url
    OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
    OR NEW.badge IS DISTINCT FROM OLD.badge
    OR NEW.previous_badge IS DISTINCT FROM OLD.previous_badge
    OR (
      coalesce(current_setting('artmatter.allow_application_progress', true), '') <> 'on'
      AND NEW.status IS DISTINCT FROM OLD.status
    )
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
  caller_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  PERFORM set_config('artmatter.allow_auth_link', 'on', true);

  UPDATE public.artists SET
    auth_user_id = auth.uid(),
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
  WHERE id = (
    SELECT candidate.id
    FROM public.artists AS candidate
    WHERE candidate.auth_user_id = auth.uid()
      OR (
        candidate.auth_user_id IS NULL
        AND caller_email <> ''
        AND lower(btrim(candidate.email)) = caller_email
      )
    ORDER BY (candidate.auth_user_id = auth.uid()) DESC, candidate.created_at ASC
    LIMIT 1
  )
  RETURNING * INTO result;

  IF result.id IS NULL THEN RAISE EXCEPTION 'Artist profile not found'; END IF;
  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION public.update_artist_self_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_artist_self_profile(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
