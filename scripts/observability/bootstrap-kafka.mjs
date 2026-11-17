import { readFileSync } from 'node:fs';
import { kafkaClient, TOPICS, NODES } from '../../server/observability/kafka.js';
import KafkaJS from 'kafkajs';
const { AclResourceTypes: ResourceTypes, AclOperationTypes, AclPermissionTypes, ResourcePatternTypes } = KafkaJS;
const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const admin = kafkaClient(config).admin();
try {
 await admin.connect();
 await admin.createTopics({ waitForLeaders: true, topics: TOPICS.map(topic => ({ topic, numPartitions: 1, replicationFactor: 1, configEntries: [{ name: 'retention.ms', value: '86400000' }, { name: 'retention.bytes', value: '268435456' }, { name: 'max.message.bytes', value: '65536' }, { name: 'segment.bytes', value: '16777216' }] })) });
 const acl = (principal, resourceType, resourceName, operation) => ({ principal: 'User:CN=' + principal, resourceType, resourceName, operation, permissionType: AclPermissionTypes.ALLOW, resourcePatternType: ResourcePatternTypes.LITERAL, host: '*' });
 const entries = [];
 for (const node of NODES) {
  for (const topic of TOPICS.filter(t => t.startsWith('rh.' + node + '.'))) for (const op of [AclOperationTypes.WRITE, AclOperationTypes.DESCRIBE]) entries.push(acl(node, ResourceTypes.TOPIC, topic, op));
  entries.push(acl(node, ResourceTypes.CLUSTER, 'kafka-cluster', AclOperationTypes.IDEMPOTENT_WRITE));
 }
 for (const topic of TOPICS) for (const op of [AclOperationTypes.READ, AclOperationTypes.DESCRIBE]) entries.push(acl('rh-panel-consumer', ResourceTypes.TOPIC, topic, op));
 entries.push(acl('rh-panel-consumer', ResourceTypes.GROUP, 'rh-panel-v1', AclOperationTypes.READ));
 await admin.createAcls({ acl: entries });
 console.log(JSON.stringify({ topics: TOPICS.length, aclEntries: entries.length, tls: true, anonymousAccess: false }));
} finally { await admin.disconnect(); }
