START TRANSACTION;

-- Unconfigured demo credentials
-- Tenant owner: owner-unconfigured@demo.com / Demo@1234
-- Workspace: demo-unconfigured
-- Expected behavior: after login, /new-dash should redirect to /new-dash/setup

INSERT INTO tenants (
  tenant_id,
  name,
  legal_name,
  status,
  onboarding_status
)
VALUES (
  'demo-unconfigured',
  'Demo Unconfigured',
  'Demo Unconfigured Private Limited',
  'active',
  'main_office_pending'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  legal_name = VALUES(legal_name),
  status = VALUES(status),
  onboarding_status = VALUES(onboarding_status);

INSERT INTO users (
  tenant_id,
  office_id,
  employee_id,
  first_name,
  last_name,
  display_name,
  email,
  phone,
  password_hash,
  pin_hash,
  user_type,
  status,
  email_verified_at
)
VALUES (
  'demo-unconfigured',
  NULL,
  NULL,
  'Demo',
  'Owner',
  'Demo Owner Unconfigured',
  'owner-unconfigured@demo.com',
  '+919900000021',
  '$2y$10$gr52j.XhuV2k89g8ov0CzON8yT4mtn231McTDYZeJisokA9SulEtm',
  NULL,
  'tenant_owner',
  'active',
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  display_name = VALUES(display_name),
  phone = VALUES(phone),
  password_hash = VALUES(password_hash),
  user_type = VALUES(user_type),
  status = VALUES(status),
  email_verified_at = VALUES(email_verified_at),
  updated_at = CURRENT_TIMESTAMP;

UPDATE tenants t
JOIN users u
  ON u.tenant_id = t.tenant_id
 AND u.email = 'owner-unconfigured@demo.com'
 AND u.deleted_at IS NULL
SET t.primary_owner_user_id = u.id
WHERE t.tenant_id = 'demo-unconfigured';

INSERT INTO user_roles (
  tenant_id,
  user_id,
  role_id,
  office_id,
  assigned_by_user_id
)
SELECT
  'demo-unconfigured',
  u.id,
  r.id,
  NULL,
  u.id
FROM users u
JOIN roles r
  ON r.role_key = 'tenant_owner'
WHERE u.tenant_id = 'demo-unconfigured'
  AND u.email = 'owner-unconfigured@demo.com'
  AND u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.tenant_id = 'demo-unconfigured'
      AND ur.user_id = u.id
      AND ur.role_id = r.id
      AND ur.office_id IS NULL
  )
LIMIT 1;

COMMIT;
