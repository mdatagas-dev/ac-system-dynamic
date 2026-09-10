module.exports = {
  apps: [
    {
      name: "ac-system-backend",
      cwd: __dirname,
      script: "src/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
