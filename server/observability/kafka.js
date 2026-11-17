import { Kafka, logLevel, Partitioners } from 'kafkajs';
import { readFileSync } from 'node:fs';
import { operationalEvent } from './events.js';
export const NODES = ['rh-gateway', 'rh-game-01', 'rh-game-02', 'rh-game-03', 'rh-coordinator', 'rh-observability', 'rh-events'];
export const TOPICS = NODES.flatMap(id => ['lifecycle', 'security', 'deployment'].map(kind => `rh.${id}.${kind}.v1`));
export const topicFor = e => `rh.${e.source}.${e.type.startsWith('security.') ? 'security' : e.type.startsWith('deployment.') ? 'deployment' : 'lifecycle'}.v1`;
export function validEvent(value) {
  if (!value || value.schemaVersion !== 1 || !/^[a-f0-9-]{36}$/.test(value.eventId || '') || !Number.isSafeInteger(value.timestamp) || value.timestamp < 0 || value.timestamp > Date.now() + 60000) throw new Error('Invalid envelope');
  const clean = operationalEvent(value.source, value.type, value.data, value.timestamp);
  return { ...clean, eventId: value.eventId };
}
export function kafkaClient({ brokers, tlsDir, identity }) {
  if (!Array.isArray(brokers) || brokers.length !== 1) throw new Error('Explicit broker required');
  return new Kafka({ clientId: identity, brokers, ssl: { ca: [readFileSync(`${tlsDir}/ca.crt`)], cert: readFileSync(`${tlsDir}/${identity}.crt`), key: readFileSync(`${tlsDir}/${identity}.key`), rejectUnauthorized: true }, logLevel: logLevel.NOTHING, connectionTimeout: 1500, requestTimeout: 2000, retry: { retries: 2, initialRetryTime: 100, maxRetryTime: 500 } });
}
export function producerTransport(config) {
  const producer = kafkaClient(config).producer({ idempotent: true, maxInFlightRequests: 1, retry: { retries: 2 }, createPartitioner: Partitioners.DefaultPartitioner });
  let ready = false, connecting = null; const stats = { events: 0, bytes: 0, lastSentAt: 0, errors: 0 };
  return {
    producer, stats,
    async send(batch, signal) {
      if (signal.aborted) throw new Error('Cancelled');
      if (!ready) { connecting ||= producer.connect().then(() => { ready = true; }).finally(() => { connecting = null; }); await connecting; }
      if (signal.aborted) throw new Error('Cancelled');
      const groups = new Map();
      for (const value of batch) { const event = validEvent(value), topic = topicFor(event); if (!groups.has(topic)) groups.set(topic, []); groups.get(topic).push({ key: event.data.roomId || event.source, value: JSON.stringify(event) }); }
      try { await producer.sendBatch({ topicMessages: [...groups].map(([topic, messages]) => ({ topic, messages })), acks: -1, timeout: 2000 }); stats.events += batch.length; stats.bytes += [...groups.values()].flat().reduce((n,m) => n + Buffer.byteLength(m.value), 0); stats.lastSentAt = Date.now(); }
      catch (e) { ready = false; stats.errors++; throw e; }
    },
    close: () => producer.disconnect(),
  };
}
