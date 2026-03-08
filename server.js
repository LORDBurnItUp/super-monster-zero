'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { createProxyMiddleware } = require('http-proxy-middleware');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const session = require('express-session');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT        = parseInt(process.env.PORT || '3000', 10);
const HOST        = process.env.HOST || '0.0.0.0';
const NODE_ENV    = process.env.NODE_ENV || 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || uuidv4();
const AGENT_ZERO_URL  = process.env.AGENT_ZERO_URL || 'http://localhost:55080';
const AGENT_ZERO_WS   = process.env.AGENT_ZERO_WS  || 'ws://localhost:55080';
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'changeme';

const isDev = NODE_ENV === 'development';

// ─── App ─────────────────────────────────────────────────────────────────────
const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
      frameSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());
app.use(morgan(isDev ? 'dev' : 'combined'));

// CORS — allow Hostinger subdomains
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      /\.hostinger\.com$/,
      /\.hostingersite\.com$/,
      /localhost/,
      /127\.0\.0\.1/,
    ];
    if (!origin || allowed.some(r => r.test(origin))) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down, Commander.' },
});
app.use('/api/', limiter);

// Sessions
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: !isDev,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24h
  },
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isDev ? 0 : '1d',
  etag: true,
}));

// ─── Auth middleware ──────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (req.session?.authenticated) return next();
  if (req.path === '/api/login' || req.path === '/login' || req.path.startsWith('/public')) return next();
  res.redirect('/login');
};

// ─── API Routes ───────────────────────────────────────────────────────────────
const api = express.Router();

// Login
api.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASS) {
    req.session.authenticated = true;
    req.session.loginTime = Date.now();
    return res.json({ ok: true, message: 'Welcome, Commander.' });
  }
  res.status(401).json({ ok: false, error: 'Access denied.' });
});

api.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// Health check (public)
api.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'Super Monster Zero',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    agent_zero_url: AGENT_ZERO_URL,
    node_env: NODE_ENV,
  });
});

// System status (auth required)
api.get('/status', requireAuth, async (req, res) => {
  try {
    const fetch = (await import('node-fetch')).default;
    const agentRes = await fetch(`${AGENT_ZERO_URL}/api/health`, { timeout: 3000 }).catch(() => null);
    const agentOnline = agentRes?.ok || false;

    res.json({
      system: 'Super Monster Zero',
      commander_session: req.session.authenticated,
      agent_zero: {
        url: AGENT_ZERO_URL,
        online: agentOnline,
      },
      services: {
        web_ui: true,
        websocket: true,
        proxy: true,
      },
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.json({ status: 'degraded', error: e.message });
  }
});

// MCP Army status
api.get('/mcp', requireAuth, (req, res) => {
  const mcpArmy = require('./config/mcp_army.json');
  const servers = Object.keys(mcpArmy.mcpServers || {});
  res.json({ total: servers.length, servers });
});

// Agent army manifest
api.get('/army', requireAuth, (req, res) => {
  res.json({
    commander: 'Super Monster Zero',
    specialists: [
      { name: 'architect',       role: 'System design & planning',      model: 'claude-opus-4-6' },
      { name: 'researcher',      role: 'Web research & intelligence',    model: 'claude-sonnet-4-6' },
      { name: 'coder',           role: 'Full-stack development',         model: 'deepseek-coder' },
      { name: 'data_analyst',    role: 'Data & database operations',     model: 'claude-sonnet-4-6' },
      { name: 'scraper',         role: 'Web scraping & extraction',      model: 'claude-sonnet-4-6' },
      { name: 'communicator',    role: 'Reports & notifications',         model: 'claude-haiku-4-5' },
      { name: 'memory_keeper',   role: 'Knowledge management',           model: 'gemini-2.0-flash' },
      { name: 'github_engineer', role: 'GitHub operations',              model: 'claude-sonnet-4-6' },
    ],
    mcp_servers: 15,
    voice_enabled: !!process.env.LIVEKIT_URL,
  });
});

app.use('/api', api);

// ─── Proxy to Agent Zero ──────────────────────────────────────────────────────
app.use('/agent', requireAuth, createProxyMiddleware({
  target: AGENT_ZERO_URL,
  changeOrigin: true,
  pathRewrite: { '^/agent': '' },
  ws: true,
  on: {
    error: (err, req, res) => {
      console.error('[Proxy Error]', err.message);
      if (res.writeHead) {
        res.writeHead(502);
        res.end('Agent Zero is offline. Start it with: make -f Makefile.super_zero start-docker');
      }
    },
  },
}));

// ─── HTML pages ───────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (req.session?.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error', message: isDev ? err.message : undefined });
});

// ─── HTTP + WebSocket Server ──────────────────────────────────────────────────
const server = http.createServer(app);

// WebSocket — relay to Agent Zero
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (clientWs, req) => {
  console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);

  const agentWs = new WebSocket(`${AGENT_ZERO_WS}/ws`);

  agentWs.on('open', () => {
    console.log('[WS] Connected to Agent Zero');
  });

  agentWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
  });

  clientWs.on('message', (data) => {
    if (agentWs.readyState === WebSocket.OPEN) agentWs.send(data);
  });

  const cleanup = () => {
    if (agentWs.readyState === WebSocket.OPEN) agentWs.close();
  };

  clientWs.on('close', cleanup);
  clientWs.on('error', cleanup);

  agentWs.on('close', () => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });

  agentWs.on('error', (err) => {
    console.error('[WS] Agent Zero connection error:', err.message);
    clientWs.send(JSON.stringify({ type: 'error', message: 'Agent Zero offline' }));
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║       SUPER MONSTER ZERO  ONLINE         ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  URL:    http://${HOST}:${PORT}`.padEnd(45) + '║');
  console.log(`  ║  Mode:   ${NODE_ENV}`.padEnd(45) + '║');
  console.log(`  ║  Agent:  ${AGENT_ZERO_URL}`.padEnd(45) + '║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n[${signal}] Shutting down Super Monster Zero...`);
  server.close(() => {
    console.log('Server closed. Goodbye, Commander.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
  shutdown('EXCEPTION');
});
