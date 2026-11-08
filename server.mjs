import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const port = Number(process.env.PORT) || 8080;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    if (/loopback|vethernet|wsl|virtual|vmware/i.test(name)) continue;
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  const cleanUrl = (req.url || '/').split('?')[0];
  let relPath = cleanUrl.replace(/^\/+/, '');
  if (!relPath) relPath = 'index.html';

  let filePath = path.join(distDir, relPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, '0.0.0.0', () => {
  const localIP = getLocalIP();
  const lanUrl = `http://${localIP}:${port}/`;
  const localUrl = `http://localhost:${port}/`;

  console.log('==========================================================');
  console.log(' QuickExam サーバーが起動しました！（全240問・オフライン対応）');
  console.log('==========================================================');
  console.log(` [PCで開く場合]     : ${localUrl}`);
  console.log(` [スマホで開く場合] : ${lanUrl}`);
  console.log('----------------------------------------------------------');
  console.log(' ★ 一度スマホでこのURLを開くと、端末内に全240問が自動保存され、');
  console.log('   外出先（PCの電源OFF・モバイル回線・機内モード）でも');
  console.log('   ホーム画面のアイコンやブックマークから確実に起動できます！');
  console.log('==========================================================');

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(lanUrl)}`;
  exec(`start "" "${localUrl}"`);
  if (localIP !== 'localhost') {
    exec(`start "" "${qrUrl}"`);
  }
});
