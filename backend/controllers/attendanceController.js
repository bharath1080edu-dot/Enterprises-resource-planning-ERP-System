const db = require('../config/db');
const { sendAttendanceNotification } = require('../services/whatsappService');

// ── GET /api/attendance ───────────────────────────────────
exports.getAll = async (req, res) => {
    try {
        const { date } = req.query;
        const filterDate = date || new Date().toISOString().split('T')[0];
        const isEmployee = req.user.role === 'Employee';

        let rows, unmarked = [];

        if (isEmployee) {
            // Employee sees ONLY their own attendance record
            [rows] = await db.query(`
                SELECT a.*, e.name as employee_name, e.role, e.shift
                FROM attendance a
                JOIN employees e ON a.employee_id = e.id
                WHERE a.date = ? AND e.user_id = ?
                ORDER BY e.name
            `, [filterDate, req.user.id]);
            // Employees cannot mark attendance, so unmarked list is empty
        } else {
            // Admin / Manager: see all employees
            [rows] = await db.query(`
                SELECT a.*, e.name as employee_name, e.role, e.shift
                FROM attendance a
                JOIN employees e ON a.employee_id = e.id
                WHERE a.date = ?
                ORDER BY e.name
            `, [filterDate]);

            const [allEmployees] = await db.query('SELECT id, name, role, shift FROM employees WHERE status = "Active"');
            const markedIds = rows.map(r => r.employee_id);
            unmarked = allEmployees.filter(e => !markedIds.includes(e.id));
        }

        res.json({ success: true, data: rows, unmarked, date: filterDate, selfView: isEmployee });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/attendance ──────────────────────────────────
exports.markAttendance = async (req, res) => {
    try {
        const { employee_id, date, check_in, check_out, status, overtime_hours, notes } = req.body;
        if (!employee_id) return res.status(400).json({ success: false, message: 'Employee ID is required.' });

        const attendanceDate = date || new Date().toISOString().split('T')[0];
        const finalStatus = status || 'Present';

        await db.query(`
            INSERT INTO attendance (employee_id, date, check_in, check_out, status, overtime_hours, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE check_in=VALUES(check_in), check_out=VALUES(check_out),
                status=VALUES(status), overtime_hours=VALUES(overtime_hours), notes=VALUES(notes)
        `, [employee_id, attendanceDate, check_in || null, check_out || null, finalStatus, overtime_hours || 0, notes]);

        // Fetch employee name + phone for notification
        const [[emp]] = await db.query('SELECT name, phone FROM employees WHERE id=?', [employee_id]);

        // Add in-app notification for Absent
        if (finalStatus === 'Absent') {
            await db.query(
                "INSERT INTO notifications (type, message, related_id, related_type) VALUES ('Employee Absent', ?, ?, 'employees')",
                [`${emp?.name || 'Employee'} is absent on ${attendanceDate}`, employee_id]
            );
        }

        // Send WhatsApp notification to employee (non-blocking — never fails the request)
        if (emp?.phone) {
            sendAttendanceNotification(
                emp.phone,
                emp.name,
                finalStatus,
                check_in || null,
                check_out || null,
                attendanceDate
            ).catch(err => console.error('WhatsApp notification error:', err.message));
        }

        res.json({ success: true, message: 'Attendance marked.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PUT /api/attendance/:id ───────────────────────────────
exports.update = async (req, res) => {
    try {
        const { check_in, check_out, status, overtime_hours, notes } = req.body;
        await db.query(
            'UPDATE attendance SET check_in=?, check_out=?, status=?, overtime_hours=?, notes=? WHERE id=?',
            [check_in, check_out, status, overtime_hours, notes, req.params.id]
        );
        res.json({ success: true, message: 'Attendance updated.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/attendance/report ────────────────────────────
exports.getReport = async (req, res) => {
    try {
        const { from, to, employee_id } = req.query;
        let query = `
            SELECT a.*, e.name as employee_name, e.role
            FROM attendance a JOIN employees e ON a.employee_id = e.id
            WHERE a.date BETWEEN ? AND ?
        `;
        const params = [from || '2024-01-01', to || new Date().toISOString().split('T')[0]];

        if (employee_id) { query += ' AND a.employee_id = ?'; params.push(employee_id); }
        query += ' ORDER BY a.date DESC, e.name';

        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/attendance/summary ───────────────────────────
exports.getSummary = async (req, res) => {
    try {
        const { month, year } = req.query;
        const m = parseInt(month, 10) || (new Date().getMonth() + 1);
        const y = parseInt(year,  10) || new Date().getFullYear();
        const isEmployee = req.user.role === 'Employee';

        let query = `
            SELECT e.id, e.name, e.role,
                   SUM(CASE WHEN a.status='Present'  THEN 1 ELSE 0 END) as present,
                   SUM(CASE WHEN a.status='Absent'   THEN 1 ELSE 0 END) as absent,
                   SUM(CASE WHEN a.status='Late'     THEN 1 ELSE 0 END) as late,
                   SUM(CASE WHEN a.status='Half Day' THEN 1 ELSE 0 END) as half_day,
                   SUM(CASE WHEN a.status='Leave'    THEN 1 ELSE 0 END) as leave,
                   SUM(COALESCE(a.overtime_hours,0)) as total_overtime
            FROM employees e
            LEFT JOIN attendance a ON e.id = a.employee_id
                AND MONTH(a.date)=? AND YEAR(a.date)=?
            WHERE e.status='Active'
        `;
        const params = [m, y];

        if (isEmployee) {
            query += ' AND e.user_id = ?';
            params.push(req.user.id);
        }

        query += ' GROUP BY e.id, e.name, e.role ORDER BY e.name';

        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getSummary error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/attendance/calendar ──────────────────────────
exports.getCalendarData = async (req, res) => {
    try {
        const { month, year, employee_id } = req.query;
        const m = parseInt(month, 10) || (new Date().getMonth() + 1);
        const y = parseInt(year, 10) || new Date().getFullYear();
        const isEmployee = req.user.role === 'Employee';

        let targetEmployeeId = employee_id ? parseInt(employee_id, 10) : null;

        if (isEmployee) {
            const [[empRow]] = await db.query('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
            if (empRow) {
                targetEmployeeId = empRow.id;
            }
        }

        let query = `
            SELECT a.*, e.name as employee_name, e.role
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            WHERE MONTH(a.date) = ? AND YEAR(a.date) = ?
        `;
        const params = [m, y];

        if (targetEmployeeId) {
            query += ' AND a.employee_id = ?';
            params.push(targetEmployeeId);
        } else if (isEmployee) {
            query += ' AND e.user_id = ?';
            params.push(req.user.id);
        }

        query += ' ORDER BY a.date ASC, e.name ASC';

        const [rows] = await db.query(query, params);

        let employees = [];
        if (!isEmployee) {
            [employees] = await db.query('SELECT id, name, role, shift FROM employees WHERE status = "Active" ORDER BY name ASC');
        }

        res.json({
            success: true,
            month: m,
            year: y,
            records: rows,
            employees,
            selfView: isEmployee,
            employeeIdFilter: targetEmployeeId
        });
    } catch (err) {
        console.error('getCalendarData error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

