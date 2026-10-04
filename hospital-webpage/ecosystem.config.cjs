module.exports = {
  apps: [
    {
      name: "avocado-web",
      cwd: "/var/www/hospital-webpage",
      script: "npx",
      args: "serve -s dist -l tcp://127.0.0.1:5567",
      interpreter: "none",
      autorestart: true,
      max_memory_restart: "300M",
    },
  ],
};
