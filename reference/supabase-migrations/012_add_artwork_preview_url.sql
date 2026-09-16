-- Canonical Manager/storefront preview generated from the artwork master.
ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS preview_url text;

NOTIFY pgrst, 'reload schema';
