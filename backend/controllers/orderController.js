const db = require('../config/db');
const { sendOrderNotification } = require('../services/whatsappService');

// ── GET /api/orders ───────────────────────────────────────
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT o.*,
                   (o.order_amount - o.advance_paid) as remaining_balance
            FROM orders o
            ORDER BY o.created_at DESC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/orders/:id ───────────────────────────────────
exports.getOne = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT o.*, (o.order_amount - o.advance_paid) as remaining_balance
            FROM orders o WHERE o.id = ?
        `, [req.params.id]);

        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found.' });

        const [stages] = await db.query('SELECT * FROM production WHERE order_id = ? ORDER BY FIELD(stage,"Cutting","Welding","Assembly","Quality Check","Packing")', [req.params.id]);
        const [payments] = await db.query('SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC', [req.params.id]);

        res.json({ success: true, data: { ...rows[0], stages, payments } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/orders ──────────────────────────────────────
exports.create = async (req, res) => {
    try {
        const { customer_name, contact, products, columns, delivery_date, order_amount, advance_paid, notes } = req.body;
        if (!customer_name || !order_amount)
            return res.status(400).json({ success: false, message: 'Customer name and order amount are required.' });

        // Build legacy summary for production/reports backward compat
        const productArray = Array.isArray(products) && products.length > 0 ? products : [];
        const firstProduct = productArray[0]?.[columns?.[0]] || '';
        const legacyType = productArray.length > 1 ? `${firstProduct} (+${productArray.length - 1} more)` : firstProduct;
        const legacySize  = productArray[0]?.[columns?.[1]] ? `${productArray[0][columns[1]]} x ${productArray[0][columns[2]] || ''}` : '';
        const legacyQty   = productArray.reduce((s, r) => s + (parseInt(r[columns?.find(c => c.toLowerCase().includes('qty') || c.toLowerCase().includes('quan'))] || 0) || 0), 0) || 1;

        const [result] = await db.query(
            'INSERT INTO orders (customer_name, contact, product_type, size, quantity, products, delivery_date, order_amount, advance_paid, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [customer_name, contact, legacyType, legacySize, legacyQty, JSON.stringify(productArray), delivery_date, order_amount, advance_paid || 0, notes]
        );

        // Auto-create production stages
        const stages = ['Cutting', 'Welding', 'Assembly', 'Quality Check', 'Packing'];
        for (const stage of stages) {
            await db.query('INSERT INTO production (order_id, stage, status) VALUES (?, ?, ?)', [result.insertId, stage, 'Pending']);
        }

        // Pending payment notification if advance < total
        if (parseFloat(advance_paid || 0) < parseFloat(order_amount)) {
            const remaining = parseFloat(order_amount) - parseFloat(advance_paid || 0);
            await db.query(
                "INSERT INTO notifications (type, message, related_id, related_type) VALUES ('Pending Payment', ?, ?, 'orders')",
                [`Order #${result.insertId} for ${customer_name} has pending balance of ₹${remaining.toLocaleString()}`, result.insertId]
            );
        }

        // WhatsApp notification to customer
        if (contact) {
            sendOrderNotification(contact, 'new_order', {
                orderId:      result.insertId,
                customerName: customer_name,
                orderAmount:  order_amount,
                advancePaid:  advance_paid || 0,
                deliveryDate: delivery_date,
                productType:  legacyType,
            }).catch(err => console.error('WhatsApp order notify error:', err.message));
        }

        res.status(201).json({ success: true, message: 'Order created successfully.', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PUT /api/orders/:id ───────────────────────────────────
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { customer_name, contact, products, columns, delivery_date, order_amount, advance_paid, status, notes } = req.body;

        const productArray = Array.isArray(products) && products.length > 0 ? products : [];
        const firstProduct = productArray[0]?.[columns?.[0]] || '';
        const legacyType = productArray.length > 1 ? `${firstProduct} (+${productArray.length - 1} more)` : firstProduct;
        const legacySize  = productArray[0]?.[columns?.[1]] ? `${productArray[0][columns[1]]} x ${productArray[0][columns[2]] || ''}` : '';
        const legacyQty   = productArray.reduce((s, r) => s + (parseInt(r[columns?.find(c => c.toLowerCase().includes('qty') || c.toLowerCase().includes('quan'))] || 0) || 0), 0) || 1;

        // Fetch previous status to detect changes
        const [[prev]] = await db.query('SELECT status FROM orders WHERE id=?', [id]);
        const prevStatus = prev?.status;

        await db.query(
            'UPDATE orders SET customer_name=?, contact=?, product_type=?, size=?, quantity=?, products=?, delivery_date=?, order_amount=?, advance_paid=?, status=?, notes=? WHERE id=?',
            [customer_name, contact, legacyType, legacySize, legacyQty, JSON.stringify(productArray), delivery_date, order_amount, advance_paid, status, notes, id]
        );

        // WhatsApp notification if status changed
        if (contact && status && status !== prevStatus) {
            sendOrderNotification(contact, 'status_change', {
                orderId:      id,
                customerName: customer_name,
                status,
                deliveryDate: delivery_date,
            }).catch(err => console.error('WhatsApp update notify error:', err.message));
        }

        res.json({ success: true, message: 'Order updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PATCH /api/orders/:id/status ─────────────────────────
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ['Pending', 'In Production', 'Completed', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status))
            return res.status(400).json({ success: false, message: 'Invalid status.' });

        // Fetch order details for notification
        const [[order]] = await db.query('SELECT customer_name, contact, delivery_date FROM orders WHERE id=?', [id]);

        await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

        // WhatsApp notification to customer on meaningful status changes
        if (order?.contact && ['Completed', 'Delivered', 'Cancelled', 'In Production'].includes(status)) {
            sendOrderNotification(order.contact, 'status_change', {
                orderId:      id,
                customerName: order.customer_name,
                status,
                deliveryDate: order.delivery_date,
            }).catch(err => console.error('WhatsApp status notify error:', err.message));
        }

        res.json({ success: true, message: `Order status updated to ${status}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── DELETE /api/orders/:id ────────────────────────────────
exports.remove = async (req, res) => {
    try {
        await db.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Order deleted.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
