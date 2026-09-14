// pm2 配置:pnpm start / pm2 restart words2site
module.exports = {
  apps: [
    {
      name: "words2site",
      script: "dist/index.js",
      cwd: "./apps/server",
      instances: 1, // 队列在进程内,必须单实例
      exec_mode: "fork",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
