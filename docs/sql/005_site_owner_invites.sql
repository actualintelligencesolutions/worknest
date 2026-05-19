CREATE TABLE IF NOT EXISTS site_owner_invites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  office_id BIGINT UNSIGNED NOT NULL,
  invited_email VARCHAR(255) NOT NULL,
  invited_name VARCHAR(180) NULL DEFAULT NULL,
  invited_role VARCHAR(80) NOT NULL DEFAULT 'site_owner',
  token_hash CHAR(64) NOT NULL,
  status ENUM('pending', 'accepted', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
  invited_by_user_id BIGINT UNSIGNED NOT NULL,
  accepted_by_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  accepted_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_site_owner_invites_token_hash (token_hash),
  KEY idx_site_owner_invites_tenant_office (tenant_id, office_id),
  KEY idx_site_owner_invites_email (tenant_id, invited_email),
  KEY idx_site_owner_invites_status (status),
  CONSTRAINT fk_site_owner_invites_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_site_owner_invites_office
    FOREIGN KEY (office_id) REFERENCES offices (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_site_owner_invites_invited_by
    FOREIGN KEY (invited_by_user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_site_owner_invites_accepted_by
    FOREIGN KEY (accepted_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
