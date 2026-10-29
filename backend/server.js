require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const path     = require('path');
const fs       = require('fs');
const { initWhatsApp } = require('./services/whatsappService');

// ── Migrate old single-account auth → multi-account sessions ──
// If the old .whatsapp-auth folder exists and .whatsapp-sessions/personal
// does NOT yet exist, move the old session into the personal slot.
(function migrateOldSession() {
  const OLD_AUTH = path.join(__dirname, '.whatsapp-auth');
  const NEW_ROOT = path.join(__dirname, '.whatsapp-sessions');
  const PERSONAL = path.join(NEW_ROOT, 'personal');

  if (!fs.existsSync(PERSONAL) && fs.existsSync(OLD_AUTH)) {
    try {
      fs.mkdirSync(NEW_ROOT, { recursive: true });
      fs.cpSync(OLD_AUTH, PERSONAL, { recursive: true });
      console.log('✅ Migrated old WhatsApp session → .whatsapp-sessions/personal');
    } catch (err) {
      console.warn('⚠️  Could not migrate old WhatsApp session:', err.message);
    }
  }
})();

const app = express();

// ── Security & Logging ──────────────────────────────────
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ───────────────────────────────────────────────
// Public (no auth required)
app.use('/api/track',         require('./routes/track'));

// Authenticated routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/inventory',     require('./routes/inventory'));
app.use('/api/orders',        require('./routes/orders'));
app.use('/api/production',    require('./routes/production'));
app.use('/api/employees',     require('./routes/employees'));
app.use('/api/attendance',    require('./routes/attendance'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/whatsapp',      require('./routes/whatsapp'));
app.use('/api/bom',           require('./routes/bom'));

// ── Health Check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Image Creator ERP API is running', timestamp: new Date() });
});

// ── Global Error Handler ─────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Server Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Image Creator ERP Server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}/api/health`);

    // Initialize WhatsApp service (scan QR once, then auto-sends messages)
    initWhatsApp();
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.`);
        console.error(`   Stop the existing server first, then run npm start again.\n`);
        process.exit(1);
    } else {
        throw err;
    }
});