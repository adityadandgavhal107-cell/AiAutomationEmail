const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai/generate-email',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': 2
  }
}, (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', JSON.stringify(res.headers));
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('BODY:', body));
});

req.on('error', (e) => console.error('ERROR:', e.message));
req.write('{}');
req.end();
