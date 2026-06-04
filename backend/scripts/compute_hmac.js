import crypto from 'crypto';
const secret = process.argv[2];
const raw = process.argv[3];
if (!secret || !raw) {
  console.error('Usage: node compute_hmac.js <secret> <rawString>');
  process.exit(2);
}
console.log('hex', crypto.createHmac('sha256', secret).update(raw).digest('hex'));
console.log('base64', crypto.createHmac('sha256', secret).update(raw).digest('base64'));
