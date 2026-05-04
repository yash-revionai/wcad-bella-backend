ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_account_idempotency_key
ON bookings(account_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;
