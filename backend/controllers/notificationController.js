const db = require('../config/db');

// Notification types visible to Employee role only
const EMPLOYEE_ALLOWED_TYPES = ['Low Stock', 'Employee Absent', 'Production Alert', 'General'];

// ── GET /api/notifications ────────────────────────────────
exports.getAll = async (req, res) => {
    try {
        const role = req.user?.role;
        const isEmployee = role === 'Employee';

        let query, countQuery;
        let params = [];

        if (isEmployee) {
            // Build a parameterised IN clause for allowed types
            const placeholders = EMPLOYEE_ALLOWED_TYPES.map(() => '?').join(', ');
            query      = `SELECT * FROM notifications WHERE type IN (${placeholders}) ORDER BY created_at DESC LIMIT 50`;
            countQuery = `SELECT COUNT(*) as count FROM notifications WHERE is_read=0 AND type IN (${placeholders})`;
            params     = EMPLOYEE_ALLOWED_TYPES;
        } else {
            query      = 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50';
            countQuery = 'SELECT COUNT(*) as count FROM notifications WHERE is_read=0';
        }

        const [rows]          = await db.query(query, params);
        const [[{ count }]]   = await db.query(countQuery, params);
        res.json({ success: true, data: rows, unread_count: count });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PATCH /api/notifications/:id/read ────────────────────
exports.markRead = async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read=1 WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'Marked as read.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PATCH /api/notifications/read-all ────────────────────
exports.markAllRead = async (req, res) => {
    try {
        const isEmployee = req.user?.role === 'Employee';
        if (isEmployee) {
            const placeholders = EMPLOYEE_ALLOWED_TYPES.map(() => '?').join(', ');
            await db.query(`UPDATE notifications SET is_read=1 WHERE type IN (${placeholders})`, EMPLOYEE_ALLOWED_TYPES);
        } else {
            await db.query('UPDATE notifications SET is_read=1');
        }
        res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── DELETE /api/notifications/:id ────────────────────────
exports.remove = async (req, res) => {
    try {
        await db.query('DELETE FROM notifications WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'Notification deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
