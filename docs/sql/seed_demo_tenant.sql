START TRANSACTION;

-- Demo credentials
-- Tenant owner: owner@demo.com / Demo@1234
-- Branch admin: branch-admin@demo.com / Branch@1234
-- Employee 1: demo@example.com / PIN 1234
-- Employee 2: employee2@demo.com / PIN 1234

INSERT INTO tenants (
  tenant_id,
  name,
  legal_name,
  status,
  onboarding_status
)
VALUES (
  'demo',
  'Demo',
  'Demo Private Limited',
  'active',
  'active'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  legal_name = VALUES(legal_name),
  status = VALUES(status),
  onboarding_status = VALUES(onboarding_status);

INSERT INTO offices (
  tenant_id,
  office_code,
  name,
  office_type,
  parent_office_id,
  status,
  contact_email,
  timezone,
  country,
  settings_json
)
SELECT
  'demo',
  'MAIN-DEMO',
  'Demo Main Office',
  'main_office',
  NULL,
  'active',
  'owner@demo.com',
  'Asia/Kolkata',
  'India',
  JSON_OBJECT('login_identifier_preference', 'email')
WHERE NOT EXISTS (
  SELECT 1
  FROM offices
  WHERE tenant_id = 'demo'
    AND office_code = 'MAIN-DEMO'
    AND deleted_at IS NULL
);

INSERT INTO offices (
  tenant_id,
  office_code,
  name,
  office_type,
  parent_office_id,
  status,
  contact_email,
  timezone,
  country,
  settings_json
)
SELECT
  'demo',
  'BR-DEMO1',
  'Demo Bangalore Branch',
  'branch',
  parent.id,
  'active',
  'branch-admin@demo.com',
  'Asia/Kolkata',
  'India',
  JSON_OBJECT('login_identifier_preference', 'email')
FROM offices parent
WHERE parent.tenant_id = 'demo'
  AND parent.office_code = 'MAIN-DEMO'
  AND parent.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM offices child
    WHERE child.tenant_id = 'demo'
      AND child.office_code = 'BR-DEMO1'
      AND child.deleted_at IS NULL
  )
LIMIT 1;

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
  'demo',
  NULL,
  NULL,
  'Demo',
  'Owner',
  'Demo Owner',
  'owner@demo.com',
  '+919900000001',
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
 AND u.email = 'owner@demo.com'
 AND u.deleted_at IS NULL
SET t.primary_owner_user_id = u.id
WHERE t.tenant_id = 'demo';

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
SELECT
  'demo',
  branch.id,
  NULL,
  'Branch',
  'Admin',
  'Demo Branch Admin',
  'branch-admin@demo.com',
  '+919900000002',
  '$2y$10$hvmcDkJos4v4DlwaaWKNsO.KA/GOynotQE4QA1/mKJauYhixJ1qAO',
  NULL,
  'branch_admin',
  'active',
  CURRENT_TIMESTAMP
FROM offices branch
WHERE branch.tenant_id = 'demo'
  AND branch.office_code = 'BR-DEMO1'
  AND branch.deleted_at IS NULL
LIMIT 1
ON DUPLICATE KEY UPDATE
  office_id = VALUES(office_id),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  display_name = VALUES(display_name),
  phone = VALUES(phone),
  password_hash = VALUES(password_hash),
  user_type = VALUES(user_type),
  status = VALUES(status),
  email_verified_at = VALUES(email_verified_at),
  updated_at = CURRENT_TIMESTAMP;

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
SELECT
  'demo',
  branch.id,
  'DEMO-EMP-001',
  'Demo',
  'User',
  'Demo User',
  'demo@example.com',
  '+919900000011',
  NULL,
  '$2y$10$LpzslBFvILBpvsIaVg2T0OXmTq.BaK96Gf88Uc2GItgMKgi/blole',
  'employee',
  'active',
  CURRENT_TIMESTAMP
FROM offices branch
WHERE branch.tenant_id = 'demo'
  AND branch.office_code = 'BR-DEMO1'
  AND branch.deleted_at IS NULL
LIMIT 1
ON DUPLICATE KEY UPDATE
  office_id = VALUES(office_id),
  employee_id = VALUES(employee_id),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  display_name = VALUES(display_name),
  phone = VALUES(phone),
  pin_hash = VALUES(pin_hash),
  user_type = VALUES(user_type),
  status = VALUES(status),
  email_verified_at = VALUES(email_verified_at),
  updated_at = CURRENT_TIMESTAMP;

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
SELECT
  'demo',
  branch.id,
  'DEMO-EMP-002',
  'Second',
  'Employee',
  'Second Employee',
  'employee2@demo.com',
  '+919900000012',
  NULL,
  '$2y$10$LpzslBFvILBpvsIaVg2T0OXmTq.BaK96Gf88Uc2GItgMKgi/blole',
  'employee',
  'active',
  CURRENT_TIMESTAMP
FROM offices branch
WHERE branch.tenant_id = 'demo'
  AND branch.office_code = 'BR-DEMO1'
  AND branch.deleted_at IS NULL
LIMIT 1
ON DUPLICATE KEY UPDATE
  office_id = VALUES(office_id),
  employee_id = VALUES(employee_id),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  display_name = VALUES(display_name),
  phone = VALUES(phone),
  pin_hash = VALUES(pin_hash),
  user_type = VALUES(user_type),
  status = VALUES(status),
  email_verified_at = VALUES(email_verified_at),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_roles (
  tenant_id,
  user_id,
  role_id,
  office_id,
  assigned_by_user_id
)
SELECT
  'demo',
  u.id,
  r.id,
  NULL,
  owner.id
FROM users u
JOIN roles r
  ON r.role_key = 'tenant_owner'
JOIN users owner
  ON owner.tenant_id = 'demo'
 AND owner.email = 'owner@demo.com'
 AND owner.deleted_at IS NULL
WHERE u.tenant_id = 'demo'
  AND u.email = 'owner@demo.com'
  AND u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.tenant_id = 'demo'
      AND ur.user_id = u.id
      AND ur.role_id = r.id
      AND ur.office_id IS NULL
  )
LIMIT 1;

INSERT INTO user_roles (
  tenant_id,
  user_id,
  role_id,
  office_id,
  assigned_by_user_id
)
SELECT
  'demo',
  admin.id,
  r.id,
  branch.id,
  owner.id
FROM users admin
JOIN roles r
  ON r.role_key = 'branch_admin'
JOIN offices branch
  ON branch.tenant_id = 'demo'
 AND branch.office_code = 'BR-DEMO1'
 AND branch.deleted_at IS NULL
JOIN users owner
  ON owner.tenant_id = 'demo'
 AND owner.email = 'owner@demo.com'
 AND owner.deleted_at IS NULL
WHERE admin.tenant_id = 'demo'
  AND admin.email = 'branch-admin@demo.com'
  AND admin.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.tenant_id = 'demo'
      AND ur.user_id = admin.id
      AND ur.role_id = r.id
      AND ur.office_id = branch.id
  )
LIMIT 1;

INSERT INTO user_roles (
  tenant_id,
  user_id,
  role_id,
  office_id,
  assigned_by_user_id
)
SELECT
  'demo',
  employee.id,
  r.id,
  NULL,
  owner.id
FROM users employee
JOIN roles r
  ON r.role_key = 'employee'
JOIN users owner
  ON owner.tenant_id = 'demo'
 AND owner.email = 'owner@demo.com'
 AND owner.deleted_at IS NULL
WHERE employee.tenant_id = 'demo'
  AND employee.email IN ('demo@example.com', 'employee2@demo.com')
  AND employee.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.tenant_id = 'demo'
      AND ur.user_id = employee.id
      AND ur.role_id = r.id
      AND ur.office_id IS NULL
  );

INSERT INTO tenant_plans (
  tenant_id,
  office_id,
  plan_id,
  status,
  starts_on,
  assigned_by_user_id,
  notes
)
SELECT
  'demo',
  office_seed.office_id,
  office_seed.plan_id,
  'active',
  CURDATE(),
  owner.id,
  office_seed.notes
FROM (
  SELECT
    main.id AS office_id,
    starter.id AS plan_id,
    'Demo main office starter plan' AS notes
  FROM offices main
  JOIN plans starter
    ON starter.plan_code = 'starter'
  WHERE main.tenant_id = 'demo'
    AND main.office_code = 'MAIN-DEMO'
    AND main.deleted_at IS NULL

  UNION ALL

  SELECT
    branch.id AS office_id,
    growth.id AS plan_id,
    'Demo branch growth plan' AS notes
  FROM offices branch
  JOIN plans growth
    ON growth.plan_code = 'growth'
  WHERE branch.tenant_id = 'demo'
    AND branch.office_code = 'BR-DEMO1'
    AND branch.deleted_at IS NULL
) AS office_seed
JOIN users owner
  ON owner.tenant_id = 'demo'
 AND owner.email = 'owner@demo.com'
 AND owner.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant_plans tp
  WHERE tp.tenant_id = 'demo'
    AND tp.office_id = office_seed.office_id
    AND tp.status = 'active'
);

COMMIT;
