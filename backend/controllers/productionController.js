const db = require('../config/db');
const { sendProductionNotification } = require('../services/whatsappService');

const STAGE_ORDER = ['Cutting', 'Welding', 'Assembly', 'Quality Check', 'Packing'];

// ── GET /api/production ───────────────────────────────────
exports.getAll = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, o.customer_name, o.product_type, o.status as order_status, o.contact as customer_phone
            FROM production p
            JOIN orders o ON p.order_id = o.id
            ORDER BY p.order_id, FIELD(p.stage,'Cutting','Welding','Assembly','Quality Check','Packing')
        `);

        // Group by order_id and calculate completion %
        const grouped = {};
        rows.forEach(r => {
            if (!grouped[r.order_id]) {
                grouped[r.order_id] = {
                    order_id: r.order_id,
                    customer_name: r.customer_name,
                    customer_phone: r.customer_phone,
                    product_type: r.product_type,
                    order_status: r.order_status,
                    stages: [],
                    completion: 0
                };
            }
            grouped[r.order_id].stages.push(r);
        });

        Object.values(grouped).forEach(order => {
            const done = order.stages.filter(s => s.status === 'Completed').length;
            order.completion = Math.round((done / STAGE_ORDER.length) * 100);
            order.current_stage = order.stages.find(s => s.status === 'In Progress')?.stage
                               || order.stages.find(s => s.status === 'Pending')?.stage
                               || 'Completed';
        });

        res.json({ success: true, data: Object.values(grouped) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/production/:orderId ──────────────────────────
exports.getByOrder = async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM production WHERE order_id = ? ORDER BY FIELD(stage,'Cutting','Welding','Assembly','Quality Check','Packing')",
            [req.params.orderId]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── PATCH /api/production/:id ─────────────────────────────
exports.updateStage = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, worker_assigned, machine_used, notes } = req.body;

        const start_time = status === 'In Progress' ? new Date() : undefined;
        const end_time   = status === 'Completed'   ? new Date() : undefined;

        // Fetch current stage info before updating
        const [[stageInfo]] = await db.query(
            `SELECT p.stage, p.order_id, o.customer_name, o.contact as customer_phone
             FROM production p JOIN orders o ON p.order_id = o.id
             WHERE p.id=?`, [id]
        );

        let query = 'UPDATE production SET status=?, worker_assigned=?, machine_used=?, notes=?';
        const params = [status, worker_assigned, machine_used, notes];

        if (start_time) { query += ', start_time=?'; params.push(start_time); }
        if (end_time)   { query += ', end_time=?';   params.push(end_time); }
        query += ' WHERE id=?';
        params.push(id);

        await db.query(query, params);

        // Update order status if all stages complete
        const [stage] = await db.query('SELECT order_id FROM production WHERE id=?', [id]);
        let allDone = false;
        if (stage.length > 0) {
            const [allStages] = await db.query('SELECT * FROM production WHERE order_id=?', [stage[0].order_id]);
            allDone = allStages.every(s => s.status === 'Completed' || (s.id === parseInt(id) && status === 'Completed'));
            if (allDone) {
                await db.query("UPDATE orders SET status='Completed' WHERE id=?", [stage[0].order_id]);
            } else {
                await db.query("UPDATE orders SET status='In Production' WHERE id=? AND status='Pending'", [stage[0].order_id]);
            }
        }

        // WhatsApp notification to customer
        if (stageInfo?.customer_phone && ['In Progress', 'Completed'].includes(status)) {
            sendProductionNotification(stageInfo.customer_phone, {
                customerName: stageInfo.customer_name,
                orderId:      stageInfo.order_id,
                stage:        stageInfo.stage,
                status,
                allDone,
            }).catch(err => console.error('WhatsApp production notify error:', err.message));
        }

        res.json({ success: true, message: 'Stage updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
