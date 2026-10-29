const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

const signToken = (user) => jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
);

// ── POST /api/auth/register ──────────────────────────────
exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ success: false, message: 'Name, email and password are required.' });

        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0)
            return res.status(409).json({ success: false, message: 'Email already registered.' });

        const hashed = await bcrypt.hash(password, 10);
        const userRole = ['Admin', 'Manager', 'Employee'].includes(role) ? role : 'Employee';
        const [result] = await db.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashed, userRole]
        );

        const token = signToken({ id: result.insertId, name, email, role: userRole });
        res.status(201).json({ success: true, message: 'Registered successfully.', token, user: { id: result.insertId, name, email, role: userRole } });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/auth/login ──────────────────────────────────
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email and password are required.' });

        const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
        if (rows.length === 0)
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });

        const token = signToken(user);
        res.json({
            success: true,
            message: 'Login successful.',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/auth/me ──────────────────────────────────────
exports.getMe = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0)
            return res.status(404).json({ success: false, message: 'User not found.' });
        res.json({ success: true, user: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};