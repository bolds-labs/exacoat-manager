-- Apply Phase A before deploying the storefront view consumer.
-- Apply Phase B only after the storefront reads public_artist_profiles.

-- PHASE A: additive objects and safe update paths.

CREATE OR REPLACE FUNCTION public.is_artmatter_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'super_admin')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('admin@artmatter.co', 'shandy@artmatter.co');
$$;

CREATE TABLE IF NOT EXISTS public.artist_compliance (
  artist_id uuid PRIMARY KEY REFERENCES public.artists(id) ON DELETE CASCADE,
  document_key text NOT NULL,
  status text NOT NULL DEFAULT 'in_review',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

ALTER TABLE public.artist_compliance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers access artist compliance" ON public.artist_compliance;
CREATE POLICY "Managers access artist compliance" ON public.artist_compliance
  FOR ALL TO authenticated
  USING (public.is_artmatter_manager())
  WITH CHECK (public.is_artmatter_manager());
REVOKE ALL ON public.artist_compliance FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_compliance TO authenticated;

INSERT INTO public.artist_compliance (artist_id, document_key, status, submitted_at)
SELECT
  id,
  CASE
    WHEN government_id_url LIKE 'r2://%' THEN substring(government_id_url FROM 6)
    ELSE regexp_replace(split_part(government_id_url, '?', 1), '^https?://[^/]+/[^/]+/', '')
  END,
  coalesce(nullif(identity_status, ''), 'in_review'),
  coalesce(updated_at, now())
FROM public.artists
WHERE government_id_url LIKE 'r2://%'
   OR government_id_url ~ '^https://[^/]+\.r2\.cloudflarestorage\.com/[^/]+/kyc-documents/'
ON CONFLICT (artist_id) DO NOTHING;

UPDATE public.artists a
SET government_id_url = 'private'
WHERE EXISTS (SELECT 1 FROM public.artist_compliance c WHERE c.artist_id = a.id);

UPDATE public.artists
SET government_id_url = NULL,
    identity_status = CASE WHEN identity_status = 'verified' THEN identity_status ELSE 'unverified' END
WHERE government_id_url IS NOT NULL
  AND government_id_url <> ''
  AND government_id_url <> 'private';

CREATE OR REPLACE VIEW public.public_artist_profiles
WITH (security_barrier = true)
AS
SELECT
  id,
  wp_user_id,
  username,
  name,
  display_name,
  bio,
  about_me,
  profile_picture_url,
  banner_image_url,
  banner_url,
  badge,
  previous_badge,
  status,
  country,
  is_featured,
  artist_is_artist_of_the_month,
  created_at,
  updated_at
FROM public.artists
WHERE status = 'active';

GRANT SELECT ON public.public_artist_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_artist_self_profile(p_updates jsonb)
RETURNS public.artists
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE id = auth.uid()
  RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Artist profile not found'; END IF;
  RETURN result;
END;
$$;

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
AS $$
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
  WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Artist profile not found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_artist_self_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_artist_self_profile(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.update_artist_payout_details(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_artist_payout_details(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_artist_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_artmatter_manager() THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR auth.uid() <> OLD.id THEN RAISE EXCEPTION 'Artist update denied'; END IF;
  IF NEW.identity_status IS DISTINCT FROM OLD.identity_status
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
  THEN RAISE EXCEPTION 'Protected artist fields cannot be changed'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_artist_update_restrictions ON public.artists;
CREATE TRIGGER enforce_artist_update_restrictions
BEFORE UPDATE ON public.artists
FOR EACH ROW EXECUTE FUNCTION public.enforce_artist_update_restrictions();

-- PHASE B: run only after the storefront deployment reads public_artist_profiles.

DROP POLICY IF EXISTS "Allow anon select on artists" ON public.artists;
DROP POLICY IF EXISTS "Allow read access to artists" ON public.artists;
DROP POLICY IF EXISTS "Allow service_role full access to artists" ON public.artists;
DROP POLICY IF EXISTS "Artists read access" ON public.artists;
DROP POLICY IF EXISTS "Artists update own profile" ON public.artists;
DROP POLICY IF EXISTS "Artists insert own profile" ON public.artists;

CREATE POLICY "Artists private read access" ON public.artists
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_artmatter_manager());
CREATE POLICY "Artists private update access" ON public.artists
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_artmatter_manager())
  WITH CHECK (id = auth.uid() OR public.is_artmatter_manager());
CREATE POLICY "Artists private insert access" ON public.artists
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_artmatter_manager());
REVOKE ALL ON public.artists FROM anon;

DROP POLICY IF EXISTS "Allow service_role full access to artworks" ON public.artworks;
DROP POLICY IF EXISTS "Allow anon select on products" ON public.artworks;
DROP POLICY IF EXISTS "Allow read access to artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artworks read policy" ON public.artworks;
CREATE POLICY "Public read published artworks" ON public.artworks
  FOR SELECT TO anon, authenticated
  USING (status IN ('publish', 'published', 'live'));
CREATE POLICY "Artists read own artworks" ON public.artworks
  FOR SELECT TO authenticated
  USING (artist_id = auth.uid() OR public.is_artmatter_manager());

DROP POLICY IF EXISTS "Allow service_role full access to commissions" ON public.commissions;
DROP POLICY IF EXISTS "Allow anon select on commissions" ON public.commissions;
DROP POLICY IF EXISTS "Allow read access to commissions" ON public.commissions;

DROP POLICY IF EXISTS "Allow service_role full access to payouts" ON public.payouts;
DROP POLICY IF EXISTS "Allow anon select on payouts" ON public.payouts;
DROP POLICY IF EXISTS "Allow read access to payouts" ON public.payouts;

DROP POLICY IF EXISTS "Allow service_role full access to audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow read access to audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Managers read audit logs" ON public.audit_logs;
CREATE POLICY "Managers read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_artmatter_manager());
