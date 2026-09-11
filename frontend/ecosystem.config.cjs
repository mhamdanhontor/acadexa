module.exports = {
  apps: [
    {
      name: 'acadexa-frontend',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 5173',
      cwd: '/home/user/webapp/frontend',
      env: { NODE_ENV: 'production' },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
}
