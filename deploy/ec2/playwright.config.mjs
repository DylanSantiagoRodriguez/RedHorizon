import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Deployment workers have no GPU. Exercise the same online scenarios with the
// existing low-quality option; leave game defaults and server deadlines intact.
const root = process.cwd();
const { default: base } = await import(pathToFileURL(join(root, 'playwright.online.config.js')));
export default {
  ...base,
  testDir: join(root, 'tests/browser'),
  outputDir: join(root, 'test-results/online'),
  timeout: 720000,
  // Two software-rendered contexts can take over 15 seconds to answer even
  // when the authoritative snapshot already satisfies the assertion.
  expect: { ...base.expect, timeout: 45000 },
  use: {
    ...base.use,
    viewport: { width: 480, height: 360 },
    // Continuous trace screenshots force costly ReadPixels on SwiftShader.
    // Keep DOM/network traces and the final failure screenshot.
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
    storageState: {
      cookies: [],
      origins: [{ origin: new URL(base.use.baseURL).origin, localStorage: [{ name: 'red-horizon-v1', value: JSON.stringify({ options: { quality: 'low', volume: 0 } }) }] }],
    },
  },
  webServer: base.webServer.map(server => ({ ...server, cwd: root })),
};
