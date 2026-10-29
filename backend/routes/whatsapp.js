const express = require('express');
const router  = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getStatus,
  initWhatsApp,
  logoutWhatsApp,
  sendNudgeNotification,
  switchAccount,
  getAccounts,
  saveAccounts,
  hasSession,
} = require('../services/whatsappService');
const db = require('../config/db');

router.use(protect);

// GET /api/whatsapp/status  — connection state, QR, message log (Admin only)
router.get('/status', requireRole('Admin'), (req, res) => {
  res.json({ success: true, data: getStatus() });
});

// GET /api/whatsapp/accounts  — list all account profiles (Admin only)
router.get('/accounts', requireRole('Admin'), async (req, res) => {
  try {
    const accounts = await getAccounts();
    // Attach session info to each account
    const withSession = accounts.map(a => ({
      ...a,
      hasSession: hasSession(a.id),
    }));
    res.json({ success: true, data: withSession });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/whatsapp/accounts  — save/update account profiles (Admin only)
router.post('/accounts', requireRole('Admin'), async (req, res) => {
  try {
    const { accounts } = req.body;
    if (!Array.isArray(accounts)) {
      return res.status(400).json({ success: false, message: 'accounts must be an array.' });
    }
    // Basic validation
    for (const a of accounts) {
      if (!a.id || !a.label) {
        return res.status(400).json({ success: false, message: 'Each account must have id and label.' });
      }
    }
    await saveAccounts(accounts);
    res.json({ success: true, message: 'Accounts saved.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/whatsapp/switch  — switch active WhatsApp account (Admin only)
router.post('/switch', requireRole('Admin'), async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ success: false, message: 'accountId is required.' });
    }

    // Validate against saved accounts
    const accounts = await getAccounts();
    const found = accounts.find(a => a.id === accountId);
    if (!found) {
      return res.status(404).json({ success: false, message: `Account "${accountId}" not found.` });
    }

    // Fire async — client will poll /status to see the result
    switchAccount(accountId).catch(err =>
      console.error('switchAccount error:', err.message)
    );

    res.json({
      success:   true,
      message:   `Switching to ${found.emoji || ''} ${found.label}…`,
      accountId: found.id,
      hasSession: hasSession(accountId),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/whatsapp/reconnect  — force reconnect (Admin only)
router.post('/reconnect', requireRole('Admin'), (req, res) => {
  try {
    initWhatsApp();
    res.json({ success: true, message: 'WhatsApp reconnecting...' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/whatsapp/disconnect  — logout and clear saved session (Admin only)
router.post('/disconnect', requireRole('Admin'), async (req, res) => {
  try {
    await logoutWhatsApp();
    res.json({ success: true, message: 'WhatsApp session cleared. Scan new QR.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/whatsapp/nudge — send manual nudge notifications (Admin and Manager)
router.post('/nudge', requireRole('Admin', 'Manager'), async (req, res) => {
  try {
    const { orderId, nudgeType } = req.body;
    if (!orderId || !nudgeType) {
      return res.status(400).json({ success: false, message: 'orderId and nudgeType are required.' });
    }

    const [[order]] = await db.query(
      'SELECT id, customer_name, contact, order_amount, advance_paid, delivery_date, product_type FROM orders WHERE id = ?',
      [orderId]
    );

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!order.contact) return res.status(400).json({ success: false, message: 'Order has no customer contact number.' });

    const success = await sendNudgeNotification(order.contact, nudgeType, {
      orderId:      order.id,
      customerName: order.customer_name,
      orderAmount:  order.order_amount,
      advancePaid:  order.advance_paid,
      deliveryDate: order.delivery_date,
      productType:  order.product_type,
    });

    if (success) {
      res.json({ success: true, message: 'Nudge notification sent successfully.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send WhatsApp message. Ensure WhatsApp is connected.' });
    }
  } catch (err) {
    console.error('Nudge error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
