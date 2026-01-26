import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create Express app for API routes
const apiApp = express();
apiApp.use(express.json());
apiApp.use(express.text({ type: 'text/plain' }));

// CORS middleware
apiApp.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-square-access-token');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Import API handlers
const loadHandler = async (modulePath) => {
  try {
    const module = await import(modulePath);
    return module.default;
  } catch (err) {
    console.error(`Failed to load handler from ${modulePath}:`, err);
    throw err;
  }
};

// API Routes
apiApp.post('/api/square/team', async (req, res) => {
  try {
    const handler = await loadHandler(path.join(__dirname, 'api/square/team.ts'));
    return handler(req, res);
  } catch (err) {
    console.error('Team endpoint error:', err);
    res.status(500).json({ message: err.message });
  }
});

apiApp.post('/api/square/clients', async (req, res) => {
  try {
    const handler = await loadHandler(path.join(__dirname, 'api/square/clients.ts'));
    return handler(req, res);
  } catch (err) {
    console.error('Clients endpoint error:', err);
    res.status(500).json({ message: err.message });
  }
});

apiApp.all('/api/square/proxy', async (req, res) => {
  try {
    const handler = await loadHandler(path.join(__dirname, 'api/square/proxy.ts'));
    return handler(req, res);
  } catch (err) {
    console.error('Proxy endpoint error:', err);
    res.status(500).json({ message: err.message });
  }
});

apiApp.get('/api/square/oauth/start', async (req, res) => {
  try {
    const handler = await loadHandler(path.join(__dirname, 'api/square/oauth/start.ts'));
    return handler(req, res);
  } catch (err) {
    console.error('OAuth start endpoint error:', err);
    res.status(500).json({ message: err.message });
  }
});

apiApp.post('/api/square/oauth/token', async (req, res) => {
  try {
    const handler = await loadHandler(path.join(__dirname, 'api/square/oauth/token.ts'));
    return handler(req, res);
  } catch (err) {
    console.error('OAuth token endpoint error:', err);
    res.status(500).json({ message: err.message });
  }
});

apiApp.get('/api/square/get-token', async (req, res) => {
  try {
    const handler = await loadHandler(path.join(__dirname, 'api/square/get-token.ts'));
    return handler(req, res);
  } catch (err) {
    console.error('Get token endpoint error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Start API server
const apiPort = 3001;
apiApp.listen(apiPort, '0.0.0.0', () => {
  console.log(`API server running on http://localhost:${apiPort}`);
});

// Also create a combined dev server that proxies to Vite
const createDevServer = async () => {
  const vite = await createViteServer({
    server: { middlewareMode: true },
  });

  const app = express();
  app.use(apiApp);
  app.use(vite.middlewares);

  const devPort = 3000;
  app.listen(devPort, '0.0.0.0', () => {
    console.log(`Dev server running on http://localhost:${devPort}`);
  });
};

createDevServer().catch(console.error);
