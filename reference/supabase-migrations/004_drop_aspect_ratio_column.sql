-- ============================================================================
-- ARTMatter Supabase Migration 004: Drop legacy aspect_ratio column
-- ============================================================================
-- The artworks catalog standard uses strictly 'orientation' ('portrait' | 'landscape').
-- Run this in the Supabase SQL Editor:

ALTER TABLE public.artworks 
  DROP COLUMN IF EXISTS aspect_ratio;
