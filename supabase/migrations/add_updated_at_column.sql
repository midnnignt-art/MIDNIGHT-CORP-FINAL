-- Add updated_at column to orders table if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update the trigger function to handle updated_at correctly (it was already correct, but just in case)
CREATE OR REPLACE FUNCTION update_group_orders_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changes to completed or paid
  IF NEW.status IN ('completed', 'paid') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- If order belongs to a group
    IF NEW.group_id IS NOT NULL THEN
       -- Update all other orders in the same group to the same status
       UPDATE orders
       SET status = NEW.status,
           payment_method = NEW.payment_method, -- Sync payment method too (e.g. 'bold')
           updated_at = NOW()
       WHERE group_id = NEW.group_id
         AND id != NEW.id
         AND status != NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
