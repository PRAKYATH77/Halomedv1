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
    body: JSON.stringify({ items: [{ medicine_id: 1, quantity: 1, price: 5.5 }], totalAmount: 5.5, deliveryAddress: 'Test addr', city: 'Bengaluru', zipCode: '560001', phoneNumber: '9999999999', paymentMethod: 'online' })
  });
  const orderJson = await orderRes.json();
  console.log('order create', orderJson);
  const orderId = orderJson.data.orderId;

  const rzpRes = await fetch(`${base}/payments/razorpay`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ amount: 5.5 })
  });
  const rj = await rzpRes.json();
  console.log('rzp', rj.data.order.id);

  const razorpay_order_id = rj.data.order.id;
  const razorpay_payment_id = 'pay_fake_' + Date.now();
  const secret = process.env.RAZORPAY_KEY_SECRET || 'k2VZtBVPPf5DNyEQFRFdr84z';
  const signature = crypto.createHmac('sha256', secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');

  const verifyRes = await fetch(`${base}/payments/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature: signature, order_id: orderId })
  });
  const vr = await verifyRes.json();
  console.log('verify result', vr);
}

run().catch(e => { console.error(e); process.exit(1); });
