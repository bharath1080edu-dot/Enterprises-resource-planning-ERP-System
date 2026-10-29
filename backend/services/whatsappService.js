/**
 * WhatsApp Service using @whiskeysockets/baileys
 * ─────────────────────────────────────────────────────────────
 * Multi-account support: each account has its own auth folder.
 * Switch accounts without re-scanning if the session was saved.
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} = require('@whiskeysockets/baileys');
const path   = require('path');
const fs     = require('fs');
const pino   = require('pino');

// ── Session storage root ──────────────────────────────────────
const SESSIONS_ROOT = path.join(__dirname, '..', '.whatsapp-sessions');

// Ensure sessions root exists
if (!fs.existsSync(SESSIONS_ROOT)) {
  fs.mkdirSync(SESSIONS_ROOT, { recursive: true });
}

// ── Default account profiles ─────────────────────────────────
const DEFAULT_ACCOUNTS = [
  { id: 'personal',  label: 'Personal',        emoji: '👤', description: 'My personal WhatsApp number' },
  { id: 'father',    label: "Father's Number",  emoji: '👨', description: "Father's WhatsApp account"  },
  { id: 'company',   label: 'Company',          emoji: '🏢', description: 'Company business WhatsApp'  },
];

// ── State ────────────────────────────────────────────────────
let sock              = null;
let isReady           = false;
let isIniting         = false;
let isSwitching       = false;   // true while account switch is in progress
let reconnectTimer    = null;
let currentQR         = null;    // latest QR string for browser display
let connectedPhone    = null;    // formatted phone number (+91XXXXXXXXXX)
let connectedName     = null;    // display name from WhatsApp
let connectedAt       = null;    // ISO timestamp when connection opened
let retryCount        = 0;       // reconnect attempts for backoff
let cachedVersion     = null;    // Baileys version cached after first fetch
const messageLog      = [];      // last 50 messages sent

// Active account — default to 'personal'
let currentAccountId  = 'personal';

// Derive auth dir from account id
function getAuthDir(accountId) {
  const safe = String(accountId).replace(/[^a-z0-9_-]/gi, '_');
  return path.join(SESSIONS_ROOT, safe);
}

// ── Silence noisy Baileys logger ─────────────────────────────
const silentLogger = pino({ level: 'silent' });

// ── Format phone → WhatsApp JID ──────────────────────────────
function toJid(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10)                              return `91${digits}@s.whatsapp.net`;
  if (digits.length === 12 && digits.startsWith('91'))  return `${digits}@s.whatsapp.net`;
  if (digits.length === 13 && digits.startsWith('091')) return `${digits.slice(1)}@s.whatsapp.net`;
  return `${digits}@s.whatsapp.net`;
}

// ── 24h → 12h ────────────────────────────────────────────────
function fmt12h(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Unique quote / thank-you pool ─────────────────────────────
const QUOTES = [
  `🙏 _"Thank you for being a valued part of the Image Creator family!"_`,
  `💛 _"Your trust means the world to us. Thank you!"_`,
  `🌟 _"We appreciate your continued support — you're amazing!"_`,
  `🤝 _"Great things happen when great people work together. Thank you!"_`,
  `❤️ _"Every step you take matters. We're grateful to have you with us!"_`,
  `✨ _"Success is the sum of small efforts repeated day in and day out."_ — Robert Collier`,
  `🚀 _"The secret of getting ahead is getting started."_ — Mark Twain`,
  `💪 _"Hard work beats talent when talent doesn't work hard."_ — Tim Notke`,
  `🌱 _"Small progress is still progress. Keep going!"_`,
  `🔥 _"Believe you can, and you're halfway there."_ — Theodore Roosevelt`,
  `🌄 _"Every morning brings new potential. Make the most of it!"_`,
  `⭐ _"Quality is not an act — it is a habit."_ — Aristotle`,
  `🎯 _"Focus on being productive instead of busy."_ — Tim Ferriss`,
  `🦁 _"The harder you work, the luckier you get."_ — Gary Player`,
  `🌊 _"Be like water — adapt, flow, and overcome."_`,
  `💡 _Fun fact: UPVC windows can last 30+ years with almost zero maintenance!_`,
  `🌿 _Did you know? UPVC is 100% recyclable — great for the planet! 🌍_`,
  `🔬 _Fun fact: UPVC is stronger than wood & aluminium for the same thickness!_`,
  `🌡️ _Did you know? UPVC frames provide excellent thermal insulation, keeping homes cooler in summer!_`,
  `🔒 _Fun fact: Multi-point locking in UPVC doors makes them 3× more secure than traditional doors!_`,
  `☀️ _"Today is a great day to make something beautiful happen!"_`,
  `🌈 _"Your work today creates the comfort of someone's home tomorrow. Keep it excellent!"_`,
  `💼 _"Precision + Passion = Perfection. That's the Image Creator way!"_`,
  `🏆 _"Excellence is never an accident — it's the result of high intention & skilled effort."_`,
  `🎨 _"Craftsmanship is the art of making ordinary things extraordinary."_`,
];

function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

// ── Format raw JID digits → +91XXXXXXXXXX display ─────────────
function formatPhoneDisplay(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91'))
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10)
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return `+${digits}`;
}

// ── Exponential backoff delay: 2s, 4s, 8s … max 60s ────────
function backoffDelay() {
  const delay = Math.min(2000 * Math.pow(2, retryCount), 60_000);
  retryCount++;
  return delay;
}

// ── Connect ───────────────────────────────────────────────────
async function initWhatsApp() {
  if (isIniting) return;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  isIniting = true;
  isReady   = false;

  const authDir = getAuthDir(currentAccountId);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📱 WhatsApp [${currentAccountId}]: Connecting... (attempt ${retryCount + 1})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    if (!cachedVersion) {
      const { version } = await fetchLatestBaileysVersion();
      cachedVersion = version;
      console.log(`ℹ️  Baileys version: ${version.join('.')}`);
    }

    // Ensure auth dir exists before baileys tries to read it
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    let state, saveCreds;
    try {
      ({ state, saveCreds } = await useMultiFileAuthState(authDir));
    } catch (authErr) {
      // Auth files corrupted or unreadable — wipe and start fresh (new QR)
      console.warn(`⚠️  WhatsApp [${currentAccountId}]: Auth files corrupted (${authErr.code || authErr.message}). Clearing and starting fresh...`);
      try { fs.rmSync(authDir, { recursive: true, force: true }); } catch(_) {}
      fs.mkdirSync(authDir, { recursive: true });
      ({ state, saveCreds } = await useMultiFileAuthState(authDir));
    }

    const currentSock = makeWASocket({
      version:                    cachedVersion,
      logger:                     silentLogger,
      auth: {
        creds: state.creds,
        keys:  makeCacheableSignalKeyStore(state.keys, silentLogger),
      },
      browser:                    Browsers.ubuntu('Chrome'),
      printQRInTerminal:          false,
      syncFullHistory:            false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs:           45_000,
      keepAliveIntervalMs:        20_000,
      retryRequestDelayMs:        1_500,
    });

    sock = currentSock;

    currentSock.ev.on('creds.update', saveCreds);

    currentSock.ev.on('connection.update', (update) => {
      // Ignore events from old or replaced sockets
      if (sock !== currentSock) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        console.log(`📲  WhatsApp QR code generated for [${currentAccountId}] — Scan in ERP UI`);
      }

      if (connection === 'open') {
        isReady      = true;
        isIniting    = false;
        isSwitching  = false;
        currentQR    = null;
        retryCount   = 0;
        connectedAt  = new Date().toISOString();
        try {
          const rawId = currentSock.user?.id?.split(':')?.[0] || null;
          connectedPhone = rawId ? formatPhoneDisplay(rawId) : null;
          connectedName  = currentSock.user?.name || null;
        } catch(_) { connectedPhone = null; connectedName = null; }
        console.log(`✅ WhatsApp [${currentAccountId}] READY — ${connectedPhone || 'unknown'} (${connectedName || 'no name'})\n`);
      }

      if (connection === 'close') {
        const code    = lastDisconnect?.error?.output?.statusCode;
        const wasReady = isReady;
        isReady = false;

        if (wasReady) {
          setTimeout(() => {
            if (!isReady) { connectedPhone = null; connectedName = null; connectedAt = null; }
          }, 5000);
        } else {
          connectedPhone = null; connectedName = null; connectedAt = null;
        }

        // If switching accounts, do not trigger auto-reconnect for old account
        if (isSwitching) {
          isIniting = false;
          return;
        }

        if (code === DisconnectReason.loggedOut) {
          console.warn(`⚠️  WhatsApp [${currentAccountId}] logged out. Clearing session...`);
          isIniting = false;
          sock      = null;
          try { if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true }); } catch(_) {}
          reconnectTimer = setTimeout(initWhatsApp, 1500);
        } else {
          const delay = backoffDelay();
          console.log(`🔄 WhatsApp [${currentAccountId}] disconnected (code: ${code}). Retry in ${(delay/1000).toFixed(0)}s...`);
          isIniting = false;
          sock      = null;
          reconnectTimer = setTimeout(initWhatsApp, delay);
        }
      }
    });

  } catch (err) {
    isIniting = false;
    const delay = backoffDelay();
    console.error(`❌ WhatsApp init error: ${err.message}. Retry in ${(delay/1000).toFixed(0)}s...`);
    reconnectTimer = setTimeout(initWhatsApp, delay);
  }
}

// ── Internal send helper ──────────────────────────────────────
async function _send(phone, text, label) {
  if (!isReady || !sock) {
    console.warn(`⚠️  WhatsApp not ready — skipping: ${label}`);
    return false;
  }
  const jid = toJid(phone);
  if (!jid) { console.warn(`⚠️  Bad phone number: ${phone}`); return false; }

  try {
    await sock.sendMessage(jid, { text });
    console.log(`✅ WhatsApp [${currentAccountId}] sent → ${label} (${phone})`);
    messageLog.unshift({ phone, label, text, sentAt: new Date().toISOString(), status: 'sent', account: currentAccountId });
    if (messageLog.length > 50) messageLog.pop();
    return true;
  } catch (err) {
    console.error(`❌ WhatsApp failed → ${label}:`, err.message);
    messageLog.unshift({ phone, label, text, sentAt: new Date().toISOString(), status: 'failed', error: err.message, account: currentAccountId });
    if (messageLog.length > 50) messageLog.pop();
    return false;
  }
}

// ── Switch Account ────────────────────────────────────────────
async function switchAccount(accountId) {
  if (!accountId) throw new Error('accountId is required');
  if (currentAccountId === accountId && isReady) {
    console.log(`ℹ️  Already connected as [${accountId}]`);
    return;
  }

  console.log(`\n🔄 WhatsApp: Switching from [${currentAccountId}] → [${accountId}]...`);

  isSwitching = true;
  isIniting   = false;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Gracefully detach and close previous socket if any
  if (sock) {
    const oldSock = sock;
    sock = null; // Stale guard activated instantly
    try {
      if (oldSock.ev) {
        oldSock.ev.removeAllListeners('connection.update');
        oldSock.ev.removeAllListeners('creds.update');
      }
      oldSock.end();
    } catch (_) {}
  }

  // Reset connection states for smooth switch
  isReady        = false;
  isIniting      = false;
  currentQR      = null;
  connectedPhone = null;
  connectedName  = null;
  connectedAt    = null;
  retryCount     = 0;

  // Set new target account
  currentAccountId = accountId;

  // Brief pause for Baileys to finish cleanup
  await new Promise(r => setTimeout(r, 300));
  isSwitching = false;

  // Start fresh connection for the new account
  await initWhatsApp();
}

/// ── Account Profile Management ──────────────────────────────
function parseAccountsValue(raw) {
  // mysql2 may return the JSON column as already-parsed (array/object)
  // or as a string if it was double-encoded. Handle both.
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return null;
}

async function getAccounts() {
  try {
    const db = require('../config/db');
    const [rows] = await db.query(
      "SELECT setting_value FROM settings WHERE setting_key = 'whatsapp_accounts'"
    );
    if (rows.length > 0 && rows[0].setting_value !== null) {
      const parsed = parseAccountsValue(rows[0].setting_value);
      if (parsed) return parsed;
    }
  } catch (err) {
    console.error('Failed to load WhatsApp accounts from DB:', err.message);
  }
  return DEFAULT_ACCOUNTS;
}

async function saveAccounts(accounts) {
  const db = require('../config/db');
  const val = JSON.stringify(accounts);
  await db.query(
    `INSERT INTO settings (setting_key, setting_value)
     VALUES ('whatsapp_accounts', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [val]
  );
}


// ── Logout current account ────────────────────────────────────
async function logoutWhatsApp() {
  console.log(`🔌 WhatsApp [${currentAccountId}]: Logging out and clearing session...`);
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  isSwitching = true;

  if (sock) {
    try { await sock.logout(); } catch (err) {
      console.warn('Warning during socket logout (safe to ignore):', err.message);
    }
    try { sock.end(); } catch(_) {}
    sock = null;
  }

  const authDir = getAuthDir(currentAccountId);
  if (fs.existsSync(authDir)) {
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log(`🗑️  WhatsApp [${currentAccountId}]: Auth credentials cleared.`);
    } catch (err) {
      console.error('Error clearing auth dir:', err.message);
    }
  }

  isReady        = false;
  isIniting      = false;
  currentQR      = null;
  connectedPhone = null;
  connectedName  = null;
  connectedAt    = null;
  retryCount     = 0;

  isSwitching = false;
  reconnectTimer = setTimeout(initWhatsApp, 500);
}




// ── Check if an account has a saved session on disk ──────────
function hasSession(accountId) {
  const dir = getAuthDir(accountId);
  const credsFile = path.join(dir, 'creds.json');
  if (!fs.existsSync(credsFile)) return false;
  try {
    const raw = fs.readFileSync(credsFile, 'utf8');
    const creds = JSON.parse(raw);
    return !!(creds && creds.me && creds.me.id);
  } catch (_) {
    return false;
  }
}

function getCurrentAccount() {
  return currentAccountId;
}

// ── Template helper ───────────────────────────────────────────
const DEFAULT_TEMPLATES = {
  new_order: "*🏭 UPVC Factory — Order Confirmed!*\n━━━━━━━━━━━━━━━━━━━━\n🎉 Dear *{customerName}*, your order has been placed!\n\n📦 *Order ID:* #{orderId}\n🪟 *Product:* {productType}\n💰 *Order Amount:* ₹{orderAmount}\n✅ *Advance Paid:* ₹{advancePaid}\n⏳ *Balance Due:* ₹{balanceDue}\n📅 *Expected Delivery:* {deliveryDate}\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Thank you for choosing Image Creator UPVC!_",
  status_in_production: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n🔧 Your Order *#{orderId}* is now in *In Production*!\n\nOur team has started working on your order!\n📅 *Expected Delivery:* {deliveryDate}\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  status_completed: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n🎉 Your Order *#{orderId}* is now *Completed*!\n\nYour order is ready! We will contact you soon for dispatch.\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  status_delivered: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n🚚 Your Order *#{orderId}* has been *Delivered*!\n\nThank you for your business!\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  status_cancelled: "*🏭 UPVC Factory — Order Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n❌ Your Order *#{orderId}* has been *Cancelled*.\n\nWe're sorry for any inconvenience caused.\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  production_stage: "*🏭 UPVC Factory — Production Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\n📋 *Order #{orderId}* update:\n{emoji} *Stage:* {stage}\n📊 *Status:* {status}\n{allDoneMessage}━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  payment_reminder: "*🏭 UPVC Factory — Payment Reminder*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\nThis is a friendly reminder regarding your Order *#{orderId}*.\n\n💰 *Total Amount:* ₹{orderAmount}\n✅ *Advance Paid:* ₹{advancePaid}\n⏳ *Balance Due:* *₹{balanceDue}*\n\nPlease arrange for the payment at your earliest convenience.\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_",
  delivery_reminder: "*🏭 UPVC Factory — Delivery Update*\n━━━━━━━━━━━━━━━━━━━━\nDear *{customerName}*,\n\nThis is an update regarding the delivery of your Order *#{orderId}*.\n\n📅 *Expected Delivery:* *{deliveryDate}*\n🪟 *Product:* {productType}\n\nOur team is working hard to ensure timely delivery!\n━━━━━━━━━━━━━━━━━━━━\n{randomQuote}\n_Image Creator UPVC Products & Interiors_"
};

async function getTemplate(key, defaultVal) {
  try {
    const db = require('../config/db');
    const [rows] = await db.query('SELECT setting_value FROM settings WHERE setting_key = ?', ['whatsapp_templates']);
    if (rows.length > 0) {
      const templates = rows[0].setting_value;
      if (templates && templates[key]) return templates[key];
    }
  } catch (err) {
    console.error('Failed to load WhatsApp template from settings:', err.message);
  }
  return defaultVal;
}

// ── Notification senders ──────────────────────────────────────
async function sendAttendanceNotification(phone, employeeName, status, checkIn, checkOut, date) {
  const dateObj       = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const emoji         = { Present:'✅', Absent:'❌', Late:'⏰', 'Half Day':'🔆', Leave:'🏖️' }[status] || '📋';

  let msg  = `*🏭 UPVC Factory ERP — Attendance Update*\n`;
  msg     += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg     += `👤 *Employee:* ${employeeName}\n`;
  msg     += `📅 *Date:* ${formattedDate}\n`;
  msg     += `${emoji} *Status:* ${status}\n`;
  if (checkIn)  msg += `🕐 *Check In:*  ${fmt12h(checkIn)}\n`;
  if (checkOut) msg += `🕐 *Check Out:* ${fmt12h(checkOut)}\n`;
  msg     += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg     += randomQuote();
  msg     += `\n_Image Creator UPVC Products & Interiors_`;

  return _send(phone, msg, `Attendance[${employeeName}]`);
}

async function sendOrderNotification(phone, type, data) {
  let msg = '';

  if (type === 'new_order') {
    const { orderId, customerName, orderAmount, advancePaid, deliveryDate, productType } = data;
    const remaining = parseFloat(orderAmount) - parseFloat(advancePaid || 0);
    const delivery  = deliveryDate
      ? new Date(deliveryDate).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
      : 'To be confirmed';

    const template = await getTemplate('new_order', DEFAULT_TEMPLATES.new_order);
    msg = template
      .replace(/{customerName}/g, customerName)
      .replace(/{orderId}/g, orderId)
      .replace(/{productType}/g, productType || '—')
      .replace(/{orderAmount}/g, parseFloat(orderAmount).toLocaleString('en-IN'))
      .replace(/{advancePaid}/g, parseFloat(advancePaid || 0).toLocaleString('en-IN'))
      .replace(/{balanceDue}/g, remaining.toLocaleString('en-IN'))
      .replace(/{deliveryDate}/g, delivery)
      .replace(/{randomQuote}/g, randomQuote());

  } else if (type === 'status_change') {
    const { orderId, customerName, status, deliveryDate } = data;
    const delivery = deliveryDate
      ? new Date(deliveryDate).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
      : null;

    let key = 'status_in_production';
    if (status === 'Completed') key = 'status_completed';
    else if (status === 'Delivered') key = 'status_delivered';
    else if (status === 'Cancelled') key = 'status_cancelled';

    const template = await getTemplate(key, DEFAULT_TEMPLATES[key]);
    msg = template
      .replace(/{customerName}/g, customerName)
      .replace(/{orderId}/g, orderId)
      .replace(/{status}/g, status)
      .replace(/{deliveryDate}/g, delivery || 'To be confirmed')
      .replace(/{randomQuote}/g, randomQuote());
  }

  if (!msg) return false;
  return _send(phone, msg, `Order[${type}]`);
}

async function sendProductionNotification(phone, data) {
  const { customerName, orderId, stage, status, allDone } = data;
  const stageEmoji = { Cutting:'✂️', Welding:'🔥', Assembly:'🔩', 'Quality Check':'🔍', Packing:'📦' };
  const emoji = stageEmoji[stage] || '🔧';

  const template = await getTemplate('production_stage', DEFAULT_TEMPLATES.production_stage);
  const formattedStatus = status === 'In Progress' ? '🔄 In Progress' : '✅ Completed';
  const allDoneMessage = allDone ? '\n🎉 *All stages complete! Order is ready.*\n\n' : '';

  const msg = template
    .replace(/{customerName}/g, customerName)
    .replace(/{orderId}/g, orderId)
    .replace(/{emoji}/g, emoji)
    .replace(/{stage}/g, stage)
    .replace(/{status}/g, formattedStatus)
    .replace(/{allDoneMessage}/g, allDoneMessage)
    .replace(/{randomQuote}/g, randomQuote());

  return _send(phone, msg, `Production[Order#${orderId},${stage}]`);
}

async function sendNudgeNotification(phone, type, data) {
  let msg = '';
  const { orderId, customerName, orderAmount, advancePaid, deliveryDate, productType } = data;
  const remaining = parseFloat(orderAmount) - parseFloat(advancePaid || 0);

  if (type === 'payment_reminder') {
    const template = await getTemplate('payment_reminder', DEFAULT_TEMPLATES.payment_reminder);
    msg = template
      .replace(/{customerName}/g, customerName)
      .replace(/{orderId}/g, orderId)
      .replace(/{productType}/g, productType || '—')
      .replace(/{orderAmount}/g, parseFloat(orderAmount).toLocaleString('en-IN'))
      .replace(/{advancePaid}/g, parseFloat(advancePaid || 0).toLocaleString('en-IN'))
      .replace(/{balanceDue}/g, remaining.toLocaleString('en-IN'))
      .replace(/{deliveryDate}/g, deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-IN') : '—')
      .replace(/{randomQuote}/g, randomQuote());
  } else if (type === 'delivery_reminder') {
    const delivery = deliveryDate
      ? new Date(deliveryDate).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
      : 'To be confirmed';

    const template = await getTemplate('delivery_reminder', DEFAULT_TEMPLATES.delivery_reminder);
    msg = template
      .replace(/{customerName}/g, customerName)
      .replace(/{orderId}/g, orderId)
      .replace(/{productType}/g, productType || '—')
      .replace(/{orderAmount}/g, parseFloat(orderAmount).toLocaleString('en-IN'))
      .replace(/{advancePaid}/g, parseFloat(advancePaid || 0).toLocaleString('en-IN'))
      .replace(/{balanceDue}/g, remaining.toLocaleString('en-IN'))
      .replace(/{deliveryDate}/g, delivery)
      .replace(/{randomQuote}/g, randomQuote());
  }

  if (!msg) return false;
  return _send(phone, msg, `Nudge[${type}, Order#${orderId}]`);
}

function isWhatsAppReady() { return isReady; }

function fmtUptime(isoStart) {
  if (!isoStart) return null;
  const secs = Math.floor((Date.now() - new Date(isoStart).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function getStatus() {
  return {
    connected:        isReady,
    initializing:     isIniting,
    switching:        isSwitching,
    qr:               currentQR,
    phone:            connectedPhone,
    name:             connectedName,
    connectedAt:      connectedAt,
    uptime:           fmtUptime(connectedAt),
    retryCount:       retryCount,
    currentAccountId: currentAccountId,
    messageLog:       messageLog.slice(0, 50),
  };
}

module.exports = {
  initWhatsApp,
  sendAttendanceNotification,
  sendOrderNotification,
  sendProductionNotification,
  sendNudgeNotification,
  isWhatsAppReady,
  getStatus,
  logoutWhatsApp,
  switchAccount,
  getAccounts,
  saveAccounts,
  hasSession,
  getCurrentAccount,
};
