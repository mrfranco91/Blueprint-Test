import http from 'http';
import url from 'url';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a unified server that handles both API and Vite
const createCombinedServer = async () => {
  let vite;
  try {
    vite = await createViteServer({
      server: {
        middlewareMode: true,
      }
    });
    console.log('✓ Vite server initialized');
  } catch (err) {
    console.error('Failed to initialize Vite:', err);
    throw err;
  }

  class MockRequest {
    constructor(nodeReq) {
      this.method = nodeReq.method;
      this.url = nodeReq.url;
      this.headers = nodeReq.headers;
      this.query = {};
      this.body = null;

      const parsed = url.parse(nodeReq.url, true);
      this.query = parsed.query;
    }

    async json() {
      if (!this.body) {
        this.body = '';
      }
      return JSON.parse(this.body);
    }

    async text() {
      if (!this.body) {
        this.body = '';
      }
      return this.body;
    }
  }

  class MockResponse {
    constructor(nodeRes) {
      this.nodeRes = nodeRes;
      this.statusCode = 200;
      this.headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-square-access-token',
      };
    }

    setHeader(key, value) {
      this.headers[key] = value;
    }

    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      if (headers) {
        Object.assign(this.headers, headers);
      }
    }

    status(code) {
      this.statusCode = code;
      return this;
    }

    json(data) {
      this.setHeader('Content-Type', 'application/json');
      this.nodeRes.writeHead(this.statusCode, this.headers);
      this.nodeRes.end(JSON.stringify(data));
    }

    end(data) {
      this.nodeRes.writeHead(this.statusCode, this.headers);
      this.nodeRes.end(data);
    }

    redirect(code, url) {
      this.statusCode = code;
      this.setHeader('Location', url);
      this.nodeRes.writeHead(this.statusCode, this.headers);
      this.nodeRes.end();
    }
  }

  const server = http.createServer(async (nodeReq, nodeRes) => {
    // CORS preflight
    if (nodeReq.method === 'OPTIONS') {
      nodeRes.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-square-access-token',
      });
      nodeRes.end();
      return;
    }

    const pathname = url.parse(nodeReq.url, true).pathname;

    // Handle API routes
    if (pathname.startsWith('/api/')) {
      const req = new MockRequest(nodeReq);
      const res = new MockResponse(nodeRes);

      let body = '';
      nodeReq.on('data', (chunk) => {
        body += chunk.toString();
      });

      return nodeReq.on('end', async () => {
        req.body = body;

        try {
          if (pathname === '/api/square/team') {
            const { default: handler } = await import('./api/square/team.ts');
            return handler(req, res);
          }

          if (pathname === '/api/square/clients') {
            const { default: handler } = await import('./api/square/clients.ts');
            return handler(req, res);
          }

          if (pathname === '/api/square/proxy') {
            const { default: handler } = await import('./api/square/proxy.ts');
            return handler(req, res);
          }

          if (pathname === '/api/square/oauth/start') {
            const { default: handler } = await import('./api/square/oauth/start.ts');
            return handler(req, res);
          }

          if (pathname === '/api/square/oauth/token') {
            const { default: handler } = await import('./api/square/oauth/token.ts');
            return handler(req, res);
          }

          if (pathname === '/api/square/get-token') {
            const { default: handler } = await import('./api/square/get-token.ts');
            return handler(req, res);
          }

          res.statusCode = 404;
          res.json({ message: `API endpoint ${pathname} not found` });
        } catch (error) {
          console.error(`Error handling API ${pathname}:`, error);
          res.statusCode = 500;
          res.json({ message: error.message || 'API server error' });
        }
      });
    }

    // Handle everything else through Vite
    vite.middlewares(nodeReq, nodeRes, () => {
      nodeRes.writeHead(404);
      nodeRes.end('Not found');
    });
  });

  let port = 3000;

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      port = 3001;
      console.log(`Port 3000 in use, trying 3001...`);
      setTimeout(() => server.listen(port, '0.0.0.0'), 1000);
    } else {
      throw err;
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`\n⚡ Combined dev server running at http://localhost:${port}/\n`);
  });
};

createCombinedServer().catch((err) => {
  console.error('Failed to start combined server:', err);
  process.exit(1);
});
