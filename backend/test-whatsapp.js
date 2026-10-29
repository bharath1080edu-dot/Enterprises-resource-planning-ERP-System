/**
 * Live WhatsApp test — sends one real message to:
 * 1. First employee with a phone number (attendance style)
 * 2. First order with a contact number (order style)
 */
const { initWhatsApp, sendAttendanceNotification, sendOrderNotification, sendProductionNotification } = require('./services/whatsappService');
const db = require('./config/db');

initWhatsApp();

setTimeout(async () => {
  console.log('\n── TEST 1: Attendance (Employee) ──');
  const [emps] = await db.query('SELECT name, phone FROM employees WHERE phone IS NOT NULL AND phone != "" LIMIT 1');
  if (emps.length) {
    console.log(`Sending to employee: ${emps[0].name} → ${emps[0].phone}`);
    const r1 = await sendAttendanceNotification(emps[0].phone, emps[0].name, 'Present', '09:00', '18:00', new Date().toISOString().split('T')[0]);
    console.log('Result:', r1 ? '✅ SENT' : '❌ FAILED');
  } else {
    console.log('❌ No employees with phone numbers! Add phone in Employees module.');
  }

  console.log('\n── TEST 2: Order (Customer) ──');
  const [orders] = await db.query('SELECT id, customer_name, contact, order_amount, advance_paid, delivery_date, product_type FROM orders WHERE contact IS NOT NULL AND contact != "" LIMIT 1');
  if (orders.length) {
    const o = orders[0];
    console.log(`Sending to customer: ${o.customer_name} → ${o.contact}`);
    const r2 = await sendOrderNotification(o.contact, 'new_order', {
      orderId: o.id, customerName: o.customer_name,
      orderAmount: o.order_amount, advancePaid: o.advance_paid,
      deliveryDate: o.delivery_date, productType: o.product_type,
    });
    console.log('Result:', r2 ? '✅ SENT' : '❌ FAILED');
  } else {
    console.log('❌ No orders with contact numbers! Add contact in Orders module.');
  }

  console.log('\n── TEST 3: Production (Customer) ──');
  const [prods] = await db.query(`
    SELECT p.id, p.stage, p.order_id, o.customer_name, o.contact 
    FROM production p JOIN orders o ON p.order_id=o.id 
    WHERE o.contact IS NOT NULL AND o.contact != "" LIMIT 1
  `);
  if (prods.length) {
    const p = prods[0];
    console.log(`Sending production update to: ${p.customer_name} → ${p.contact}`);
    const r3 = await sendProductionNotification(p.contact, {
      customerName: p.customer_name, orderId: p.order_id,
      stage: p.stage, status: 'In Progress', allDone: false,
    });
    console.log('Result:', r3 ? '✅ SENT' : '❌ FAILED');
  } else {
    console.log('❌ No production records with customer contact!');
  }

  process.exit(0);
}, 8000);
