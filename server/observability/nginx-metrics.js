import { open } from 'node:fs/promises';
// Reads only the dedicated sanitized log, at most 256 KiB per sample. No request bodies/URLs/IPs.
export function nginxMetrics(path) {
 let inode = null, offset = 0, pending = '';
 return async metrics => {
  let file;
  try {
   file = await open(path, 'r'); const stat = await file.stat();
   if (inode !== stat.ino || offset > stat.size) { inode = stat.ino; offset = 0; pending = ''; }
   if (stat.size - offset > 262144) { metrics.inc('rh_nginx_log_dropped_bytes_total', stat.size - offset - 262144); offset = stat.size - 262144; pending = ''; }
   const buffer = Buffer.alloc(Math.min(262144, stat.size - offset)); const { bytesRead } = await file.read(buffer, 0, buffer.length, offset); offset += bytesRead;
   const lines = (pending + buffer.subarray(0, bytesRead).toString()).split('\n'); pending = lines.pop().slice(0, 256);
   for (const line of lines) {
    const fields = line.split(' '); if (fields.length !== 6 || !/^\d{3}$/.test(fields[1]) || !['http','ws','ops'].includes(fields[5])) { metrics.inc('rh_nginx_log_invalid_total'); continue; }
    const status = Number(fields[1]), bytes = Number(fields[2]), duration = Number(fields[3]);
    if (status < 100 || status > 599 || !Number.isFinite(bytes) || bytes < 0 || !Number.isFinite(duration) || duration < 0) { metrics.inc('rh_nginx_log_invalid_total'); continue; }
    metrics.inc('rh_nginx_responses_total', 1, { reason: Math.floor(status / 100) + 'xx', endpoint: fields[5] });
    metrics.inc('rh_nginx_http_sent_bytes_total', bytes, { endpoint: fields[5] });
    if (fields[4] === 'REJECTED') metrics.inc('rh_nginx_rate_rejected_total', 1, { endpoint: fields[5] });
    if (fields[5] !== 'ws') metrics.observe('rh_nginx_request_duration_ms', duration * 1000);
   }
   metrics.set('rh_nginx_log_sample_timestamp_seconds', Date.now() / 1000);
  } catch { metrics.inc('rh_nginx_log_read_errors_total'); }
  finally { await file?.close(); }
 };
}
