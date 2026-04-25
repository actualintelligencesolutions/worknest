CREATE TABLE IF NOT EXISTS tenants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  name VARCHAR(180) NOT NULL,
  legal_name VARCHAR(220) NULL DEFAULT NULL,
  status ENUM('pending_verification', 'active', 'suspended', 'disabled') NOT NULL DEFAULT 'pending_verification',
  onboarding_status ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started',
  primary_admin_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenants_tenant_id (tenant_id),
  KEY idx_tenants_status (status),
  KEY idx_tenants_onboarding_status (onboarding_status),
  KEY idx_tenants_primary_admin_user_id (primary_admin_user_id),
  KEY idx_tenants_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NULL DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner', 'hr_admin', 'hr_staff', 'employee') NOT NULL DEFAULT 'hr_admin',
  status ENUM('pending_verification', 'active', 'suspended', 'disabled') NOT NULL DEFAULT 'pending_verification',
  email_verified_at TIMESTAMP NULL DEFAULT NULL,
  phone_verified_at TIMESTAMP NULL DEFAULT NULL,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_tenant_email (tenant_id, email),
  UNIQUE KEY uq_users_tenant_phone (tenant_id, phone),
  KEY idx_users_tenant_id (tenant_id),
  KEY idx_users_role (role),
  KEY idx_users_status (status),
  KEY idx_users_deleted_at (deleted_at),
  CONSTRAINT fk_users_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_verification_challenges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  channel ENUM('email', 'phone') NOT NULL DEFAULT 'phone',
  destination VARCHAR(255) NOT NULL,
  otp_code VARCHAR(12) NOT NULL,
  status ENUM('pending', 'verified', 'expired', 'failed') NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP NULL DEFAULT NULL,
  last_attempt_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_user_verification_tenant_user (tenant_id, user_id),
  KEY idx_user_verification_destination (destination),
  KEY idx_user_verification_status (status),
  KEY idx_user_verification_expires_at (expires_at),
  KEY idx_user_verification_deleted_at (deleted_at),
  CONSTRAINT fk_user_verification_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_verification_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS onboarding_flows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started',
  current_step VARCHAR(80) NOT NULL DEFAULT 'company_profile',
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_onboarding_flows_tenant (tenant_id),
  KEY idx_onboarding_flows_status (status),
  KEY idx_onboarding_flows_current_step (current_step),
  KEY idx_onboarding_flows_deleted_at (deleted_at),
  CONSTRAINT fk_onboarding_flows_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS onboarding_steps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  step_key VARCHAR(80) NOT NULL,
  status ENUM('pending', 'completed', 'skipped') NOT NULL DEFAULT 'pending',
  data JSON NULL DEFAULT NULL,
  completed_by_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_onboarding_steps_tenant_step (tenant_id, step_key),
  KEY idx_onboarding_steps_status (status),
  KEY idx_onboarding_steps_completed_by_user_id (completed_by_user_id),
  KEY idx_onboarding_steps_deleted_at (deleted_at),
  CONSTRAINT fk_onboarding_steps_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_onboarding_steps_user
    FOREIGN KEY (completed_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
