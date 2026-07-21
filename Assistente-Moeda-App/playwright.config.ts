module.exports = {
  testDir: './e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:8081',
    headless: true,
  },
};
