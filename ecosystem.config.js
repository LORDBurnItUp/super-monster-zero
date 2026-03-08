/**
 * PM2 Ecosystem Config — Super Monster Zero
 * Hostinger Business Plan Node.js deployment
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 */

module.exports = {
  apps: [
    {
      name: 'super-monster-zero',
      script: 'server.js',
      instances: 2,                    // 2 workers — Hostinger Business plan CPU cores
      exec_mode: 'cluster',            // Cluster mode for load balancing
      watch: false,
      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,                    // Hostinger proxy → your app port
      },

      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json',

      // Auto-restart on crash
      autorestart: true,
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '30s',

      // Graceful shutdown
      kill_timeout: 5000,
      shutdown_with_message: true,
      wait_ready: true,
      listen_timeout: 8000,

      // Source maps for stack traces
      source_map_support: true,

      // Time zone
      time: true,
    },
  ],

  deploy: {
    production: {
      user: 'u123456789',                              // Hostinger SSH username
      host: ['srv123456789.hstgr.cloud'],              // Hostinger server hostname
      ref: 'origin/main',
      repo: 'git@github.com:LORDBurnItDown/super-monster-zero.git',
      path: '/home/u123456789/super-monster-zero',
      'pre-deploy-local': '',
      'post-deploy':
        'npm install --production && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': '',
      ssh_options: 'StrictHostKeyChecking=no',
    },
  },
};
