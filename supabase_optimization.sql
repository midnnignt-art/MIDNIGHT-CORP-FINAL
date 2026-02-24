-- 1. Índices para acelerar búsquedas
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_validation ON orders (order_number, event_id, used, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders (customer_email, status);
CREATE INDEX IF NOT EXISTS idx_orders_staff_event ON orders (staff_id, event_id, status);

-- 2. Función RPC para validación atómica de tickets
CREATE OR REPLACE FUNCTION validate_and_burn_ticket(
    p_order_number TEXT,
    p_event_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- Buscar la orden (un solo SELECT)
    SELECT id, order_number, customer_name, used, event_id, status
    INTO v_order
    FROM orders
    WHERE order_number = p_order_number;

    -- Validaciones en cascada
    IF NOT FOUND THEN
        RETURN json_build_object('status', 'invalid', 'message', '⚠️ Boleto no encontrado');
    END IF;

    IF v_order.status != 'completed' THEN
        RETURN json_build_object('status', 'invalid', 'message', '⚠️ Pago no confirmado');
    END IF;

    IF v_order.event_id != p_event_id THEN
        RETURN json_build_object('status', 'invalid', 'message', '⚠️ Boleto para otro evento');
    END IF;

    IF v_order.used = true THEN
        RETURN json_build_object('status', 'used', 'message', '🚫 Boleto ya utilizado');
    END IF;

    -- Quemar el ticket (UPDATE atómico)
    UPDATE orders
    SET used = true, used_at = NOW()
    WHERE id = v_order.id;

    RETURN json_build_object(
        'status', 'success',
        'message', '✅ Acceso Permitido',
        'customer_name', v_order.customer_name,
        'order_number', v_order.order_number
    );
END;
$$;
