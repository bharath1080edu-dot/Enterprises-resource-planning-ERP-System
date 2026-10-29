const db = require('../config/db');

// ── GET /api/dashboard/stats ──────────────────────────────
exports.getStats = async (req, res) => {
    try {
        const [[orders]]      = await db.query("SELECT COUNT(*) as total FROM orders");
        const [[pending]]     = await db.query("SELECT COUNT(*) as total FROM orders WHERE status = 'Pending'");
        const [[inProd]]      = await db.query("SELECT COUNT(*) as total FROM orders WHERE status = 'In Production'");
        const [[completed]]   = await db.query("SELECT COUNT(*) as total FROM orders WHERE status IN ('Completed','Delivered')");
        const [[lowStock]]    = await db.query("SELECT COUNT(*) as total FROM inventory WHERE quantity <= low_stock_threshold");
        const [[employees]]   = await db.query("SELECT COUNT(*) as total FROM employees WHERE status = 'Active'");
        const [[revenue]]     = await db.query("SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE MONTH(payment_date)=MONTH(CURDATE()) AND YEAR(payment_date)=YEAR(CURDATE())");
        const [[expenses]]    = await db.query("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE MONTH(expense_date)=MONTH(CURDATE()) AND YEAR(expense_date)=YEAR(CURDATE())");
        const [[pendingPay]]  = await db.query("SELECT COALESCE(SUM(order_amount - advance_paid),0) as total FROM orders WHERE status NOT IN ('Delivered','Cancelled')");
        const [[todayPresent]]= await db.query("SELECT COUNT(*) as total FROM attendance WHERE date=CURDATE() AND status IN ('Present','Late')");

        const isManager = req.user?.role === 'Manager';
        const monthlyRevenue  = isManager ? 0 : (parseFloat(revenue.total) || 0);
        const monthlyExpenses = isManager ? 0 : (parseFloat(expenses.total) || 0);

        res.json({
            success: true,
            data: {
                totalOrders:     orders.total,
                pendingOrders:   pending.total,
                inProduction:    inProd.total,
                completedOrders: completed.total,
                lowStockItems:   lowStock.total,
                activeEmployees: employees.total,
                monthlyRevenue,
                monthlyExpenses,
                profitLoss:      isManager ? 0 : (monthlyRevenue - monthlyExpenses),
                pendingPayments: parseFloat(pendingPay.total) || 0,
                todayAttendance: todayPresent.total,
            }
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/dashboard/sales-trend ───────────────────────
exports.getSalesTrend = async (req, res) => {
    try {
        if (req.user?.role === 'Manager') {
            return res.json({ success: true, data: [] });
        }
        const [rows] = await db.query(`
            SELECT DATE_FORMAT(payment_date,'%b %Y') as month,
                   SUM(amount) as revenue
            FROM payments
            WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY YEAR(payment_date), MONTH(payment_date)
            ORDER BY payment_date ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/dashboard/production-trend ──────────────────
exports.getProductionTrend = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT DATE_FORMAT(created_at,'%b %Y') as month,
                   COUNT(*) as orders
            FROM orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY YEAR(created_at), MONTH(created_at)
            ORDER BY created_at ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/dashboard/inventory-usage ───────────────────
exports.getInventoryUsage = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT category, SUM(quantity) as total_qty, SUM(cost*quantity) as total_value
            FROM inventory
            GROUP BY category
            ORDER BY total_value DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/dashboard/attendance-summary ────────────────
exports.getAttendanceSummary = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT status, COUNT(*) as count
            FROM attendance
            WHERE date = CURDATE()
            GROUP BY status
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/dashboard/recent-orders ─────────────────────
exports.getRecentOrders = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, customer_name, product_type, order_amount, status, delivery_date, created_at
            FROM orders ORDER BY created_at DESC LIMIT 5
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
