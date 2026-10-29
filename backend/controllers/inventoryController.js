const db = require('../config/db');

// ── GET /api/inventory ────────────────────────────────────
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT i.*, s.name as supplier_name,
                   (i.quantity <= i.low_stock_threshold) as is_low_stock
            FROM inventory i
            LEFT JOIN suppliers s ON i.supplier_id = s.id
            ORDER BY i.material_name ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/inventory ───────────────────────────────────
exports.create = async (req, res) => {
    try {
        const { material_name, category, quantity, unit, supplier_id, cost, low_stock_threshold, date_added } = req.body;
        if (!material_name) return res.status(400).json({ success: false, message: 'Material name is required.' });

        const [result] = await db.query(
            'INSERT INTO inventory (material_name, category, quantity, unit, supplier_id, cost, low_stock_threshold, date_added) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [material_name, category, quantity || 0, unit, supplier_id || null, cost || 0, low_stock_threshold || 10, date_added || new Date()]
        );

        // Log stock history
        await db.query(
            'INSERT INTO stock_history (inventory_id, change_type, quantity_changed, notes, changed_by) VALUES (?, ?, ?, ?, ?)',
            [result.insertId, 'Added', quantity || 0, 'Initial stock entry', req.user?.id || null]
        );

        // Auto-generate low stock notification if needed
        if (parseFloat(quantity) <= parseFloat(low_stock_threshold || 10)) {
            await db.query(
                "INSERT INTO notifications (type, message, related_id, related_type) VALUES ('Low Stock', ?, ?, 'inventory')",
                [`${material_name} stock is at or below threshold (${quantity} ${unit || 'units'})`, result.insertId]
            );
        }

        res.status(201).json({ success: true, message: 'Material added successfully.', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PUT /api/inventory/:id ────────────────────────────────
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { material_name, category, quantity, unit, supplier_id, cost, low_stock_threshold } = req.body;

        // Get previous quantity for history
        const [prev] = await db.query('SELECT quantity FROM inventory WHERE id = ?', [id]);
        if (prev.length === 0) return res.status(404).json({ success: false, message: 'Item not found.' });

        await db.query(
            'UPDATE inventory SET material_name=?, category=?, quantity=?, unit=?, supplier_id=?, cost=?, low_stock_threshold=? WHERE id=?',
            [material_name, category, quantity, unit, supplier_id || null, cost, low_stock_threshold || 10, id]
        );

        const diff = parseFloat(quantity) - parseFloat(prev[0].quantity);
        if (diff !== 0) {
            await db.query(
                'INSERT INTO stock_history (inventory_id, change_type, quantity_changed, notes, changed_by) VALUES (?, ?, ?, ?, ?)',
                [id, diff > 0 ? 'Added' : 'Removed', Math.abs(diff), 'Manual stock update', req.user?.id || null]
            );
        }

        res.json({ success: true, message: 'Updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── DELETE /api/inventory/:id ─────────────────────────────
exports.remove = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM inventory WHERE id = ?', [id]);
        res.json({ success: true, message: 'Deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/inventory/low-stock ──────────────────────────
exports.getLowStock = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT i.*, s.name as supplier_name
            FROM inventory i
            LEFT JOIN suppliers s ON i.supplier_id = s.id
            WHERE i.quantity <= i.low_stock_threshold
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/inventory/suppliers ─────────────────────────
exports.getSuppliers = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM suppliers ORDER BY name');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/inventory/suppliers ────────────────────────
exports.createSupplier = async (req, res) => {
    try {
        const { name, contact, email, address, gst_number } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Supplier name is required.' });

        const [result] = await db.query(
            'INSERT INTO suppliers (name, contact, email, address, gst_number) VALUES (?, ?, ?, ?, ?)',
            [name, contact, email, address, gst_number]
        );
        res.status(201).json({ success: true, message: 'Supplier added.', id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/inventory/:id/history ───────────────────────
exports.getHistory = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT sh.*, u.name as changed_by_name
            FROM stock_history sh
            LEFT JOIN users u ON sh.changed_by = u.id
            WHERE sh.inventory_id = ?
            ORDER BY sh.changed_at DESC
        `, [req.params.id]);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
