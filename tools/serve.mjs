// Локальний сервер для перевірки: web/ за адресою http://localhost:8791/solidcraft/, як на сайті.
// Запуск: node tools/serve.mjs [порт]

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../web', import.meta.url)));
const PREFIX = '/solidcraft/';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function fileFor(urlPath) {
  if (!urlPath.startsWith(PREFIX)) return null;
  let relative = decodeURIComponent(urlPath.slice(PREFIX.length));
  if (relative === '' || relative.endsWith('/')) relative += 'index.html';
  const full = normalize(join(ROOT, relative));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  try {
    return statSync(full).isFile() ? full : null;
  } catch {
    return null;
  }
}

export function serve(port = 8791) {
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/' || path === '/solidcraft') {
      res.writeHead(302, { location: PREFIX }).end();
      return;
    }
    const file = fileFor(path);
    if (!file) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(port, '127.0.0.1', () => done(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 8791);
  await serve(port);
  console.log(`http://localhost:${port}${PREFIX}`);
}
