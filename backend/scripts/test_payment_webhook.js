import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const base = 'http://localhost:5003';

async function run() {
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const lj = await loginRes.json();
  const token = lj.data.token;
  console.log('token ok');

  const orderRes = await fetch(`${base}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ items: [{ medicine_id: 1, quantity: 1, price: 10 }], totalAmount: 10, deliveryAddress: 'Webhook addr', city: 'City', zipCode: '000000', phoneNumber: '9999999999', paymentMethod: 'online' })
  });
  const orderJson = await orderRes.json();
  console.log('order create', orderJson);
  const orderId = orderJson.data.orderId;

  const rzpRes = await fetch(`${base}/payments/razorpay`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ amount: 10, receipt: String(orderId) })
  });
  const rj = await rzpRes.json();
  console.log('rzp', rj.data.order.id);

  const razorpay_order_id = rj.data.order.id;
  const razorpay_payment_id = 'pay_fake_' + Date.now();

  const payload = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          order_id: razorpay_order_id,
          id: razorpay_payment_id,
        }
      }
    }
  };

  const raw = JSON.stringify(payload);
  // Use webhook secret if set (server prefers RAZORPAY_WEBHOOK_SECRET), fallback to key secret
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || 'k2VZtBVPPf5DNyEQFRFdr84z';
  const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  console.log('computed signature:', signature);

  const webhookRes = await fetch(`${base}/payments/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature }, body: raw
  });
  const text = await webhookRes.text();
  console.log('webhook response', webhookRes.status, text);

  // Check order status after webhook
  const ordCheck = await fetch(`${base}/api/orders/${orderId}`, { method: 'GET', headers: { Authorization: 'Bearer ' + token } });
  const ordJson = await ordCheck.json();
  console.log('order after webhook', ordJson);
}

run().catch(e => { console.error(e); process.exit(1); });
