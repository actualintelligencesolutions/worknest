-- Worknest API v2 hardening updates
-- Apply after 001-005 when adopting the v2 API contract.

ALTER TABLE users
  ADD KEY idx_users_tenant_phone (tenant_id, phone),
  ADD KEY idx_users_tenant_user_type_status (tenant_id, user_type, status);

ALTER TABLE tenant_plans
  ADD KEY idx_tenant_plans_office_starts_on (office_id, starts_on);

ALTER TABLE payroll_batches
  ADD KEY idx_payroll_batches_office_period (tenant_id, office_id, period_year, period_month, upload_status);

ALTER TABLE payslips
  ADD KEY idx_payslips_office_period_status (tenant_id, office_id, period_year, period_month, status);

-- Application-level rules in v2:
-- 1. Employees must have at least one login identifier: email or phone.
-- 2. Employee login uses email or phone plus PIN.
-- 3. Published payroll batches are immutable. Corrections require a new batch.
-- 4. Republished periods supersede older published payslips for the same office and period.
