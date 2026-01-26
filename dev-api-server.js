import http from 'http';
import url from 'url';

// Create a simple server that handles API requests
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const pathname = url.parse(req.url, true).pathname;

  try {
    if (pathname === '/api/square/team') {
      const module = await import('./api/square/team.ts');
      const handler = module.default;
      return handler(req, res);
    }
    
    if (pathname === '/api/square/clients') {
      const module = await import('./api/square/clients.ts');
      const handler = module.default;
      return handler(req, res);
    }

    if (pathname === '/api/square/proxy') {
      const module = await import('./api/square/proxy.ts');
      const handler = module.default;
      return handler(req, res);
    }

    if (pathname === '/api/square/oauth/start') {
      const module = await import('./api/square/oauth/start.ts');
      const handler = module.default;
      return handler(req, res);
    }

    if (pathname === '/api/square/oauth/token') {
      const module = await import('./api/square/oauth/token.ts');
      const handler = module.default;
      return handler(req, res);
    }

    if (pathname === '/api/square/get-token') {
      const module = await import('./api/square/get-token.ts');
      const handler = module.default;
      return handler(req, res);
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not found' }));
  } catch (error) {
    console.error('API Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: error.message || 'Internal server error' }));
  }
});

const port = 3001;
server.listen(port, () => {
  console.log(`Dev API server running on http://localhost:${port}`);
});
