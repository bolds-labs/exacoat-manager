BEGIN;

ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS is_featured boolean;

UPDATE public.artworks
SET is_featured = CASE
  WHEN lower(coalesce(metadata ->> 'is_featured', '')) IN ('true', '1', 'yes', 'on') THEN true
  WHEN lower(coalesce(metadata ->> 'featured', '')) IN ('true', '1', 'yes', 'on') THEN true
  WHEN lower(coalesce(metadata ->> 'artwork_is_featured', '')) IN ('true', '1', 'yes', 'on') THEN true
  WHEN lower(coalesce(metadata ->> '_artmatter_featured', '')) IN ('true', '1', 'yes', 'on') THEN true
  ELSE false
END
WHERE is_featured IS NULL;

ALTER TABLE public.artworks
  ALTER COLUMN is_featured SET DEFAULT false,
  ALTER COLUMN is_featured SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artworks_featured_created_at
  ON public.artworks (is_featured, created_at DESC)
  WHERE is_featured IS TRUE;

UPDATE public.artworks
SET image_url = regexp_replace(
  image_url,
  '^https?://(www[.])?(artmatter[.]co|cms[.]artmatter[.]co)/wp-content/uploads/',
  'https://media.artmatter.co/',
  'i'
)
WHERE image_url ~* '^https?://(www[.])?(artmatter[.]co|cms[.]artmatter[.]co)/wp-content/uploads/';

CREATE OR REPLACE FUNCTION public.is_artmatter_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'super_admin')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) IN ('admin@artmatter.co', 'shandy@artmatter.co');
$$;

REVOKE ALL ON FUNCTION public.is_artmatter_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_artmatter_manager() TO authenticated;

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active artist profile rows" ON public.artists;
CREATE POLICY "Public read active artist profile rows"
  ON public.artists
  FOR SELECT
  TO anon
  USING (status = 'active');

REVOKE ALL ON TABLE public.artists FROM anon;
GRANT SELECT (
  id, wp_user_id, username, name, display_name, bio, about_me,
  profile_picture_url, banner_image_url, banner_url, badge, previous_badge,
  status, country, is_featured, artist_is_artist_of_the_month, created_at, updated_at
) ON public.artists TO anon;

CREATE OR REPLACE VIEW public.public_artist_profiles
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  id, wp_user_id, username, name, display_name, bio, about_me,
  profile_picture_url, banner_image_url, banner_url, badge, previous_badge,
  status, country, is_featured, artist_is_artist_of_the_month, created_at, updated_at
FROM public.artists
WHERE status = 'active';

REVOKE ALL ON TABLE public.public_artist_profiles FROM PUBLIC;
GRANT SELECT ON TABLE public.public_artist_profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
