const db = require('../config/db');

// ── GET /api/reports/sales ────────────────────────────────
// Returns payments filtered by date range (used by Sales Report)
exports.getSalesReport = async (req, res) => {
    try {
        const { from, to } = req.query;
        const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate   = to   || new Date().toISOString().split('T')[0];

        const [rows] = await db.query(`
            SELECT p.id, p.amount, p.payment_type, p.payment_method, p.payment_date, p.notes,
                   o.customer_name
            FROM payments p
            LEFT JOIN orders o ON p.order_id = o.id
            WHERE p.payment_date BETWEEN ? AND ?
            ORDER BY p.payment_date DESC
        `, [fromDate, toDate]);

        const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
        res.json({ success: true, data: rows, summary: { total, count: rows.length } });
    } catch (err) {
        console.error('Reports - sales error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/reports/inventory ────────────────────────────
// Returns full inventory stock list with low-stock flag
exports.getInventoryReport = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, material_name, category, quantity, unit, cost,
                   (quantity * cost) AS total_value,
                   low_stock_threshold,
                   (quantity <= low_stock_threshold) AS is_low_stock
            FROM inventory
            ORDER BY category, material_name
        `);

        const totalValue = rows.reduce((sum, r) => sum + Number(r.total_value), 0);
        const lowStockCount = rows.filter(r => r.is_low_stock).length;
        res.json({ success: true, data: rows, summary: { totalValue, lowStockCount, totalItems: rows.length } });
    } catch (err) {
        console.error('Reports - inventory error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/reports/attendance ───────────────────────────
// Returns attendance records for a date range with full status breakdown
exports.getAttendanceReport = async (req, res) => {
    try {
        const { from, to, employee_id } = req.query;
        const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate   = to   || new Date().toISOString().split('T')[0];

        let query = `
            SELECT a.id, a.date, a.check_in, a.check_out, a.status, a.overtime_hours, a.notes,
                   e.id AS employee_id, e.name AS employee_name, e.role, e.department, e.phone
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            WHERE a.date BETWEEN ? AND ?
        `;
        const params = [fromDate, toDate];

        if (employee_id && employee_id !== 'all') { query += ' AND a.employee_id = ?'; params.push(employee_id); }
        query += ' ORDER BY a.date DESC, e.name';

        const [rows] = await db.query(query, params);

        const present = rows.filter(r => r.status === 'Present').length;
        const absent  = rows.filter(r => r.status === 'Absent').length;
        const late    = rows.filter(r => r.status === 'Late').length;
        const halfDay = rows.filter(r => r.status === 'Half Day').length;
        const leave   = rows.filter(r => r.status === 'Leave').length;
        const others  = rows.filter(r => !['Present', 'Absent', 'Late', 'Half Day', 'Leave'].includes(r.status)).length;
        const totalOvertime = rows.reduce((s, r) => s + (Number(r.overtime_hours) || 0), 0);

        res.json({
            success: true,
            data: rows,
            summary: {
                present,
                absent,
                late,
                halfDay,
                leave,
                others,
                totalOvertime,
                total: rows.length
            }
        });
    } catch (err) {
        console.error('Reports - attendance error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/reports/production ───────────────────────────
// Returns all production orders with stage and completion percentage
exports.getProductionReport = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.order_id, p.current_stage, p.completion,
                   o.customer_name, o.product_type, o.status, o.delivery_date, o.created_at
            FROM production p
            JOIN orders o ON p.order_id = o.id
            ORDER BY p.completion DESC, o.delivery_date ASC
        `);

        const avgCompletion = rows.length > 0
            ? Math.round(rows.reduce((s, r) => s + Number(r.completion), 0) / rows.length)
            : 0;
        res.json({ success: true, data: rows, summary: { total: rows.length, avgCompletion } });
    } catch (err) {
        console.error('Reports - production error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/reports/profit ───────────────────────────────
// Returns summarized revenue vs expenses for Profit/Loss report
exports.getProfitReport = async (req, res) => {
    try {
        const { from, to } = req.query;
        const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const toDate   = to   || new Date().toISOString().split('T')[0];

        const [[revRow]] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE payment_date BETWEEN ? AND ?`,
            [fromDate, toDate]
        );
        const [[expRow]] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE expense_date BETWEEN ? AND ?`,
            [fromDate, toDate]
        );

        // Monthly breakdown
        const [monthly] = await db.query(`
            SELECT DATE_FORMAT(payment_date, '%b %Y') AS month,
                   YEAR(payment_date) AS yr, MONTH(payment_date) AS mo,
                   SUM(amount) AS revenue
            FROM payments
            WHERE payment_date BETWEEN ? AND ?
            GROUP BY YEAR(payment_date), MONTH(payment_date)
            ORDER BY yr, mo
        `, [fromDate, toDate]);

        const revenue  = parseFloat(revRow.total) || 0;
        const expenses = parseFloat(expRow.total) || 0;
        res.json({
            success: true,
            data: monthly,
            summary: { revenue, expenses, profit: revenue - expenses }
        });
    } catch (err) {
        console.error('Reports - profit error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
