const db = require('./config/db');

const initialSettings = {
    'inventory_categories': ['Profiles', 'Glass', 'Hardware', 'Accessories', 'Steel', 'Chemicals', 'Other'],
    'inventory_units': ['meters', 'sq.ft', 'pieces', 'units', 'pairs', 'tubes', 'kg', 'liters'],
    'payment_methods': ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'],
    'payment_types': ['Advance', 'Partial', 'Full', 'Refund'],
    'expense_categories': ['Electricity', 'Transport', 'Maintenance', 'Raw Material', 'Salaries', 'Rent', 'Tools', 'Other'],
    'employee_roles': ['Production Manager', 'Machine Operator', 'Welder', 'Quality Inspector', 'Accountant', 'Installation Tech', 'Supervisor', 'Helper', 'Driver', 'Other'],
    'employee_departments': ['Production', 'Quality', 'Finance', 'Installation', 'Administration', 'Maintenance'],
    'employee_shifts': ['Morning', 'Evening', 'Night', 'Flexible']
};

async function run() {
    try {
        console.log("Creating settings table...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value JSON NOT NULL
            )
        `);

        console.log("Seeding initial settings...");
        for (const [key, value] of Object.entries(initialSettings)) {
            await db.query(
                `INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`,
                [key, JSON.stringify(value)]
            );
        }

        console.log("✅ Settings migration completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err.message);
        process.exit(1);
    }
}

run();
