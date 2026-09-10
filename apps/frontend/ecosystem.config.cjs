module.exports = {
  apps: [
    {
      name: "ac-system-frontend",
      cwd: __dirname,
      script: "pnpm",
      args: "start",
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
