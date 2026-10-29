const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { protect } = require('../middleware/auth');

// Optional: you can add `protect` here if you want it authenticated
// router.use(protect);

// Auto-initialize the table on first hit if it doesn't exist
const initializeTable = async () => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value JSON NOT NULL
        )
    `);
};

// GET a specific setting by key
router.get('/:key', async (req, res) => {
    try {
        await initializeTable();
        const [rows] = await db.query('SELECT setting_value FROM settings WHERE setting_key = ?', [req.params.key]);
        if (rows.length > 0) {
            return res.json({ success: true, data: rows[0].setting_value });
        }
        
        // Return default values if not found in db
        const defaults = {
            'inventory_categories': ['Profiles', 'Glass', 'Hardware', 'Accessories', 'Steel', 'Chemicals', 'Other'],
            'inventory_units': ['meters', 'sq.ft', 'pieces', 'units', 'pairs', 'tubes', 'kg', 'liters'],
            'payment_methods': ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'],
            'payment_types': ['Advance', 'Partial', 'Full', 'Refund'],
            'expense_categories': ['Electricity', 'Transport', 'Maintenance', 'Raw Material', 'Salaries', 'Rent', 'Tools', 'Other'],
            'order_columns': ['Product Type', 'Width (ft)', 'Height (ft)', 'Qty', 'Color / Finish', 'Glass Type', 'Notes'],
            'employee_roles': ['Production Manager', 'Machine Operator', 'Welder', 'Quality Inspector', 'Accountant', 'Installation Tech', 'Supervisor', 'Helper', 'Driver', 'Other'],
            'employee_departments': ['Production', 'Quality', 'Finance', 'Installation', 'Administration', 'Maintenance'],
            'employee_shifts': ['Morning', 'Evening', 'Night', 'Flexible'],
            'whatsapp_templates': {
                new_order: "*🏭 UPVC Factory — Order Confirmed!*\n━━━━━━━━━━━━━━━━━━━━\n🎉 Dear *{customerName}*, your order has been placed!\n\n📦 *Order ID:* #{orderId}\n🪟 *Product:* {productType}\n💰 *Order Amount:* ₹{orderAmount}\n✅ *Advance Paid:* ₹{advancePaid}\n⏳ *Balance Due:* ₹{balanceDue}\n📅 *Expected Delivery:* {deliveryDate}\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Thank you for choosing Image Creator UPVC!_",
                status_in_production: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n🔧 Your Order *#{orderId}* is now in *In Production*!\n\nOur team has started working on your order!\n📅 *Expected Delivery:* {deliveryDate}\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
                status_completed: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n🎉 Your Order *#{orderId}* is now *Completed*!\n\nYour order is ready! We will contact you soon for dispatch.\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
                status_delivered: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n🚚 Your Order *#{orderId}* has been *Delivered*!\n\nThank you for your business!\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
                status_cancelled: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n❌ Your Order *#{orderId}* has been *Cancelled*.\n\nWe're sorry for any inconvenience caused.\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
                production_stage: "*🏭 UPVC Factory — Production Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n📋 *Order #{orderId}* update:\n🔧 *Stage:* {stage}\n📊 *Status:* {status}\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
                payment_reminder: "*🏭 UPVC Factory — Payment Reminder*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\nThis is a friendly reminder regarding your Order *#{orderId}*.\n\n💰 *Total Amount:* ₹{orderAmount}\n✅ *Advance Paid:* ₹{advancePaid}\n⏳ *Balance Due:* *₹{balanceDue}*\n\nPlease arrange for the payment at your earliest convenience.\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
                delivery_reminder: "*🏭 UPVC Factory — Delivery Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\nThis is an update regarding the delivery of your Order *#{orderId}*.\n\n📅 *Expected Delivery:* *{deliveryDate}*\n🪟 *Product:* {productType}\n\nOur team is working hard to ensure timely delivery!\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_"
            }
        };

        const defaultVal = defaults[req.params.key] || [];
        return res.json({ success: true, data: defaultVal });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// PUT to update a specific setting
router.put('/:key', async (req, res) => {
    try {
        await initializeTable();
        const { value } = req.body;
        if (!Array.isArray(value) && (typeof value !== 'object' || value === null)) {
            return res.status(400).json({ success: false, message: 'Value must be an array or object' });
        }

        await db.query(
            'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [req.params.key, JSON.stringify(value), JSON.stringify(value)]
        );

        res.json({ success: true, message: 'Setting updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;
