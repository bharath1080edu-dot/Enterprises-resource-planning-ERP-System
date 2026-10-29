const db = require('../config/db');

// ── GET /api/payments ─────────────────────────────────────
exports.getAll = async (req, res) => {
    try {
        if (req.user?.role === 'Manager') {
            return res.json({ success: true, data: [] });
        }
        const [rows] = await db.query(`
            SELECT p.*, o.customer_name, o.product_type, o.order_amount,
                   u.name as received_by_name
            FROM payments p
            LEFT JOIN orders o ON p.order_id = o.id
            LEFT JOIN users u ON p.received_by = u.id
            ORDER BY p.payment_date DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/payments ────────────────────────────────────
exports.create = async (req, res) => {
    try {
        const { order_id, payment_type, amount, payment_method, payment_date, notes } = req.body;
        if (!amount || !payment_date)
            return res.status(400).json({ success: false, message: 'Amount and payment date are required.' });

        const [result] = await db.query(
            'INSERT INTO payments (order_id, payment_type, amount, payment_method, payment_date, received_by, notes) VALUES (?,?,?,?,?,?,?)',
            [order_id || null, payment_type || 'Partial', amount, payment_method || 'Cash', payment_date, req.user?.id || null, notes]
        );

        // Update advance_paid on order
        if (order_id) {
            await db.query(
                'UPDATE orders SET advance_paid = advance_paid + ? WHERE id = ?',
                [amount, order_id]
            );
        }

        res.status(201).json({ success: true, message: 'Payment recorded.', id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/payments/pending ─────────────────────────────
exports.getPending = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, customer_name, contact, product_type, order_amount, advance_paid,
                   (order_amount - advance_paid) as remaining_balance, delivery_date, status
            FROM orders
            WHERE order_amount > advance_paid AND status NOT IN ('Cancelled')
            ORDER BY remaining_balance DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/payments/expenses ────────────────────────────
exports.getExpenses = async (req, res) => {
    try {
        if (req.user?.role === 'Manager') {
            return res.json({ success: true, data: [] });
        }
        const [rows] = await db.query('SELECT * FROM expenses ORDER BY expense_date DESC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/payments/expenses ───────────────────────────
exports.createExpense = async (req, res) => {
    try {
        const { category, description, amount, vendor, expense_date, payment_method } = req.body;
        if (!amount || !expense_date)
            return res.status(400).json({ success: false, message: 'Amount and date are required.' });

        const [result] = await db.query(
            'INSERT INTO expenses (category, description, amount, vendor, expense_date, payment_method, approved_by) VALUES (?,?,?,?,?,?,?)',
            [category, description, amount, vendor, expense_date, payment_method || 'Cash', req.user?.id || null]
        );
        res.status(201).json({ success: true, message: 'Expense recorded.', id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── DELETE /api/payments/expenses/:id ────────────────────
exports.deleteExpense = async (req, res) => {
    try {
        await db.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Expense deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/payments/summary ─────────────────────────────
exports.getSummary = async (req, res) => {
    try {
        if (req.user?.role === 'Manager') {
            return res.json({ success: true, data: { revenue: 0, expenses: 0, profit: 0 } });
        }
        const { month, year } = req.query;
        const m = month || (new Date().getMonth() + 1);
        const y = year || new Date().getFullYear();

        const [[rev]] = await db.query(
            "SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE MONTH(payment_date)=? AND YEAR(payment_date)=?",
            [m, y]
        );
        const [[exp]] = await db.query(
            "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE MONTH(expense_date)=? AND YEAR(expense_date)=?",
            [m, y]
        );

        res.json({
            success: true,
            data: {
                revenue: parseFloat(rev.total) || 0,
                expenses: parseFloat(exp.total) || 0,
                profit: (parseFloat(rev.total) || 0) - (parseFloat(exp.total) || 0)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
