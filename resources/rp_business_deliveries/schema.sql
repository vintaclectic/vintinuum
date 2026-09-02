CREATE TABLE IF NOT EXISTS rp_business_reputation (
  identifier VARCHAR(96) NOT NULL,
  business_id VARCHAR(64) NOT NULL,
  reputation INT NOT NULL DEFAULT 0,
  loyalty INT NOT NULL DEFAULT 0,
  deliveries INT NOT NULL DEFAULT 0,
  protections INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (identifier, business_id)
);

CREATE TABLE IF NOT EXISTS rp_business_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contract_id VARCHAR(128) NOT NULL,
  identifier VARCHAR(96) NOT NULL,
  business_id VARCHAR(64) NOT NULL,
  kind ENUM('delivery', 'protection') NOT NULL,
  status ENUM('completed', 'protected', 'expired', 'dropped') NOT NULL,
  payout INT NOT NULL DEFAULT 0,
  reputation_delta INT NOT NULL DEFAULT 0,
  loyalty_delta INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_business_runs_identifier_created (identifier, created_at),
  KEY idx_business_runs_business_created (business_id, created_at)
);
