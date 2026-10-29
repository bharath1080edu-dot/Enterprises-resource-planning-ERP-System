const db = require('../config/db');

// ── GET /api/employees ────────────────────────────────────
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM employees ORDER BY name ASC');
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getAll employees error:', err.message);
        res.status(500).json({ success: false, message: 'Server error fetching employees.' });
    }
};

// ── POST /api/employees ───────────────────────────────────
exports.create = async (req, res) => {
    try {       
        const {
            name, role, department, salary,
            shift, phone, email, address, joining_date
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Employee name is required.' });
        }

        const [result] = await db.query(
            `INSERT INTO employees
               (name, role, department, salary, shift, phone, email, address, joining_date)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [
                name.trim(),
                role || null,
                department || null,
                salary !== '' && salary != null ? Number(salary) : 0,
                shift || 'Morning',
                phone || null,
                email || null,
                address || null,
                joining_date || null,
            ]
        );
        res.status(201).json({ success: true, message: 'Employee added successfully.', id: result.insertId });
    } catch (err) {
        console.error('create employee error:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Server error creating employee.' });
    }
};

// ── PUT /api/employees/:id ────────────────────────────────
exports.update = async (req, res) => {
    try {
        const {
            name, role, department, salary,
            shift, phone, email, address, joining_date, status
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Employee name is required.' });
        }

        await db.query(
            `UPDATE employees
             SET name=?, role=?, department=?, salary=?, shift=?,
                 phone=?, email=?, address=?, joining_date=?, status=?
             WHERE id=?`,
            [
                name.trim(),
                role || null,
                department || null,
                salary !== '' && salary != null ? Number(salary) : 0,
                shift || 'Morning',
                phone || null,
                email || null,
                address || null,
                joining_date || null,
                status || 'Active',
                req.params.id,
            ]
        );
        res.json({ success: true, message: 'Employee updated successfully.' });
    } catch (err) {
        console.error('update employee error:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Server error updating employee.' });
    }
};

// ── DELETE /api/employees/:id ─────────────────────────────
exports.remove = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }
        res.json({ success: true, message: 'Employee deleted.' });
    } catch (err) {
        console.error('delete employee error:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Server error deleting employee.' });
    }
};
