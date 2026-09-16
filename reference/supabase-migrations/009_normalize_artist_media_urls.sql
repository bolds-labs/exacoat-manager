BEGIN;

ALTER TABLE public.artists DISABLE TRIGGER enforce_artist_update_restrictions;

UPDATE public.artists
SET profile_picture_url = regexp_replace(
      profile_picture_url,
      '^https?://(www[.])?(artmatter[.]co|cms[.]artmatter[.]co)/wp-content/uploads/',
      'https://media.artmatter.co/',
      'i'
    ),
    updated_at = now()
WHERE profile_picture_url ~* '^https?://(www[.])?(artmatter[.]co|cms[.]artmatter[.]co)/wp-content/uploads/';

UPDATE public.artists
SET banner_image_url = regexp_replace(
      banner_image_url,
      '^https?://(www[.])?(artmatter[.]co|cms[.]artmatter[.]co)/wp-content/uploads/',
      'https://media.artmatter.co/',
      'i'
    ),
    updated_at = now()
WHERE banner_image_url ~* '^https?://(www[.])?(artmatter[.]co|cms[.]artmatter[.]co)/wp-content/uploads/';

UPDATE public.artists
SET banner_url = regexp_replace(
      banner_url,
      '^https?://(www[.])?(artmatter[.]co|cms[.]artmatter[.]co)/wp-content/uploads/',
      'https://media.artmatter.co/',
      'i'
    ),
    updated_at = now()
WHERE banner_url ~* '^https?://(www[.])?(artmatter[.]co|cms[.]artmatter[.]co)/wp-content/uploads/';

NOTIFY pgrst, 'reload schema';

ALTER TABLE public.artists ENABLE TRIGGER enforce_artist_update_restrictions;

COMMIT;
