-- ==============================================================================
-- ARTMATTER MASTER MIGRATION: ADMINISTRATIVE USER & TEST ARTIST DELETION (V2)
-- Supports Artwork Handling: 'delete' | 'reassign' | 'unassign'
-- Safe & Idempotent (Run directly in Supabase SQL Editor)
-- ==============================================================================

DROP FUNCTION IF EXISTS public.delete_user_by_admin(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.delete_user_by_admin(UUID, BOOLEAN, TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION public.delete_user_by_admin(
  target_user_id UUID DEFAULT NULL,
  purge_artist_record BOOLEAN DEFAULT TRUE,
  artwork_action TEXT DEFAULT 'delete', -- 'delete' | 'reassign' | 'unassign'
  reassign_to_artist_id UUID DEFAULT NULL,
  target_artist_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_email TEXT;
  v_caller_role TEXT;
  v_target_email TEXT := NULL;
  v_target_role TEXT := NULL;
  v_artist_id UUID := NULL;
  v_has_approved_commissions BOOLEAN := FALSE;
  v_has_sent_payouts BOOLEAN := FALSE;
  v_deleted_artist BOOLEAN := FALSE;
  v_artwork_count INT := 0;
  v_reassigned_artworks INT := 0;
  v_deleted_artworks INT := 0;
  v_unassigned_artworks INT := 0;
BEGIN
  -- 1. Authorization checks: caller must be super_admin, root platform admin, or service_role
  v_caller_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_caller_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '');

  IF NOT (
    v_caller_email IN ('admin@artmatter.co', 'shandy@artmatter.co')
    OR v_caller_role = 'super_admin'
    OR coalesce(auth.role(), '') = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only Super Admin can delete user accounts' USING ERRCODE = '42501';
  END IF;

  -- 2. Guard against self-deletion
  IF target_user_id IS NOT NULL AND target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own active administrator account' USING ERRCODE = '23514';
  END IF;

  -- 3. Retrieve target user details if target_user_id is provided
  IF target_user_id IS NOT NULL THEN
    SELECT email, coalesce(raw_app_meta_data->>'role', raw_user_meta_data->>'role', '')
    INTO v_target_email, v_target_role
    FROM auth.users
    WHERE id = target_user_id;

    IF v_target_email IS NULL THEN
      RAISE EXCEPTION 'Target user does not exist in auth records' USING ERRCODE = 'P0002';
    END IF;

    -- Guard against deleting primary root platform administrators
    IF lower(v_target_email) IN ('admin@artmatter.co', 'shandy@artmatter.co') THEN
      RAISE EXCEPTION 'Cannot delete platform root administrator account' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 4. Determine artist record
  IF target_artist_id IS NOT NULL THEN
    v_artist_id := target_artist_id;
    -- If target_user_id was not provided, look it up from artists table
    IF target_user_id IS NULL THEN
      SELECT auth_user_id, email INTO target_user_id, v_target_email
      FROM public.artists
      WHERE id = target_artist_id;
    END IF;
  ELSIF target_user_id IS NOT NULL THEN
    SELECT id INTO v_artist_id
    FROM public.artists
    WHERE auth_user_id = target_user_id
       OR (email IS NOT NULL AND lower(btrim(email)) = lower(btrim(v_target_email)))
    LIMIT 1;
  END IF;

  -- 5. If linked artist record exists, process artworks and financial checks
  IF v_artist_id IS NOT NULL THEN
    -- Check ledger integrity: approved/paid commissions or completed payouts
    SELECT EXISTS (
      SELECT 1 FROM public.commissions
      WHERE artist_id = v_artist_id
        AND status IN ('commission_approved', 'approved', 'commission_paid', 'paid')
    ) INTO v_has_approved_commissions;

    SELECT EXISTS (
      SELECT 1 FROM public.payouts
      WHERE artist_id = v_artist_id
        AND payout_status = 'payout_sent'
    ) INTO v_has_sent_payouts;

    -- Count total artworks
    SELECT count(*) INTO v_artwork_count
    FROM public.artworks
    WHERE artist_id = v_artist_id;

    -- Handle artworks according to artwork_action
    IF artwork_action = 'reassign' THEN
      IF reassign_to_artist_id IS NULL THEN
        RAISE EXCEPTION 'Reassign artist target ID must be provided when artwork_action is reassign' USING ERRCODE = '23514';
      END IF;

      IF reassign_to_artist_id = v_artist_id THEN
        RAISE EXCEPTION 'Cannot reassign artworks to the same artist being deleted' USING ERRCODE = '23514';
      END IF;

      IF NOT EXISTS (SELECT 1 FROM public.artists WHERE id = reassign_to_artist_id) THEN
        RAISE EXCEPTION 'Target artist for reassignment does not exist' USING ERRCODE = 'P0002';
      END IF;

      UPDATE public.artworks
      SET artist_id = reassign_to_artist_id,
          updated_at = NOW()
      WHERE artist_id = v_artist_id;
      GET DIAGNOSTICS v_reassigned_artworks = ROW_COUNT;

    ELSIF artwork_action = 'unassign' THEN
      UPDATE public.artworks
      SET artist_id = NULL,
          updated_at = NOW()
      WHERE artist_id = v_artist_id;
      GET DIAGNOSTICS v_unassigned_artworks = ROW_COUNT;

    ELSE -- 'delete'
      DELETE FROM public.artworks
      WHERE artist_id = v_artist_id;
      GET DIAGNOSTICS v_deleted_artworks = ROW_COUNT;
    END IF;

    -- Handle artist record deletion vs suspension (for accounting ledger integrity)
    IF v_has_approved_commissions OR v_has_sent_payouts THEN
      -- Preserve historical transactions: do not delete artist row. Unlink auth and suspend.
      UPDATE public.artists
      SET auth_user_id = NULL,
          status = 'suspended',
          updated_at = NOW()
      WHERE id = v_artist_id;
      v_deleted_artist := FALSE;
    ELSE
      IF purge_artist_record THEN
        -- Delete test commissions if any (pending or cancelled)
        DELETE FROM public.commissions WHERE artist_id = v_artist_id;
        
        -- Delete test payouts if any
        DELETE FROM public.payouts WHERE artist_id = v_artist_id;
        
        -- Delete the artist record
        DELETE FROM public.artists WHERE id = v_artist_id;
        v_deleted_artist := TRUE;
      ELSE
        UPDATE public.artists
        SET auth_user_id = NULL,
            updated_at = NOW()
        WHERE id = v_artist_id;
        v_deleted_artist := FALSE;
      END IF;
    END IF;
  END IF;

  -- 6. Delete user from auth.users if target_user_id exists
  IF target_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = target_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'deleted_user_id', target_user_id,
    'target_email', v_target_email,
    'artist_id', v_artist_id,
    'artwork_count', v_artwork_count,
    'artwork_action', artwork_action,
    'reassigned_artworks', v_reassigned_artworks,
    'deleted_artworks', v_deleted_artworks,
    'unassigned_artworks', v_unassigned_artworks,
    'reassigned_to_artist_id', reassign_to_artist_id,
    'purged_artist_profile', v_deleted_artist,
    'ledger_preserved', (v_has_approved_commissions OR v_has_sent_payouts)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_by_admin(UUID, BOOLEAN, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(UUID, BOOLEAN, TEXT, UUID, UUID) TO authenticated, service_role;
