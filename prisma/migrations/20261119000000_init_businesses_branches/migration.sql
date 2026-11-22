CREATE TABLE `businesses` (
    `id` CHAR(36) NOT NULL,
    `business_name` VARCHAR(255) NOT NULL,
    `legal_name` VARCHAR(255) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(255) NULL,
    `GSTIN` VARCHAR(15) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `branches` (
    `id` CHAR(36) NOT NULL,
    `business_id` CHAR(36) NOT NULL,
    `branch_code` VARCHAR(50) NOT NULL,
    `branch_name` VARCHAR(255) NOT NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(20) NULL,
    `GSTIN` VARCHAR(15) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `branches_business_id_idx`(`business_id`),
    UNIQUE INDEX `branches_business_id_branch_code_key`(`business_id`, `branch_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `branches` ADD CONSTRAINT `branches_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
