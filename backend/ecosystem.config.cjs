module.exports = {
  apps: [
    {
      name: 'acadexa-backend',
      script: 'venv/bin/uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8000',
      cwd: '/home/user/webapp/backend',
      interpreter: 'none',
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
