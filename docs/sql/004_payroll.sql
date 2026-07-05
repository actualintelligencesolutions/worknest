CREATE TABLE IF NOT EXISTS payroll_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  office_id BIGINT UNSIGNED NOT NULL,
  period_year SMALLINT UNSIGNED NOT NULL,
  period_month TINYINT UNSIGNED NOT NULL,
  source_file_name VARCHAR(255) NOT NULL,
  source_file_path VARCHAR(500) NOT NULL,
  source_file_hash VARCHAR(64) NOT NULL,
  mapping_json JSON NULL DEFAULT NULL,
  validation_summary_json JSON NULL DEFAULT NULL,
  upload_status ENUM('uploaded', 'mapped', 'validated', 'confirmed', 'processed', 'published', 'failed') NOT NULL DEFAULT 'uploaded',
  uploaded_by_user_id BIGINT UNSIGNED NOT NULL,
  confirmed_by_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  published_by_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP NULL DEFAULT NULL,
  published_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_batches_active_period (tenant_id, office_id, period_year, period_month, deleted_at),
  KEY idx_payroll_batches_uploaded_by (uploaded_by_user_id),
  KEY idx_payroll_batches_status (upload_status),
  CONSTRAINT fk_payroll_batches_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payroll_batches_office
    FOREIGN KEY (office_id) REFERENCES offices (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payroll_batches_uploaded_by
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_payroll_batches_confirmed_by
    FOREIGN KEY (confirmed_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_payroll_batches_published_by
    FOREIGN KEY (published_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  office_id BIGINT UNSIGNED NOT NULL,
  payroll_batch_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  employee_id VARCHAR(80) NOT NULL,
  employee_name_snapshot VARCHAR(180) NOT NULL,
  designation_snapshot VARCHAR(180) NULL DEFAULT NULL,
  days_paid VARCHAR(32) NULL DEFAULT NULL,
  ot_hours VARCHAR(32) NULL DEFAULT NULL,
  gross_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  earnings_json JSON NOT NULL,
  deductions_json JSON NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  record_status ENUM('valid', 'flagged', 'published') NOT NULL DEFAULT 'valid',
  validation_errors_json JSON NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_records_batch_user (payroll_batch_id, user_id),
  KEY idx_payroll_records_tenant_office (tenant_id, office_id),
  CONSTRAINT fk_payroll_records_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payroll_records_office
    FOREIGN KEY (office_id) REFERENCES offices (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payroll_records_batch
    FOREIGN KEY (payroll_batch_id) REFERENCES payroll_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payroll_records_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payslips (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(80) NOT NULL,
  office_id BIGINT UNSIGNED NOT NULL,
  payroll_record_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  period_year SMALLINT UNSIGNED NOT NULL,
  period_month TINYINT UNSIGNED NOT NULL,
  file_path VARCHAR(500) NULL DEFAULT NULL,
  file_format ENUM('pdf', 'html') NOT NULL DEFAULT 'pdf',
  generated_at TIMESTAMP NULL DEFAULT NULL,
  published_at TIMESTAMP NULL DEFAULT NULL,
  status ENUM('generated', 'published', 'superseded') NOT NULL DEFAULT 'generated',
  download_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payslips_record (payroll_record_id),
  KEY idx_payslips_user_period (user_id, period_year, period_month),
  CONSTRAINT fk_payslips_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payslips_office
    FOREIGN KEY (office_id) REFERENCES offices (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payslips_record
    FOREIGN KEY (payroll_record_id) REFERENCES payroll_records (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payslips_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
