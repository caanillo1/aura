module.exports = {
  apps: [{
    name: 'aura-backend',
    cwd: 'C:\\AURA\\apps\\backend',
    script: 'dist/main.js',
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'development' },
    max_memory_restart: '500M',
    watch: false,
    autorestart: true,
    restart_delay: 3000,
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
}