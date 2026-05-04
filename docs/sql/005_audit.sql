CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  office_id BIGINT UNSIGNED NULL DEFAULT NULL,
  actor_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  actor_type ENUM('system', 'user') NOT NULL DEFAULT 'user',
  event_type VARCHAR(120) NOT NULL,
  entity_type VARCHAR(120) NOT NULL,
  entity_id VARCHAR(120) NOT NULL,
  metadata_json JSON NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_tenant_event (tenant_id, event_type),
  KEY idx_audit_logs_actor_user (actor_user_id),
  CONSTRAINT fk_audit_logs_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_audit_logs_office
    FOREIGN KEY (office_id) REFERENCES offices (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_audit_logs_actor_user
    FOREIGN KEY (actor_user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
