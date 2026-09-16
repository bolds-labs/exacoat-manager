-- ==============================================================================
-- UPDATE COMMISSION CLEARANCE DEFAULT TO 14 DAYS
-- ==============================================================================

CREATE OR REPLACE FUNCTION generate_commission_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.commission_record_id IS NULL OR NEW.commission_record_id = '' THEN
        NEW.commission_record_id := 'C' || nextval('commission_seq')::text;
    END IF;
    
    -- Auto-calculate clearance date (14 days clearance period) if not set
    IF NEW.clearance_at IS NULL THEN
        NEW.clearance_at := NEW.created_at + INTERVAL '14 days';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trg_generate_commission_code ON commissions;
CREATE TRIGGER trg_generate_commission_code
BEFORE INSERT ON commissions
FOR EACH ROW EXECUTE FUNCTION generate_commission_code();
