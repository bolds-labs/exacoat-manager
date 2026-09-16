-- ==============================================================================
-- ARTMATTER CREATOR STUDIO & AUTHENTICATION SUPABASE MIGRATION (003)
-- Safe & Idempotent (Run directly in Supabase SQL Editor)
-- ==============================================================================

-- 1. Ensure public.artists has all Creator Studio columns
ALTER TABLE public.artists 
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS about_me TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Indonesia',
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS paypal_email TEXT,
  ADD COLUMN IF NOT EXISTS government_id_url TEXT,
  ADD COLUMN IF NOT EXISTS identity_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 15,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Ensure public.artworks has all Studio columns
ALTER TABLE public.artworks 
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS orientation TEXT DEFAULT 'portrait',
  ADD COLUMN IF NOT EXISTS master_file_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Ensure public.payouts destination and record columns
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS payout_record_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_amount_gross NUMERIC,
  ADD COLUMN IF NOT EXISTS fee_deduction NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS destination JSONB DEFAULT '{}'::jsonb;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- 5. Helper function to check if current user is admin/manager
CREATE OR REPLACE FUNCTION public.is_artmatter_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    (auth.jwt() ->> 'email') LIKE '%@artmatter.co' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'super_admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS Policies

-- Artists Table Policies
DROP POLICY IF EXISTS "Artists read access" ON public.artists;
CREATE POLICY "Artists read access" ON public.artists
  FOR SELECT USING (
    id = auth.uid() OR 
    public.is_artmatter_manager() OR 
    status = 'active'
  );

DROP POLICY IF EXISTS "Artists update own profile" ON public.artists;
CREATE POLICY "Artists update own profile" ON public.artists
  FOR UPDATE USING (
    id = auth.uid() OR public.is_artmatter_manager()
  );

DROP POLICY IF EXISTS "Artists insert own profile" ON public.artists;
CREATE POLICY "Artists insert own profile" ON public.artists
  FOR INSERT WITH CHECK (
    id = auth.uid() OR public.is_artmatter_manager()
  );

-- Artworks Table Policies
DROP POLICY IF EXISTS "Artworks read policy" ON public.artworks;
CREATE POLICY "Artworks read policy" ON public.artworks
  FOR SELECT USING (
    artist_id = auth.uid() OR 
    public.is_artmatter_manager() OR 
    status = 'published'
  );

DROP POLICY IF EXISTS "Artworks creator write policy" ON public.artworks;
CREATE POLICY "Artworks creator write policy" ON public.artworks
  FOR ALL USING (
    artist_id = auth.uid() OR public.is_artmatter_manager()
  );

-- Commissions Table Policies
DROP POLICY IF EXISTS "Commissions artist access policy" ON public.commissions;
CREATE POLICY "Commissions artist access policy" ON public.commissions
  FOR SELECT USING (
    artist_id = auth.uid() OR public.is_artmatter_manager()
  );

-- Payouts Table Policies
DROP POLICY IF EXISTS "Payouts artist access policy" ON public.payouts;
CREATE POLICY "Payouts artist access policy" ON public.payouts
  FOR SELECT USING (
    artist_id = auth.uid() OR public.is_artmatter_manager()
  );

DROP POLICY IF EXISTS "Payouts artist insert policy" ON public.payouts;
CREATE POLICY "Payouts artist insert policy" ON public.payouts
  FOR INSERT WITH CHECK (
    artist_id = auth.uid() OR public.is_artmatter_manager()
  );
