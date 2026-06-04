import Razorpay from 'razorpay';

const id = process.argv[2];
if (!id) {
  console.error('Usage: node fetch_rzp_order.js <order_id>');
  process.exit(1);
}

const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_Ss3CXRBF36u7Yi';
const key_secret = process.env.RAZORPAY_KEY_SECRET || 'k2VZtBVPPf5DNyEQFRFdr84z';
const rzp = new Razorpay({ key_id, key_secret });

rzp.orders.fetch(id).then(o => {
  console.log('order fetched', o);
}).catch(e => {
  console.error('fetch error', e?.message || e);
});
