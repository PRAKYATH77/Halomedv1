import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, 'dist');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 5173);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
};

const sendFile = (res, filePath) => {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath.replace(/^\//, '');

  if (!rel) return sendFile(res, path.join(root, 'index.html'));

  const resolved = path.join(root, rel);
  if (!resolved.startsWith(root)) return send(res, 400, 'Bad request');

  fs.stat(resolved, (err, st) => {
    if (!err && st.isFile()) return sendFile(res, resolved);
    // SPA fallback
    return sendFile(res, path.join(root, 'index.html'));
  });
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Serving frontend dist from ${root}`);
  // eslint-disable-next-line no-console
  console.log(`Open: http://${host}:${port}/`);
});

