import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, relative, resolve, sep} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const rootArgument = process.argv[2] ?? 'site';
const rootDirectory = resolve(projectRoot, rootArgument);
const host = '127.0.0.1';
const port = 4173;

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

function insideRoot(candidate) {
  const pathRelative = relative(rootDirectory, candidate);
  return pathRelative === '' || (pathRelative !== '..' && !pathRelative.startsWith(`..${sep}`));
}

function sendText(response, status, message) {
  response.writeHead(status, {'Content-Type': 'text/plain; charset=utf-8'});
  response.end(message);
}

async function resolveRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl ?? '/', `http://${host}:${port}`).pathname);
  } catch {
    return null;
  }
  const requestedPath = resolve(rootDirectory, `.${pathname}`);
  if (!insideRoot(requestedPath)) return null;

  try {
    const info = await stat(requestedPath);
    if (info.isDirectory()) return resolve(requestedPath, 'index.html');
    if (info.isFile()) return requestedPath;
  } catch {
    return null;
  }
  return null;
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    sendText(response, 405, 'Method Not Allowed');
    return;
  }

  const filePath = await resolveRequestPath(request.url);
  if (!filePath) {
    sendText(response, 404, 'Not Found');
    return;
  }

  try {
    const info = await stat(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Length': info.size,
      'Content-Type': contentTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch {
    if (!response.headersSent) sendText(response, 404, 'Not Found');
    else response.destroy();
  }
});

server.on('error', error => {
  console.error(`Unable to serve ${rootArgument} on http://${host}:${port}: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Serving ${rootArgument} at http://${host}:${port}/`);
});
