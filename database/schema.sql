CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone_primary TEXT,
  phone_secondary TEXT,
  google_refresh_token_encrypted TEXT,
  google_access_token_encrypted TEXT,
  google_token_expiry TIMESTAMPTZ,
  google_main_calendar_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  google_calendar_id TEXT,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  buffer_minutes INTEGER NOT NULL DEFAULT 15 CHECK (buffer_minutes >= 0),
  same_day_cutoff_time TIME,
  is_active BOOLEAN DEFAULT TRUE,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, slug)
);

ALTER TABLE locations ALTER COLUMN google_calendar_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS location_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  UNIQUE(location_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS location_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT TRUE,
  open_time TIME,
  close_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, override_date)
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  requires_staff_consult BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, slug)
);

CREATE TABLE IF NOT EXISTS service_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('sedan', 'suv', 'truck', 'commercial')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  UNIQUE(service_id, vehicle_type)
);

CREATE TABLE IF NOT EXISTS service_locations (
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, location_id)
);

CREATE TABLE IF NOT EXISTS pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('sedan', 'suv', 'truck', 'commercial')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  UNIQUE(service_id, vehicle_type)
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  service_id UUID REFERENCES services(id),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('sedan', 'suv', 'truck', 'commercial')),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  appointment_start TIMESTAMPTZ NOT NULL,
  appointment_end TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  google_event_id TEXT,
  idempotency_key TEXT,
  notes TEXT,
  price_cents INTEGER,
  confirmation_sms_sent BOOLEAN DEFAULT FALSE,
  confirmation_email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (appointment_end > appointment_start)
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'staff', 'developer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION current_admin_account_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id
  FROM public.admin_users
  WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION current_admin_account_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_admin_account_id() TO authenticated;

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_durations ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_admin_select ON accounts;
CREATE POLICY accounts_admin_select ON accounts
FOR SELECT TO authenticated
USING (id = current_admin_account_id());

DROP POLICY IF EXISTS accounts_admin_update ON accounts;
CREATE POLICY accounts_admin_update ON accounts
FOR UPDATE TO authenticated
USING (id = current_admin_account_id())
WITH CHECK (id = current_admin_account_id());

DROP POLICY IF EXISTS locations_admin_all ON locations;
CREATE POLICY locations_admin_all ON locations
FOR ALL TO authenticated
USING (account_id = current_admin_account_id())
WITH CHECK (account_id = current_admin_account_id());

DROP POLICY IF EXISTS location_hours_admin_all ON location_hours;
CREATE POLICY location_hours_admin_all ON location_hours
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM locations
    WHERE locations.id = location_hours.location_id
      AND locations.account_id = current_admin_account_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM locations
    WHERE locations.id = location_hours.location_id
      AND locations.account_id = current_admin_account_id()
  )
);

DROP POLICY IF EXISTS location_overrides_admin_all ON location_overrides;
CREATE POLICY location_overrides_admin_all ON location_overrides
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM locations
    WHERE locations.id = location_overrides.location_id
      AND locations.account_id = current_admin_account_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM locations
    WHERE locations.id = location_overrides.location_id
      AND locations.account_id = current_admin_account_id()
  )
);

DROP POLICY IF EXISTS services_admin_all ON services;
CREATE POLICY services_admin_all ON services
FOR ALL TO authenticated
USING (account_id = current_admin_account_id())
WITH CHECK (account_id = current_admin_account_id());

DROP POLICY IF EXISTS service_durations_admin_all ON service_durations;
CREATE POLICY service_durations_admin_all ON service_durations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM services
    WHERE services.id = service_durations.service_id
      AND services.account_id = current_admin_account_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM services
    WHERE services.id = service_durations.service_id
      AND services.account_id = current_admin_account_id()
  )
);

DROP POLICY IF EXISTS service_locations_admin_all ON service_locations;
CREATE POLICY service_locations_admin_all ON service_locations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM services
    WHERE services.id = service_locations.service_id
      AND services.account_id = current_admin_account_id()
  )
  AND EXISTS (
    SELECT 1 FROM locations
    WHERE locations.id = service_locations.location_id
      AND locations.account_id = current_admin_account_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM services
    WHERE services.id = service_locations.service_id
      AND services.account_id = current_admin_account_id()
  )
  AND EXISTS (
    SELECT 1 FROM locations
    WHERE locations.id = service_locations.location_id
      AND locations.account_id = current_admin_account_id()
  )
);

DROP POLICY IF EXISTS pricing_admin_all ON pricing;
CREATE POLICY pricing_admin_all ON pricing
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM services
    WHERE services.id = pricing.service_id
      AND services.account_id = current_admin_account_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM services
    WHERE services.id = pricing.service_id
      AND services.account_id = current_admin_account_id()
  )
);

DROP POLICY IF EXISTS bookings_admin_all ON bookings;
CREATE POLICY bookings_admin_all ON bookings
FOR ALL TO authenticated
USING (account_id = current_admin_account_id())
WITH CHECK (account_id = current_admin_account_id());

DROP POLICY IF EXISTS admin_users_admin_select ON admin_users;
CREATE POLICY admin_users_admin_select ON admin_users
FOR SELECT TO authenticated
USING (account_id = current_admin_account_id());

CREATE INDEX IF NOT EXISTS idx_locations_account_slug ON locations(account_id, slug);
CREATE INDEX IF NOT EXISTS idx_location_hours_location_day ON location_hours(location_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_location_overrides_location_date ON location_overrides(location_id, override_date);
CREATE INDEX IF NOT EXISTS idx_services_account_slug ON services(account_id, slug);
CREATE INDEX IF NOT EXISTS idx_bookings_account_start ON bookings(account_id, appointment_start);
CREATE INDEX IF NOT EXISTS idx_bookings_location_start ON bookings(location_id, appointment_start);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_account_idempotency_key
ON bookings(account_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

DROP TRIGGER IF EXISTS set_accounts_updated_at ON accounts;
CREATE TRIGGER set_accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_bookings_updated_at ON bookings;
CREATE TRIGGER set_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
