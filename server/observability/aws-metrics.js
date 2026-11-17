import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
// Basic EC2 metrics arrive later than the 5-second host samples. No detailed monitoring enabled.
const definitions = [['CPUUtilization', 'Average', 'Percent'], ['NetworkIn', 'Sum', 'Bytes'], ['NetworkOut', 'Sum', 'Bytes'], ['CPUCreditBalance', 'Average', 'Count'], ['CPUSurplusCreditBalance', 'Average', 'Count']];
export function awsMetrics(nodes, { client = new CloudWatchClient({ region: 'us-east-2', maxAttempts: 2 }), now = Date.now } = {}) {
 if (nodes.some(n => !/^i-[a-f0-9]+$/.test(n.instanceId))) throw new Error('Explicit EC2 inventory required');
 let running = false, stopped = false, timer;
 const state = { collectedAt: 0, errorAt: 0, nodes: {} };
 async function collect() {
  if (running || stopped) return; running = true;
  try {
   const jobs = nodes.flatMap(n => definitions.filter(([name]) => !name.includes('Credit') || /^t[234]/.test(n.instanceType || '')).map(d => [n, d]));
   const end = now();
   for (let i = 0; i < jobs.length && !stopped; i += 3) await Promise.all(jobs.slice(i, i + 3).map(async ([node, [name, stat, unit]]) => {
    try {
     const result = await client.send(new GetMetricStatisticsCommand({ Namespace: 'AWS/EC2', MetricName: name, Dimensions: [{ Name: 'InstanceId', Value: node.instanceId }], StartTime: new Date(end - 1800000), EndTime: new Date(end), Period: 300, Statistics: [stat] }), { abortSignal: AbortSignal.timeout(5000) });
     const point = result.Datapoints?.sort((a,b) => b.Timestamp - a.Timestamp)[0]; state.nodes[node.id] ||= {};
     state.nodes[node.id][name] = point ? { value: point[stat], timestamp: point.Timestamp.getTime(), unit, periodSeconds: 300 } : null;
    } catch { state.errorAt = now(); }
   })); state.collectedAt = now();
  } finally { running = false; }
 }
 timer = setInterval(collect, 300000); timer.unref(); void collect();
 return { state, collect, close: () => { stopped = true; clearInterval(timer); client.destroy(); } };
}
