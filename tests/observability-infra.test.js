import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const template = JSON.parse(readFileSync(new URL('../deploy/observability/infrastructure.json', import.meta.url)));
it('adds one protected shared node without taking ownership of existing instances or adding paid network services', () => {
 const resources = Object.values(template.Resources), nodes = resources.filter(r => r.Type === 'AWS::EC2::Instance'); expect(nodes).toHaveLength(1);
 expect(nodes.map(r => r.Properties.Tags.find(t => t.Key === 'Name').Value).sort()).toEqual(['rh-observability']);
 for (const r of nodes) { expect(r.DeletionPolicy).toBe('Retain'); expect(r.Properties.MetadataOptions.HttpTokens).toBe('required'); expect(r.Properties.InstanceType).toBe('m7i-flex.large'); expect(r.Properties.CreditSpecification).toBeUndefined(); expect(r.Properties.BlockDeviceMappings.every(v => v.Ebs.Encrypted)).toBe(true); }
 expect(resources.some(r => /NatGateway|LoadBalancer|MSK|Cognito|EIP/.test(r.Type))).toBe(false);
});
it('limits every added ingress rule to a source security group and the three private service ports', () => {
 const rules = Object.values(template.Resources).filter(r => r.Type === 'AWS::EC2::SecurityGroupIngress').map(r => r.Properties); expect(rules.length).toBeGreaterThan(0);
 for (const r of rules) { expect(r.SourceSecurityGroupId).toBeTruthy(); expect(r.CidrIp).toBeUndefined(); expect(r.CidrIpv6).toBeUndefined(); expect([8444,9093,9400]).toContain(r.FromPort); expect(r.FromPort).toBe(r.ToPort); }
});
it('bounds runtime roles and grants CloudWatch reads only to the observability node', () => {
 for (const id of ['ObservabilityRole']) expect(template.Resources[id].Properties.PermissionsBoundary).toBe('arn:aws:iam::670036769494:policy/RedHorizonObservabilityRuntimeBoundary');
 expect(template.Resources.Events).toBeUndefined();
 expect(template.Resources.ObservabilityRole.Properties.Policies[0].PolicyDocument.Statement[0].Action).toBe('cloudwatch:GetMetricStatistics');
});
