-- Migration: Add email+password auth for super-admin system

-- 1. Add columns to admin_users table
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- 2. Make account_id nullable (for super-admin who has no account)
ALTER TABLE admin_users ALTER COLUMN account_id DROP NOT NULL;

-- 3. Insert super-admin user (password: Yashovardhan@754 hashed with bcrypt round 10)
-- NOTE: Run from Node.js to hash the password first:
--   const bcrypt = require('bcryptjs');
--   bcrypt.hashSync('Yashovardhan@754', 10)
-- Then update the hash below:
INSERT INTO admin_users (id, email, role, is_super_admin, account_id, created_at)
VALUES (gen_random_uuid(), 'itsyashovardhan@gmail.com', 'developer', true, NULL, NOW())
ON CONFLICT (email) DO UPDATE SET is_super_admin = true;

-- Then update the password_hash for this admin (run separately from seeded password hash)
-- UPDATE admin_users SET password_hash = '<bcrypt_hash_here>' WHERE email = 'itsyashovardhan@gmail.com';

-- 4. (Seed separately) Give Quintin a default password hash
-- UPDATE admin_users SET password_hash = '<quintin_bcrypt_hash>' WHERE email = 'quintin@worldclassautodetail.com';
