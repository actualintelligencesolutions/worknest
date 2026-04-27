-- WARNING: This permanently removes Worknest application data from the
-- currently selected database. Run only against a local/dev database.
--
-- Usage:
--   mysql -h 127.0.0.1 -u root -p template_database < docs/sql/truncate_worknest_tables.sql

SET @previous_foreign_key_checks = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

DROP PROCEDURE IF EXISTS truncate_if_exists;

DELIMITER //

CREATE PROCEDURE truncate_if_exists(IN p_table_name VARCHAR(128))
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
  ) THEN
    SET @truncate_sql = CONCAT('TRUNCATE TABLE `', REPLACE(p_table_name, '`', '``'), '`');
    PREPARE truncate_statement FROM @truncate_sql;
    EXECUTE truncate_statement;
    DEALLOCATE PREPARE truncate_statement;
  END IF;
END//

DELIMITER ;

CALL truncate_if_exists('payslip_files');
CALL truncate_if_exists('payslip_records');
CALL truncate_if_exists('payroll_import_rows');
CALL truncate_if_exists('payroll_imports');
CALL truncate_if_exists('payroll_mapping_templates');
CALL truncate_if_exists('payroll_periods');
CALL truncate_if_exists('employee_otp_challenges');
CALL truncate_if_exists('employee_profiles');
CALL truncate_if_exists('company_locations');
CALL truncate_if_exists('onboarding_steps');
CALL truncate_if_exists('onboarding_flows');
CALL truncate_if_exists('user_verification_challenges');
CALL truncate_if_exists('users');
CALL truncate_if_exists('tenants');
CALL truncate_if_exists('plans');

DROP PROCEDURE IF EXISTS truncate_if_exists;

SET FOREIGN_KEY_CHECKS = @previous_foreign_key_checks;

INSERT INTO tenants (
  tenant_id,
  name,
  legal_name,
  status,
  onboarding_status
)
VALUES (
  'default',
  'Default Tenant',
  'Default Tenant',
  'active',
  'not_started'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  legal_name = VALUES(legal_name),
  status = VALUES(status),
  onboarding_status = VALUES(onboarding_status);

INSERT INTO plans (
  plan_code,
  name,
  price_cents,
  currency,
  description,
  status
)
VALUES
  ('starter', 'Starter', 0, 'INR', 'Basic setup for a small office.', 'active'),
  ('growth', 'Growth', 499900, 'INR', 'Expanded setup for growing teams.', 'active'),
  ('enterprise', 'Enterprise', 1499900, 'INR', 'Advanced setup for multi-location companies.', 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  price_cents = VALUES(price_cents),
  currency = VALUES(currency),
  description = VALUES(description),
  status = VALUES(status);
