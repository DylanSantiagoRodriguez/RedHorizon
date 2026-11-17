import http from 'node:http';
import { Metrics } from './metrics.js';
import { EventQueue } from './events.js';
export class Telemetry {
  constructor(id, { socketPath = '/run/redhorizon-observer/ingest.sock' } = {}) {
    this.id = id; this.socketPath = socketPath; this.metrics = new Metrics();
    this.events = new EventQueue({ send: (batch, signal) => this.send(batch, signal) });
  }
  emit(type, data) { this.events.publish(this.id, type, data); }
  send(events, signal) {
    const state = this.events.status();
    this.metrics.set('rh_application_telemetry_dropped_total', state.dropped);
    const data = JSON.stringify({ source: this.id, at: Date.now(), metrics: this.metrics.snapshot(), events });
    return new Promise((resolve, reject) => {
      const req = http.request({ socketPath: this.socketPath, path: '/ingest', method: 'POST', signal, timeout: 1000, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, res => { res.resume(); res.on('end', () => res.statusCode === 202 ? resolve() : reject(new Error('Collector rejected'))); });
      req.on('timeout', () => req.destroy(new Error('Collector timeout'))); req.on('error', reject); req.end(data);
    });
  }
  start(sample) {
    const report = async () => {
      try {
        sample?.(this.metrics);
        this.metrics.set('rh_process_rss_bytes', process.memoryUsage().rss);
        if (this.events.items.length) await this.events.flush();
        else if (!this.idleInFlight) { this.idleInFlight = true; try { await this.send([], AbortSignal.timeout(1000)); } finally { this.idleInFlight = false; } }
      } catch { this.metrics.inc('rh_collector_errors_total'); }
    };
    this.timer = setInterval(report, 5000); this.timer.unref(); void report();
  }
  close() { clearInterval(this.timer); }
}
