-- =========================================================
-- MIGRATION: Add Quotations Table
-- Run once against the live upvc_erp database
-- =========================================================
USE upvc_erp;

CREATE TABLE IF NOT EXISTS quotations (
    id               INT PRIMARY KEY AUTO_INCREMENT,
    customer_name    VARCHAR(150) NOT NULL,
    contact          VARCHAR(20)  NOT NULL,
    email            VARCHAR(100),
    address          TEXT,
    product_type     VARCHAR(100),
    items            JSON,          -- array of { type, width, height, qty, color, glass, notes }
    total_area       DECIMAL(10,2),
    estimated_amount DECIMAL(10,2),
    message          TEXT,
    source           VARCHAR(50)   DEFAULT 'Website',
    status           ENUM('New', 'Contacted', 'Converted', 'Rejected') DEFAULT 'New',
    staff_notes      TEXT,
    converted_order_id INT NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (converted_order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created ON quotations(created_at);

SELECT 'quotations table created successfully' AS result;
