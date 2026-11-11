import base from '../../playwright.config.js';
export default { ...base, testDir: '../../tests/browser', use: { ...base.use, baseURL: 'http://127.0.0.1:5185' }, webServer: { ...base.webServer, command: 'npm run dev:frontend -- --port 5185 --strictPort', url: 'http://127.0.0.1:5185' } };
