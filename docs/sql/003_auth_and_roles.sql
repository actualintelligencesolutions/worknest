CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_key VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  scope_type ENUM('tenant', 'office', 'self') NOT NULL,
  permissions_json JSON NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_role_key (role_key),
  KEY idx_roles_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  office_id BIGINT UNSIGNED NULL DEFAULT NULL,
  assigned_by_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_roles_unique_scope (tenant_id, user_id, role_id, office_id),
  KEY idx_user_roles_user (user_id),
  KEY idx_user_roles_office (office_id),
  CONSTRAINT fk_user_roles_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role
    FOREIGN KEY (role_id) REFERENCES roles (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_office
    FOREIGN KEY (office_id) REFERENCES offices (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_assigned_by
    FOREIGN KEY (assigned_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  session_type ENUM('web', 'employee_portal') NOT NULL DEFAULT 'web',
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  ip_address VARCHAR(64) NULL DEFAULT NULL,
  user_agent VARCHAR(500) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_auth_sessions_tenant_user (tenant_id, user_id),
  KEY idx_auth_sessions_token_hash (token_hash),
  KEY idx_auth_sessions_expires_at (expires_at),
  CONSTRAINT fk_auth_sessions_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS otp_challenges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  office_id BIGINT UNSIGNED NULL DEFAULT NULL,
  channel ENUM('email', 'sms') NOT NULL,
  purpose ENUM('admin_verification', 'passwordless_login', 'pin_reset') NOT NULL,
  destination VARCHAR(255) NOT NULL,
  otp_code_hash VARCHAR(255) NOT NULL,
  status ENUM('pending', 'verified', 'expired', 'failed') NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_otp_challenges_tenant_user (tenant_id, user_id),
  KEY idx_otp_challenges_status (status),
  CONSTRAINT fk_otp_challenges_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_otp_challenges_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_otp_challenges_office
    FOREIGN KEY (office_id) REFERENCES offices (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
