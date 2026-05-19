-- Worknest employee phone-login and workbook-import migration
-- Apply after 001-006.

ALTER TABLE users
  ADD COLUMN employee_pin VARCHAR(32) NULL DEFAULT NULL AFTER password_hash,
  ADD COLUMN employment_type VARCHAR(120) NULL DEFAULT NULL AFTER employee_pin,
  ADD COLUMN date_of_joining DATE NULL DEFAULT NULL AFTER employment_type,
  ADD COLUMN uan VARCHAR(64) NULL DEFAULT NULL AFTER date_of_joining,
  ADD COLUMN bank_name VARCHAR(180) NULL DEFAULT NULL AFTER uan,
  ADD COLUMN bank_account_number VARCHAR(80) NULL DEFAULT NULL AFTER bank_name,
  ADD COLUMN ifsc VARCHAR(32) NULL DEFAULT NULL AFTER bank_account_number,
  ADD COLUMN designation VARCHAR(180) NULL DEFAULT NULL AFTER ifsc,
  ADD COLUMN basic_rate DECIMAL(12,2) NULL DEFAULT NULL AFTER designation;

ALTER TABLE users
  ADD UNIQUE KEY uq_users_tenant_phone (tenant_id, phone);

-- Legacy employee PIN hashes are intentionally not backfilled.
-- After this migration, employee login reads users.employee_pin only.
-- Existing employee rows should receive a fresh PIN reset before phone login is used live.

-- Workbook import contract:
-- 1. XLSX uploads must contain exactly named sheets: Employees, Payroll.
-- 2. Employees sheet updates only when employee_id and phone both match an existing employee.
-- 3. Duplicate phone numbers in the workbook or tenant fail the whole upload.
-- 4. Payroll sheet follows the payroll-variation-sample.csv column contract.
