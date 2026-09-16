-- ==============================================================================
-- Artmatter Supabase Migration 002: Artist Balance & Financial Ledger Sync
-- ==============================================================================

-- 0. Ensure Artists Balance, Sales Tracking & Timestamp Columns Exist
ALTER TABLE artists 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS unpaid_balance_usd NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earned_usd NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_sales_count INT DEFAULT 0;

-- 1. Performance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_commissions_artist_status ON commissions(artist_id, status);
CREATE INDEX IF NOT EXISTS idx_commissions_payout_id ON commissions(payout_id);
CREATE INDEX IF NOT EXISTS idx_commissions_order_wp_id ON commissions(order_wp_id);
CREATE INDEX IF NOT EXISTS idx_artworks_artist_status ON artworks(artist_id, status);
CREATE INDEX IF NOT EXISTS idx_artworks_wp_id ON artworks(wp_id);

-- 2. Real-time Artist Balance Recalculation Trigger Function
CREATE OR REPLACE FUNCTION sync_artist_balances_trigger()
RETURNS TRIGGER AS $$
DECLARE
    target_artist_id UUID;
BEGIN
    target_artist_id := COALESCE(NEW.artist_id, OLD.artist_id);
    IF target_artist_id IS NOT NULL THEN
        UPDATE artists
        SET 
            unpaid_balance_usd = COALESCE((
                SELECT SUM(commission_amount) 
                FROM commissions 
                WHERE artist_id = target_artist_id 
                  AND status IN ('commission_approved', 'approved')
            ), 0),
            total_earned_usd = COALESCE((
                SELECT SUM(commission_amount) 
                FROM commissions 
                WHERE artist_id = target_artist_id 
                  AND status NOT IN ('commission_cancelled', 'cancelled')
            ), 0),
            total_sales_count = COALESCE((
                SELECT COUNT(*) 
                FROM commissions 
                WHERE artist_id = target_artist_id 
                  AND status NOT IN ('commission_cancelled', 'cancelled')
            ), 0),
            updated_at = NOW()
        WHERE id = target_artist_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach Trigger to Commissions Table
DROP TRIGGER IF EXISTS trg_sync_artist_balances ON commissions;
CREATE TRIGGER trg_sync_artist_balances
AFTER INSERT OR UPDATE OR DELETE ON commissions
FOR EACH ROW
EXECUTE FUNCTION sync_artist_balances_trigger();
