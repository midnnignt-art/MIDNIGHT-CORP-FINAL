-- Add group_id column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS group_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_group_id ON orders(group_id);

-- Create function to auto-update group orders
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

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_group_orders ON orders;
CREATE TRIGGER trigger_update_group_orders
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_group_orders_status();
