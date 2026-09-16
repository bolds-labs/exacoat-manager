BEGIN;

DROP POLICY IF EXISTS "Managers read artworks" ON public.artworks;
CREATE POLICY "Managers read artworks"
  ON public.artworks FOR SELECT TO authenticated
  USING (public.is_artmatter_manager());

NOTIFY pgrst, 'reload schema';

COMMIT;
