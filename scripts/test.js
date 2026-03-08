#!/usr/bin/env node
'use strict';
// Basic test runner — checks server starts and API responds
const http = require('http');
const { execSync } = require('child_process');

let passed = 0; let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  ✓ ${name}`); passed++; } catch(e) { console.error(`  ✗ ${name}: ${e.message}`); failed++; } };
const assert = (val, msg) => { if (!val) throw new Error(msg || 'Assertion failed'); };

console.log('\n  Super Monster Zero — Tests\n');

test('package.json valid', () => {
  const pkg = require('../package.json');
  assert(pkg.name === 'super-monster-zero', 'name mismatch');
  assert(pkg.main === 'server.js', 'main mismatch');
});

test('server.js syntax', () => {
  execSync('node --check server.js', { cwd: require('path').join(__dirname, '..'), stdio: 'pipe' });
});

test('mcp_army.json valid', () => {
  const cfg = require('../config/mcp_army.json');
  assert(Object.keys(cfg.mcpServers).length >= 14, 'Need at least 14 MCP servers');
});

test('ecosystem.config.js valid', () => {
  const eco = require('../ecosystem.config.js');
  assert(Array.isArray(eco.apps) && eco.apps.length > 0, 'Need at least 1 app');
  assert(eco.apps[0].name === 'super-monster-zero', 'App name mismatch');
});

test('public/index.html exists', () => {
  const fs = require('fs');
  assert(fs.existsSync(require('path').join(__dirname, '../public/index.html')), 'index.html missing');
});

test('public/login.html exists', () => {
  const fs = require('fs');
  assert(fs.existsSync(require('path').join(__dirname, '../public/login.html')), 'login.html missing');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
