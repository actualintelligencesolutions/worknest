CREATE TABLE IF NOT EXISTS plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(255) NULL DEFAULT NULL,
  price_cents INT UNSIGNED NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  employee_limit INT UNSIGNED NULL DEFAULT NULL,
  monthly_payroll_limit INT UNSIGNED NULL DEFAULT NULL,
  features_json JSON NULL DEFAULT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plans_plan_code (plan_code),
  KEY idx_plans_status (status),
  KEY idx_plans_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  office_code VARCHAR(80) NOT NULL,
  name VARCHAR(180) NOT NULL,
  office_type ENUM('main_office', 'branch') NOT NULL,
  parent_office_id BIGINT UNSIGNED NULL DEFAULT NULL,
  status ENUM('pending_setup', 'active', 'suspended', 'disabled') NOT NULL DEFAULT 'pending_setup',
  contact_email VARCHAR(255) NULL DEFAULT NULL,
  contact_phone VARCHAR(32) NULL DEFAULT NULL,
  address_line_1 VARCHAR(255) NULL DEFAULT NULL,
  address_line_2 VARCHAR(255) NULL DEFAULT NULL,
  city VARCHAR(120) NULL DEFAULT NULL,
  state VARCHAR(120) NULL DEFAULT NULL,
  postal_code VARCHAR(32) NULL DEFAULT NULL,
  country VARCHAR(120) NULL DEFAULT NULL,
  timezone VARCHAR(64) NULL DEFAULT NULL,
  payroll_day TINYINT UNSIGNED NULL DEFAULT NULL,
  settings_json JSON NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_offices_tenant_code (tenant_id, office_code),
  UNIQUE KEY uq_offices_tenant_type_name (tenant_id, office_type, name, deleted_at),
  KEY idx_offices_parent_office_id (parent_office_id),
  KEY idx_offices_tenant_id (tenant_id),
  KEY idx_offices_status (status),
  KEY idx_offices_deleted_at (deleted_at),
  CONSTRAINT fk_offices_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_offices_parent
    FOREIGN KEY (parent_office_id) REFERENCES offices (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
  ADD CONSTRAINT fk_users_office
    FOREIGN KEY (office_id) REFERENCES offices (id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS tenant_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  office_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active', 'scheduled', 'expired', 'cancelled') NOT NULL DEFAULT 'active',
  starts_on DATE NOT NULL,
  ends_on DATE NULL DEFAULT NULL,
  assigned_by_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  notes VARCHAR(255) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tenant_plans_tenant_office (tenant_id, office_id),
  KEY idx_tenant_plans_status (status),
  CONSTRAINT fk_tenant_plans_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tenant_plans_office
    FOREIGN KEY (office_id) REFERENCES offices (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tenant_plans_plan
    FOREIGN KEY (plan_id) REFERENCES plans (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tenant_plans_assigned_by
    FOREIGN KEY (assigned_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
