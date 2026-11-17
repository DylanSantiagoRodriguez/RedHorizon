import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Metrics } from '../server/observability/metrics.js';
import { hostMetrics } from '../server/observability/agent.js';
import { awsMetrics } from '../server/observability/aws-metrics.js';
it('reads Linux host counters without counting loopback or container bridges twice', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'rh-proc-'));
 try { await mkdir(dir + '/net'); await writeFile(dir + '/meminfo', 'MemTotal: 1024 kB\nMemAvailable: 512 kB\n'); await writeFile(dir + '/stat', 'cpu  10 0 20 100 5 0 0 0 0 0\n'); await writeFile(dir + '/net/dev', 'header\nheader\n eth0: 100 1 0 0 0 0 0 0 200 1 0 0 0 0 0 0\n lo: 999 1 0 0 0 0 0 0 999 1 0 0 0 0 0 0\n docker0: 888 1 0 0 0 0 0 0 888 1 0 0 0 0 0 0\n');
 const metrics = new Metrics(); await hostMetrics(metrics, { procRoot: dir, disk: dir }); const value = name => metrics.snapshot().find(r => r.name === name)?.value;
 expect(value('rh_host_memory_available_bytes')).toBe(524288); expect(value('rh_host_cpu_total_ticks')).toBe(135); expect(value('rh_host_network_received_bytes_total')).toBe(100); expect(value('rh_host_network_sent_bytes_total')).toBe(200);
 } finally { await rm(dir, { recursive: true, force: true }); }
});
it('keeps AWS measurement time and missing data explicit, and skips credits for nonburstable hosts', async () => {
 const calls = [], timestamp = new Date(Date.now() - 600000);
 const client = { send: async c => { calls.push(c.input); return { Datapoints: c.input.MetricName === 'NetworkOut' ? [] : [{ Timestamp: timestamp, Average: 42, Sum: 99 }] }; }, destroy() {} };
 const collector = awsMetrics([{ id: 'rh-game-01', instanceId: 'i-abcd', instanceType: 'm7i-flex.large' }], { client });
 try { while (!collector.state.collectedAt) await new Promise(r => setTimeout(r, 5)); expect(calls).toHaveLength(3); expect(calls.every(c => c.Period === 300)).toBe(true); expect(collector.state.nodes['rh-game-01'].CPUUtilization.timestamp).toBe(timestamp.getTime()); expect(collector.state.nodes['rh-game-01'].NetworkOut).toBe(null); } finally { collector.close(); }
});
it('counts sanitized Nginx limits and bounds log reads under pressure', async () => {
 const { nginxMetrics } = await import('../server/observability/nginx-metrics.js'); const dir = await mkdtemp(join(tmpdir(), 'rh-nginx-')); const path = dir + '/nginx.log';
 try { const m = new Metrics(), sample = nginxMetrics(path); await writeFile(path, '1700000000.0 429 100 0.1 REJECTED http\n'); await sample(m); expect(m.snapshot().find(r => r.name === 'rh_nginx_rate_rejected_total').value).toBe(1); await sample(m); expect(m.snapshot().find(r => r.name === 'rh_nginx_rate_rejected_total').value).toBe(1); await writeFile(path, 'x'.repeat(500000)); await sample(m); expect(m.snapshot().find(r => r.name === 'rh_nginx_log_dropped_bytes_total').value).toBeGreaterThan(200000); } finally { await rm(dir, { recursive: true, force: true }); }
});
