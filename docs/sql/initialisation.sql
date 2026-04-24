CREATE TABLE IF NOT EXISTS tenants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  config_version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenants_tenant_id (tenant_id),
  KEY idx_tenants_tenant_id (tenant_id),
  KEY idx_tenants_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS folders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  parent_folder_id BIGINT UNSIGNED NULL DEFAULT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_folders_tenant_parent_slug (tenant_id, parent_folder_id, slug),
  KEY idx_folders_tenant_id (tenant_id),
  KEY idx_folders_parent_folder_id (parent_folder_id),
  KEY idx_folders_deleted_at (deleted_at),
  CONSTRAINT fk_folders_parent_folder
    FOREIGN KEY (parent_folder_id) REFERENCES folders (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description TEXT NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_collections_tenant_slug (tenant_id, slug),
  KEY idx_collections_tenant_id (tenant_id),
  KEY idx_collections_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  folder_id BIGINT UNSIGNED NULL DEFAULT NULL,
  collection_id BIGINT UNSIGNED NULL DEFAULT NULL,
  parent_asset_id BIGINT UNSIGNED NULL DEFAULT NULL,
  original_filename VARCHAR(255) NOT NULL,
  generated_filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  storage_type VARCHAR(40) NOT NULL DEFAULT 'local',
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NULL DEFAULT NULL,
  alt_text VARCHAR(255) NULL DEFAULT NULL,
  description TEXT NULL DEFAULT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assets_generated_filename (generated_filename),
  KEY idx_assets_tenant_id (tenant_id),
  KEY idx_assets_folder_id (folder_id),
  KEY idx_assets_collection_id (collection_id),
  KEY idx_assets_parent_asset_id (parent_asset_id),
  KEY idx_assets_deleted_at (deleted_at),
  CONSTRAINT fk_assets_folder
    FOREIGN KEY (folder_id) REFERENCES folders (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_assets_collection
    FOREIGN KEY (collection_id) REFERENCES collections (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_assets_parent_asset
    FOREIGN KEY (parent_asset_id) REFERENCES assets (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tags_tenant_slug (tenant_id, slug),
  KEY idx_tags_tenant_id (tenant_id),
  KEY idx_tags_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asset_tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  asset_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_asset_tags_asset_tag (asset_id, tag_id),
  KEY idx_asset_tags_tenant_id (tenant_id),
  KEY idx_asset_tags_asset_id (asset_id),
  KEY idx_asset_tags_tag_id (tag_id),
  KEY idx_asset_tags_deleted_at (deleted_at),
  CONSTRAINT fk_asset_tags_asset
    FOREIGN KEY (asset_id) REFERENCES assets (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_asset_tags_tag
    FOREIGN KEY (tag_id) REFERENCES tags (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tenants (tenant_id, name)
VALUES ('default', 'Default Tenant')
ON DUPLICATE KEY UPDATE name = VALUES(name);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NULL DEFAULT NULL,
  password_hash VARCHAR(255) NULL DEFAULT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'hr_admin',
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_tenant_email (tenant_id, email),
  KEY idx_users_tenant_id (tenant_id),
  KEY idx_users_role (role),
  KEY idx_users_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  plan_code VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  price_cents INT UNSIGNED NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  description TEXT NULL DEFAULT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plans_code (plan_code),
  KEY idx_plans_tenant_id (tenant_id),
  KEY idx_plans_status (status),
  KEY idx_plans_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO plans (tenant_id, plan_code, name, price_cents, currency, description, status)
VALUES ('default', 'free', 'Free', 0, 'INR', 'Getting started with payroll organization.', 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  price_cents = VALUES(price_cents),
  currency = VALUES(currency),
  description = VALUES(description),
  status = VALUES(status);

CREATE TABLE IF NOT EXISTS tenant_plan_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_tenant_plan_subscriptions_tenant_id (tenant_id),
  KEY idx_tenant_plan_subscriptions_plan_id (plan_id),
  KEY idx_tenant_plan_subscriptions_deleted_at (deleted_at),
  CONSTRAINT fk_tenant_plan_subscriptions_plan
    FOREIGN KEY (plan_id) REFERENCES plans (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  employee_code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(255) NULL DEFAULT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employee_profiles_tenant_code (tenant_id, employee_code),
  KEY idx_employee_profiles_tenant_id (tenant_id),
  KEY idx_employee_profiles_phone (phone),
  KEY idx_employee_profiles_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_otp_challenges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  otp_code VARCHAR(12) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_employee_otp_challenges_tenant_id (tenant_id),
  KEY idx_employee_otp_challenges_phone (phone),
  KEY idx_employee_otp_challenges_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_periods (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  period_month TINYINT UNSIGNED NOT NULL,
  period_year SMALLINT UNSIGNED NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_periods_tenant_month_year (tenant_id, period_month, period_year),
  KEY idx_payroll_periods_tenant_id (tenant_id),
  KEY idx_payroll_periods_status (status),
  KEY idx_payroll_periods_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_imports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  payroll_period_id BIGINT UNSIGNED NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'uploaded',
  mapping_json JSON NULL DEFAULT NULL,
  validation_summary_json JSON NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_payroll_imports_tenant_id (tenant_id),
  KEY idx_payroll_imports_period_id (payroll_period_id),
  KEY idx_payroll_imports_status (status),
  KEY idx_payroll_imports_deleted_at (deleted_at),
  CONSTRAINT fk_payroll_imports_period
    FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_import_rows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  payroll_import_id BIGINT UNSIGNED NOT NULL,
  row_number INT UNSIGNED NOT NULL,
  raw_json JSON NOT NULL,
  normalized_json JSON NULL DEFAULT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  errors_json JSON NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_payroll_import_rows_tenant_id (tenant_id),
  KEY idx_payroll_import_rows_import_id (payroll_import_id),
  KEY idx_payroll_import_rows_status (status),
  KEY idx_payroll_import_rows_deleted_at (deleted_at),
  CONSTRAINT fk_payroll_import_rows_import
    FOREIGN KEY (payroll_import_id) REFERENCES payroll_imports (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_mapping_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  mapping_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_payroll_mapping_templates_tenant_id (tenant_id),
  KEY idx_payroll_mapping_templates_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payslip_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  payroll_period_id BIGINT UNSIGNED NOT NULL,
  employee_profile_id BIGINT UNSIGNED NOT NULL,
  employee_code VARCHAR(80) NOT NULL,
  employee_name VARCHAR(160) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  gross_pay DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_pay DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  earnings_json JSON NULL DEFAULT NULL,
  deductions_json JSON NULL DEFAULT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payslip_records_period_employee (payroll_period_id, employee_profile_id),
  KEY idx_payslip_records_tenant_id (tenant_id),
  KEY idx_payslip_records_employee_id (employee_profile_id),
  KEY idx_payslip_records_deleted_at (deleted_at),
  CONSTRAINT fk_payslip_records_period
    FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payslip_records_employee
    FOREIGN KEY (employee_profile_id) REFERENCES employee_profiles (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payslip_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  payslip_record_id BIGINT UNSIGNED NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  file_hash VARCHAR(128) NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payslip_files_record_version (payslip_record_id, version),
  KEY idx_payslip_files_tenant_id (tenant_id),
  KEY idx_payslip_files_deleted_at (deleted_at),
  CONSTRAINT fk_payslip_files_record
    FOREIGN KEY (payslip_record_id) REFERENCES payslip_records (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
