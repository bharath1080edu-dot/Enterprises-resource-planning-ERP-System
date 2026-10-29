-- =========================================================
-- IMAGE CREATOR UPVC PRODUCTS & INTERIORS
-- ERP System - Complete Database Schema
-- =========================================================
-- ⚠️  Safe to re-import: drops and recreates the database

DROP DATABASE IF EXISTS upvc_erp;
CREATE DATABASE upvc_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE upvc_erp;

-- ---------------------------------------------------------
-- 1. USERS (Authentication)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'Manager', 'Employee') DEFAULT 'Employee',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 2. SUPPLIERS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    contact VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    gst_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 3. INVENTORY
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
    id INT PRIMARY KEY AUTO_INCREMENT,
    material_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    quantity DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(50),
    supplier_id INT,
    cost DECIMAL(10,2) DEFAULT 0,
    low_stock_threshold DECIMAL(10,2) DEFAULT 10,
    date_added DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- 4. STOCK HISTORY
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inventory_id INT NOT NULL,
    change_type ENUM('Added', 'Used', 'Adjusted', 'Removed') NOT NULL,
    quantity_changed DECIMAL(10,2) NOT NULL,
    notes TEXT,
    changed_by INT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- 5. ORDERS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_name VARCHAR(150) NOT NULL,
    contact VARCHAR(20),
    product_type VARCHAR(100),
    size VARCHAR(100),
    quantity INT DEFAULT 1,
    delivery_date DATE,
    order_amount DECIMAL(10,2) DEFAULT 0,
    advance_paid DECIMAL(10,2) DEFAULT 0,
    status ENUM('Pending', 'In Production', 'Completed', 'Delivered', 'Cancelled') DEFAULT 'Pending',
    notes TEXT,
    assigned_to INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- 6. PRODUCTION
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS production (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    stage ENUM('Cutting', 'Welding', 'Assembly', 'Quality Check', 'Packing') NOT NULL,
    status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
    worker_assigned VARCHAR(100),
    machine_used VARCHAR(100),
    start_time TIMESTAMP NULL,
    end_time TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- 7. EMPLOYEES
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100),
    department VARCHAR(100),
    salary DECIMAL(10,2) DEFAULT 0,
    shift ENUM('Morning', 'Evening', 'Night', 'Flexible') DEFAULT 'Morning',
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    joining_date DATE,
    status ENUM('Active', 'Inactive', 'On Leave') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- 8. ATTENDANCE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status ENUM('Present', 'Absent', 'Late', 'Half Day', 'Leave') DEFAULT 'Present',
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attendance (employee_id, date),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- 9. PAYMENTS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT,
    payment_type ENUM('Advance', 'Partial', 'Full', 'Refund') DEFAULT 'Partial',
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card') DEFAULT 'Cash',
    payment_date DATE NOT NULL,
    received_by INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- 10. EXPENSES
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category VARCHAR(100),
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    vendor VARCHAR(150),
    expense_date DATE NOT NULL,
    payment_method ENUM('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card') DEFAULT 'Cash',
    approved_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- 11. NOTIFICATIONS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type ENUM('Low Stock', 'Delayed Order', 'Pending Payment', 'Employee Absent', 'General') NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_id INT,
    related_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- INDEXES  (IF NOT EXISTS = safe to run multiple times)
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery     ON orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date     ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category  ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_payments_order      ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read  ON notifications(is_read);

-- =========================================================
-- SAMPLE SEED DATA
-- =========================================================

-- Users (password = Admin@123)
INSERT INTO users (name, email, password, role) VALUES 
('Admin User',  'admin@imagecreator.com',  '$2a$10$w69Mfk9j62wSUGIrTwd8WOjuouArkWmWyIKfvi8vLg3XO0hkYfEWi', 'Admin'),
('Rajesh Kumar','manager@imagecreator.com','$2a$10$w69Mfk9j62wSUGIrTwd8WOjuouArkWmWyIKfvi8vLg3XO0hkYfEWi', 'Manager'),
('Suresh Babu', 'employee@imagecreator.com','$2a$10$w69Mfk9j62wSUGIrTwd8WOjuouArkWmWyIKfvi8vLg3XO0hkYfEWi', 'Employee');

-- Suppliers
INSERT INTO suppliers (name, contact, email, address, gst_number) VALUES
('UPVC World Pvt Ltd',  '9876543210', 'info@upvcworld.com',    'Industrial Area, Bangalore',   '29ABC1234D1Z5'),
('Fenesta Profiles',    '9876543211', 'sales@fenesta.com',     'Electronic City, Bangalore',   '29DEF5678G2H6'),
('Deceuninck India',    '9876543212', 'india@deceuninck.com',  'Whitefield, Bangalore',        '29GHI9012K3L7');

-- Inventory
INSERT INTO inventory (material_name, category, quantity, unit, supplier_id, cost, low_stock_threshold, date_added) VALUES
('UPVC White Profiles',   'Profiles',     500, 'meters',  1, 85.00, 50,  CURDATE()),
('UPVC Brown Profiles',   'Profiles',     200, 'meters',  1, 90.00, 30,  CURDATE()),
('Glass 4mm Clear',       'Glass',        150, 'sq.ft',   2, 45.00, 20,  CURDATE()),
('Glass 5mm Tinted',      'Glass',         80, 'sq.ft',   2, 55.00, 15,  CURDATE()),
('Rubber Gasket',         'Accessories', 1000, 'meters',  3, 12.00, 100, CURDATE()),
('Steel Reinforcement',   'Steel',        300, 'pieces',  1, 35.00, 40,  CURDATE()),
('Window Handles',        'Hardware',     200, 'units',   3, 120.00,25,  CURDATE()),
('Hinges (Pair)',          'Hardware',     150, 'pairs',   3, 80.00, 20,  CURDATE()),
('Mosquito Net',          'Accessories',  100, 'sq.ft',   2, 25.00, 15,  CURDATE()),
('Silicon Sealant',       'Chemicals',      8, 'tubes',   3, 95.00, 10,  CURDATE());

-- Employees
INSERT INTO employees (name, role, department, salary, shift, phone, joining_date, status) VALUES
('Rajesh Kumar',  'Production Manager',  'Production',   35000, 'Morning',  '9845012345', '2023-01-15', 'Active'),
('Suresh Babu',   'Machine Operator',    'Production',   22000, 'Morning',  '9845012346', '2023-03-01', 'Active'),
('Mahesh Gowda',  'Welder',              'Production',   20000, 'Morning',  '9845012347', '2023-03-15', 'Active'),
('Priya Sharma',  'Quality Inspector',   'Quality',      25000, 'Morning',  '9845012348', '2023-04-01', 'Active'),
('Anitha R',      'Accountant',          'Finance',      28000, 'Morning',  '9845012349', '2023-02-01', 'Active'),
('Vikram S',      'Installation Tech',   'Installation', 21000, 'Flexible', '9845012350', '2023-05-01', 'Active');

-- Orders
INSERT INTO orders (customer_name, contact, product_type, size, quantity, delivery_date, order_amount, advance_paid, status) VALUES
('Mr. Ramesh Nair',  '9812345670', 'Sliding Window',  '4x3 feet',   6, DATE_ADD(CURDATE(), INTERVAL 7 DAY),  45000, 15000, 'In Production'),
('Mrs. Sunitha Rao', '9812345671', 'Casement Window', '3x4 feet',   4, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 32000, 10000, 'Pending'),
('Mr. Arun Kumar',   '9812345672', 'UPVC Door',       '7x3.5 feet', 2, DATE_ADD(CURDATE(), INTERVAL -2 DAY), 28000, 28000, 'Completed'),
('Ms. Deepa V',      '9812345673', 'French Window',   '5x4 feet',   3, DATE_ADD(CURDATE(), INTERVAL 10 DAY), 38000, 10000, 'In Production'),
('Mr. Ganesh P',     '9812345674', 'Fixed Window',    '2x2 feet',   8, DATE_ADD(CURDATE(), INTERVAL 3 DAY),  22000,  5000, 'Pending');

-- Production stages for Order 1
INSERT INTO production (order_id, stage, status, worker_assigned, machine_used, start_time, end_time) VALUES
(1, 'Cutting',       'Completed',   'Suresh Babu',  'CNC Cutter M1',        DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
(1, 'Welding',       'Completed',   'Mahesh Gowda', 'Welding Machine W1',   DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
(1, 'Assembly',      'In Progress', 'Rajesh Kumar', 'Assembly Table A1',    DATE_SUB(NOW(), INTERVAL 1 DAY), NULL),
(1, 'Quality Check', 'Pending',     'Priya Sharma', NULL,                   NULL, NULL),
(1, 'Packing',       'Pending',     NULL,           NULL,                   NULL, NULL);

-- Production stages for Order 4
INSERT INTO production (order_id, stage, status, worker_assigned, machine_used) VALUES
(4, 'Cutting',       'Completed',   'Suresh Babu',  'CNC Cutter M1'),
(4, 'Welding',       'In Progress', 'Mahesh Gowda', 'Welding Machine W1'),
(4, 'Assembly',      'Pending',     NULL, NULL),
(4, 'Quality Check', 'Pending',     NULL, NULL),
(4, 'Packing',       'Pending',     NULL, NULL);

-- Payments
INSERT INTO payments (order_id, payment_type, amount, payment_method, payment_date) VALUES
(1, 'Advance', 15000, 'UPI',           CURDATE()),
(2, 'Advance', 10000, 'Cash',          CURDATE()),
(3, 'Full',    28000, 'Bank Transfer', DATE_SUB(CURDATE(), INTERVAL 2 DAY)),
(4, 'Advance', 10000, 'Cash',          CURDATE()),
(5, 'Advance',  5000, 'UPI',           CURDATE());

-- Expenses
INSERT INTO expenses (category, description, amount, vendor, expense_date) VALUES
('Electricity',  'Monthly factory electricity bill',  8500,   'BESCOM',           DATE_SUB(CURDATE(), INTERVAL 5 DAY)),
('Transport',    'Material delivery charges',          2500,   'Local Transport',  DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
('Maintenance',  'Machine servicing charges',          5000,   'Tech Services',    DATE_SUB(CURDATE(), INTERVAL 7 DAY)),
('Salaries',     'Monthly salaries - June',           151000,  'Internal',         DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
('Raw Material', 'UPVC profiles purchase',            42500,   'UPVC World',       DATE_SUB(CURDATE(), INTERVAL 4 DAY));

-- Notifications
INSERT INTO notifications (type, message, is_read, related_id, related_type) VALUES
('Low Stock',       'Silicon Sealant is critically low (8 tubes remaining)',   FALSE, 10, 'inventory'),
('Delayed Order',   'Order #5 for Mr. Ganesh P is due in 3 days',             FALSE,  5, 'orders'),
('Pending Payment', 'Order #1 has pending balance of ₹30,000',                FALSE,  1, 'orders'),
('Pending Payment', 'Order #2 has pending balance of ₹22,000',                FALSE,  2, 'orders'),
('Low Stock',       'Mosquito Net stock is below threshold (100 sq.ft left)',  FALSE,  9, 'inventory');

-- Attendance for today (sample)
INSERT INTO attendance (employee_id, date, check_in, check_out, status, overtime_hours) VALUES
(1, CURDATE(), '08:55:00', '18:10:00', 'Present', 1.17),
(2, CURDATE(), '09:02:00', '18:00:00', 'Present', 0),
(3, CURDATE(), '09:30:00', '18:00:00', 'Late',    0),
(4, CURDATE(), '08:50:00', '18:00:00', 'Present', 0),
(5, CURDATE(), NULL,       NULL,       'Absent',  0),
(6, CURDATE(), '09:00:00', '18:30:00', 'Present', 0.5);
