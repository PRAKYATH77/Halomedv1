const http = require('http');

// First, login to get a token
const loginData = JSON.stringify({
  email: 'customer@test.com',
  password: 'password123'
});

const loginReq = http.request({
  hostname: 'localhost',
  port: 5003,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
}, loginRes => {
  let body = '';
  loginRes.on('data', chunk => body += chunk);
  loginRes.on('end', () => {
    try {
      const loginResult = JSON.parse(body);
      console.log('Login response:', JSON.stringify(loginResult, null, 2));
      
      if (loginResult.success && loginResult.token) {
        const token = loginResult.token;
        
        // Now call the assistant with the valid token
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
            'Authorization': `Bearer ${token}`
          }
        }, res => {
          let assistantBody = '';
          res.on('data', chunk => assistantBody += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(assistantBody);
              console.log('\n=== ASSISTANT RESPONSE ===');
              console.log(JSON.stringify(result, null, 2));
              console.log('=========================\n');
            } catch (e) {
              console.log('Error parsing response:', e.message);
              console.log('Raw:', assistantBody);
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
      } else {
        console.error('Login failed:', loginResult);
        process.exit(1);
      }
    } catch (e) {
      console.log('Error parsing login response:', e.message);
      console.log('Raw:', body);
      process.exit(1);
    }
  });
});

loginReq.on('error', e => {
  console.error('Login request error:', e.message);
  process.exit(1);
});

loginReq.write(loginData);
loginReq.end();
