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
  is_application_progress boolean := coalesce(
    current_setting('artmatter.allow_application_progress', true), ''
  ) = 'on';
BEGIN
  IF auth.role() = 'service_role' OR public.is_artmatter_manager() OR is_application_progress THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR (OLD.auth_user_id IS DISTINCT FROM auth.uid() AND NOT is_verified_self_link) THEN
    RAISE EXCEPTION 'Artist update denied';
  END IF;
  IF (NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id AND NOT is_verified_self_link)
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

REVOKE ALL ON FUNCTION public.enforce_artist_update_restrictions() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
