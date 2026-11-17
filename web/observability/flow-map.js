// Diagram of configured routes; animation requires fresh, positive measured traffic.
export function renderFlowMap(target, overview) {
 const ns = 'http://www.w3.org/2000/svg';
 const el = (tag, attrs = {}, text) => { const n = document.createElementNS(ns, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if (text !== undefined) n.textContent = text; return n; };
 const rows = key => overview.metrics?.[key] || [];
 const rate = (key, node, peer) => { const found = rows(key).filter(r => (!node || r.metric.node === node) && (!peer || r.metric.peer === peer)); return found.length && found.every(r => Number.isFinite(Number(r.value[1]))) ? found.reduce((sum,r) => sum + Number(r.value[1]), 0) : null; };
 const bytes = n => n === null ? 'Sin muestras' : n >= 1024 ? `${(n / 1024).toFixed(1)} KiB/s` : `${n.toFixed(0)} B/s`;
 const svg = el('svg', { viewBox: '0 0 1180 560', role: 'img', 'aria-label': 'Flujo de tráfico entre gateway, tres workers, coordinador, Kafka y observabilidad' });
 const defs = el('defs'), marker = el('marker', { id: 'rh-flow-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }); marker.append(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'context-stroke' })); defs.append(marker); svg.append(defs);
 const recent = node => { const stamp = rate('app_freshness', node) || rate('freshness', node); return !overview.stale && stamp && Date.now() / 1000 - stamp <= 20; };
 const edge = (path, label, x, y, amount, node, kind = '') => { const active = amount !== null && amount > 0 && recent(node); svg.append(el('path', { d: path, class: `flow-edge ${kind} ${active ? 'flow-active' : ''}`, 'marker-end': 'url(#rh-flow-arrow)', ...(kind ? {} : { 'marker-start': 'url(#rh-flow-arrow)' }) })); svg.append(el('text', { x, y, class: 'flow-label', 'text-anchor': 'middle' }, label)); };
 for (const [i,id] of ['rh-game-01','rh-game-02','rh-game-03'].entries()) {
  const y = 80 + i * 145, sent = rate('logical_received_bytes_s','rh-gateway',id), received = rate('logical_sent_bytes_s','rh-gateway',id);
  edge(`M 225 225 C 300 225 310 ${y} 390 ${y}`, `→ ${bytes(sent)} / ← ${bytes(received)}`, 300, y - 24, sent === null && received === null ? null : (sent || 0) + (received || 0), 'rh-gateway');
  const api = rate('coordinator_request_bytes_s',id);
  edge(`M 570 ${y} C 650 ${y} 650 225 720 225`, bytes(api), 645, y - 24, api, id, 'flow-api');
 }
 edge('M 70 225 L 115 225', 'WSS', 88, 200, rate('connections','rh-gateway'), 'rh-gateway');
 edge('M 170 190 C 170 5 810 5 810 190', 'Asignación: ' + bytes(rate('coordinator_request_bytes_s','rh-gateway')), 800, 40, rate('coordinator_request_bytes_s','rh-gateway'), 'rh-gateway', 'flow-api');
 edge('M 150 265 L 150 550 L 1060 550 L 1060 535', 'HTTPS /ops/ → panel', 270, 540, null, 'rh-gateway', 'flow-api');
 svg.append(el('text', { x:435,y:453,class:'flow-label','text-anchor':'middle' }, 'Agente local en cada VM'));
 edge('M 535 500 L 720 500', bytes(rate('kafka_produced_bytes_s')), 625, 480, rate('kafka_produced_bytes_s'), 'rh-gateway', 'flow-events');
 edge('M 900 500 L 970 500', bytes(rate('kafka_consumed_bytes_s')), 935, 470, rate('kafka_consumed_bytes_s'), 'rh-observability', 'flow-events');
 svg.append(el('text', { x: 1035, y: 390, class: 'flow-label', 'text-anchor': 'middle' }, 'Prometheus ← agentes (mTLS)'));
 svg.append(el('text', { x: 1035, y: 415, class: 'flow-label', 'text-anchor': 'middle' }, 'Panel ← eventos / métricas'));
 const positions = { 'rh-gateway':[115,190], 'rh-game-01':[390,45], 'rh-game-02':[390,190], 'rh-game-03':[390,335], 'rh-coordinator':[720,190], 'rh-events':[720,465], 'rh-observability':[970,465] };
 for (const node of overview.nodes || []) {
  const p = positions[node.id]; if (!p) continue;
  const [x,y] = p, width = node.id === 'rh-gateway' ? 110 : 180, up = rate('service_up',node.id);
  const box = el('g', { class: `flow-node ${recent(node.id) && up === 1 ? 'flow-healthy' : ''}` }); box.append(el('rect', { x, y, width, height: '70', rx: '9' }), el('text', { x:x+width/2, y:y+27, 'text-anchor':'middle' }, node.id), el('text', { x:x+width/2, y:y+49, 'text-anchor':'middle', class:'flow-state' }, recent(node.id) ? up === 1 ? 'Servicio activo' : up === 0 ? 'Servicio inactivo' : 'Estado sin muestras' : 'Sin datos recientes')); svg.append(box);
 }
 svg.append(el('text', { x:35, y:230, class:'flow-label','text-anchor':'middle' }, 'Clientes'));
 svg.append(el('rect', { x:335, y:480, width:200, height:40, rx:8, class:'flow-agent-box' }), el('text', { x:435,y:505,class:'flow-label','text-anchor':'middle' }, 'Agentes de telemetría'));
 target.replaceChildren(svg);
}
