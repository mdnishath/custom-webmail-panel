-- ============================================================
-- Mail Server Database Schema
-- Supports: Virtual domains, users, aliases, DKIM, quotas
-- ============================================================

-- Virtual Domains
CREATE TABLE IF NOT EXISTS `virtual_domains` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL UNIQUE,
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `max_accounts` INT UNSIGNED DEFAULT 100,
    `max_quota_mb` INT UNSIGNED DEFAULT 10240,
    `dkim_private_key` TEXT,
    `dkim_public_key` TEXT,
    `dkim_selector` VARCHAR(63) DEFAULT 'mail',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Virtual Users (Email Accounts)
CREATE TABLE IF NOT EXISTS `virtual_users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `domain_id` INT UNSIGNED NOT NULL,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `quota_mb` INT UNSIGNED DEFAULT 1024,
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `full_name` VARCHAR(255) DEFAULT '',
    `send_limit_per_hour` INT UNSIGNED DEFAULT 100,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`domain_id`) REFERENCES `virtual_domains`(`id`) ON DELETE CASCADE,
    INDEX `idx_domain` (`domain_id`),
    INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Virtual Aliases (Forwarding)
CREATE TABLE IF NOT EXISTS `virtual_aliases` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `domain_id` INT UNSIGNED NOT NULL,
    `source` VARCHAR(255) NOT NULL,
    `destination` VARCHAR(255) NOT NULL,
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`domain_id`) REFERENCES `virtual_domains`(`id`) ON DELETE CASCADE,
    INDEX `idx_domain` (`domain_id`),
    UNIQUE KEY `unique_alias` (`source`, `destination`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin Users (Panel Login)
CREATE TABLE IF NOT EXISTS `admin_users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(100) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `role` ENUM('superadmin', 'admin', 'domain_admin') DEFAULT 'admin',
    `managed_domains` TEXT,
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `last_login` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Mail Logs
CREATE TABLE IF NOT EXISTS `mail_logs` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `sender` VARCHAR(255),
    `recipient` VARCHAR(255),
    `subject` VARCHAR(500),
    `status` ENUM('sent', 'received', 'bounced', 'rejected', 'deferred') DEFAULT 'sent',
    `message_id` VARCHAR(255),
    `size_bytes` INT UNSIGNED DEFAULT 0,
    INDEX `idx_timestamp` (`timestamp`),
    INDEX `idx_sender` (`sender`),
    INDEX `idx_recipient` (`recipient`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- DNS Records Reference
CREATE TABLE IF NOT EXISTS `dns_records` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `domain_id` INT UNSIGNED NOT NULL,
    `record_type` ENUM('MX', 'SPF', 'DKIM', 'DMARC', 'A', 'CNAME') NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `value` TEXT NOT NULL,
    `priority` INT DEFAULT 0,
    `is_configured` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`domain_id`) REFERENCES `virtual_domains`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default admin (password will be set on first login)
INSERT INTO `admin_users` (`username`, `password`, `email`, `role`)
VALUES ('admin', '$2b$12$placeholder_will_be_set_on_first_login', 'admin@localhost', 'superadmin')
ON DUPLICATE KEY UPDATE `username`=`username`;
