module.exports = {
  apps: [
    {
      name: 'indicator-tracking',
      script: 'node',
      args: '--experimental-strip-types server.ts',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--experimental-sqlite',
        PORT: '3100'
      }
    }
  ]
};
