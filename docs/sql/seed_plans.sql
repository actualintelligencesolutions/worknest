INSERT INTO plans (
  plan_code,
  name,
  description,
  price_cents,
  currency,
  employee_limit,
  monthly_payroll_limit,
  features_json,
  status
)
VALUES
  (
    'starter',
    'Starter',
    'Core setup for a small office.',
    0,
    'INR',
    25,
    1,
    JSON_ARRAY('branch_workspace', 'employee_records', 'payroll_import', 'payslip_generation'),
    'active'
  ),
  (
    'growth',
    'Growth',
    'For expanding branch teams with more employees.',
    499900,
    'INR',
    100,
    3,
    JSON_ARRAY('multi_admin', 'employee_records', 'payroll_import', 'payslip_generation'),
    'active'
  ),
  (
    'enterprise',
    'Enterprise',
    'For multi-branch operations.',
    1499900,
    'INR',
    1000,
    12,
    JSON_ARRAY('multi_branch', 'multi_admin', 'payroll_import', 'payslip_generation', 'audit_logs'),
    'active'
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  price_cents = VALUES(price_cents),
  currency = VALUES(currency),
  employee_limit = VALUES(employee_limit),
  monthly_payroll_limit = VALUES(monthly_payroll_limit),
  features_json = VALUES(features_json),
  status = VALUES(status);
