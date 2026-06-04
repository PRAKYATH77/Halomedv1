const http = require('http');

const data = JSON.stringify({
  query: 'My order shows out for delivery but I haven\'t received it. What now?'
});

const req = http.request({
  hostname: 'localhost',
  port: 5003,
  path: '/assistant/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': 'Bearer test-token'
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(body);
      console.log('\n=== FULL RESPONSE ===');
      console.log(JSON.stringify(result, null, 2));
      console.log('===================\n');
    } catch (e) {
      console.log('Error parsing response:', e.message);
      console.log('Raw:', body);
    }
    process.exit(0);
  });
});

req.on('error', e => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.write(data);
req.end();
