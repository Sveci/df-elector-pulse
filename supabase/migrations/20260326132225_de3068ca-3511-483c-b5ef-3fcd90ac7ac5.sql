-- Backfill tenant_id for outgoing messages that are missing it
-- Match by phone number to incoming messages that have tenant_id
UPDATE whatsapp_messages wm_out
SET tenant_id = (
  SELECT DISTINCT wm_in.tenant_id
  FROM whatsapp_messages wm_in
  WHERE wm_in.phone = wm_out.phone
    AND wm_in.tenant_id IS NOT NULL
  LIMIT 1
)
WHERE wm_out.direction = 'outgoing'
  AND wm_out.tenant_id IS NULL;