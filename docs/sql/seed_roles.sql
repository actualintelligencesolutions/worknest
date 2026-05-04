INSERT INTO roles (
  role_key,
  name,
  scope_type,
  permissions_json,
  status
)
VALUES
  (
    'tenant_owner',
    'Tenant Owner',
    'tenant',
    JSON_ARRAY(
      'tenant.manage',
      'office.read',
      'office.write',
      'plan.assign',
      'user.read',
      'user.write',
      'payroll.read',
      'payroll.write',
      'payslip.read'
    ),
    'active'
  ),
  (
    'branch_admin',
    'Branch Admin',
    'office',
    JSON_ARRAY(
      'office.read',
      'user.read',
      'user.write',
      'payroll.read',
      'payroll.write',
      'payslip.read'
    ),
    'active'
  ),
  (
    'employee',
    'Employee',
    'self',
    JSON_ARRAY(
      'self.read',
      'payslip.read'
    ),
    'active'
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  scope_type = VALUES(scope_type),
  permissions_json = VALUES(permissions_json),
  status = VALUES(status);
