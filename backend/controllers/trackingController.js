const db = require('../config/db');

const STAGE_ORDER = ['Cutting', 'Welding', 'Assembly', 'Quality Check', 'Packing'];

// ── POST /api/track ───────────────────────────────────────
// Public — no auth required.
// Body: { order_id, contact }
// Returns customer-safe order info with production stages & payment summary.
exports.trackOrder = async (req, res) => {
    try {
        const { order_id, contact } = req.body;

        if (!order_id || !contact) {
            return res.status(400).json({
                success: false,
                message: 'Order ID and phone number are required.'
            });
        }

        // Normalize phone: strip spaces, dashes, +91 prefix → keep last 10 digits
        const normalizedInput = String(contact).replace(/\D/g, '').slice(-10);

        if (normalizedInput.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit phone number.'
            });
        }

        // Fetch order by ID only first — phone match will be done in JS
        // (avoids REGEXP_REPLACE which requires MySQL 8.0+)
        const [orders] = await db.query(`
            SELECT
                id,
                customer_name,
                product_type,
                size,
                quantity,
                products,
                delivery_date,
                order_amount,
                advance_paid,
                status,
                created_at,
                contact
            FROM orders
            WHERE id = ?
        `, [order_id]);

        // Generic error — don't reveal whether order exists or phone is wrong
        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No order found. Please check your Order ID and phone number.'
            });
        }

        // Compare last 10 digits of stored contact vs. user input (JS-side, works on all MySQL versions)
        const storedNormalized = String(orders[0].contact || '').replace(/\D/g, '').slice(-10);
        if (storedNormalized !== normalizedInput) {
            return res.status(404).json({
                success: false,
                message: 'No order found. Please check your Order ID and phone number.'
            });
        }

        const order = orders[0];

        // ── Production stages (no internal worker names for customer view) ──
        const [stages] = await db.query(`
            SELECT
                id,
                stage,
                status,
                start_time,
                end_time
            FROM production
            WHERE order_id = ?
            ORDER BY FIELD(stage, 'Cutting', 'Welding', 'Assembly', 'Quality Check', 'Packing')
        `, [order.id]);

        // Pad with defaults if some stages are missing
        const stageMap = {};
        stages.forEach(s => { stageMap[s.stage] = s; });
        const orderedStages = STAGE_ORDER.map(name => stageMap[name] || {
            stage: name, status: 'Pending', start_time: null, end_time: null
        });

        // Compute completion %
        const completedCount = orderedStages.filter(s => s.status === 'Completed').length;
        const completionPercent = Math.round((completedCount / STAGE_ORDER.length) * 100);

        // Current active stage
        const currentStage =
            orderedStages.find(s => s.status === 'In Progress')?.stage ||
            orderedStages.find(s => s.status === 'Pending')?.stage ||
            'Completed';

        // ── Payment summary (safe fields only) ──────────────────────────
        const [payments] = await db.query(`
            SELECT
                payment_type,
                amount,
                payment_method,
                payment_date
            FROM payments
            WHERE order_id = ?
            ORDER BY payment_date DESC
        `, [order.id]);

        const totalPaid  = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const remaining  = parseFloat(order.order_amount || 0) - parseFloat(order.advance_paid || 0);

        // Parse products JSON if available
        let productsList = [];
        try {
            if (order.products) {
                productsList = JSON.parse(order.products);
            }
        } catch (_) {}

        res.json({
            success: true,
            data: {
                // Order info
                order_id:          order.id,
                customer_name:     order.customer_name,
                product_type:      order.product_type,
                size:              order.size,
                quantity:          order.quantity,
                products:          productsList,
                delivery_date:     order.delivery_date,
                status:            order.status,
                order_date:        order.created_at,

                // Production
                stages:            orderedStages,
                completion_percent: completionPercent,
                current_stage:     currentStage,

                // Payment (no amount details — just balance)
                total_amount:      parseFloat(order.order_amount || 0),
                amount_paid:       parseFloat(order.advance_paid || 0),
                remaining_balance: Math.max(0, remaining),
                payments,
            }
        });

    } catch (err) {
        console.error('Tracking error:', err);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};
