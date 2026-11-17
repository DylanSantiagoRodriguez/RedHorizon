// Open the deployed gateway in an isolated browser without changing system DNS.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isIP } from 'node:net';
import { chromium } from '@playwright/test';
import { browserResolveArgs } from '../lib/smoke-network.mjs';
const inventory = JSON.parse(readFileSync('.cluster-local/inventory.json', 'utf8'));
const origin = new URL(inventory.origin);
if (origin.protocol !== 'https:') throw new Error('HTTPS origin required');
process.env.SMOKE_RESOLVE_IP ||= inventory.nodes['rh-gateway'].publicIp;
if (!isIP(process.env.SMOKE_RESOLVE_IP)) throw new Error('Invalid gateway address');
const profile = mkdtempSync(join(tmpdir(), 'rh-gateway-preview-'));
let browser;
try {
  browser = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: false, args: browserResolveArgs(origin),
  });
  const closed = new Promise(resolve => browser.once('close', resolve));
  process.once('SIGINT', () => browser.close().catch(() => {}));
  process.once('SIGTERM', () => browser.close().catch(() => {}));
  console.log(`Gateway desplegado: ${process.env.SMOKE_RESOLVE_IP}. Resolución local solo en esta ventana; TLS validado y DNS del sistema intacto.`);
  await browser.pages()[0].goto(origin.href, { waitUntil: 'domcontentloaded' });
  await closed;
} finally { await browser?.close().catch(() => {}); rmSync(profile, { recursive: true, force: true }); }
