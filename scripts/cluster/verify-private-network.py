#!/usr/bin/env python3
"""Read-only checks from the actual EC2 hosts, using private IPs and service mTLS.

No public DNS, local PEM transport, certificate bypass, or room allocation.
"""
import ipaddress
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from remote import ssm

inventory = json.loads(Path('.cluster-local/inventory.json').read_text())
nodes = inventory['nodes']
for node in nodes.values():
    assert ipaddress.ip_address(node['privateIp']).is_private
workers = ['rh-game-01', 'rh-game-02', 'rh-game-03']
checks = {name: [] for name in nodes}
for worker in workers:
    checks['rh-gateway'].append(dict(target=worker, port=8787, path='/health', expected=200))
    checks[worker].append(dict(target='rh-coordinator', port=8443, path='/', expected=405))
    checks[worker].append(dict(target='rh-coordinator', port=8443, path='/reserve', method='POST', expected=400))
checks['rh-gateway'] += [
    dict(target='rh-coordinator', port=8443, path='/', expected=405),
    dict(target='rh-game-02', port=8787, path='/health', expected='tls_rejected', anonymous=True),
    dict(target='rh-coordinator', port=8443, path='/', expected='tls_rejected', anonymous=True),
    dict(target='rh-coordinator', port=6379, expected='network_blocked'),
]
# game-01 temporarily retains web ingress for the unchanged legacy entry.
# Even with that group's reachability, its worker identity cannot impersonate gateway.
checks['rh-game-01'].append(dict(target='rh-game-02', port=8787, path='/health', expected=403))
checks['rh-game-02'].append(dict(target='rh-game-03', port=8787, expected='network_blocked'))
checks['rh-game-03'].append(dict(target='rh-game-02', port=8787, expected='network_blocked'))
checks['rh-coordinator'].append(dict(target='rh-game-02', port=8787, expected='network_blocked'))

REMOTE = r'''
import http.client,json,socket,ssl,subprocess
results=[]
for check in CONFIG['checks']:
    result={**check,'source':CONFIG['source'],'privateIp':CONFIG['ips'][check['target']]}
    if check['expected']=='network_blocked':
        try:
            with socket.create_connection((result['privateIp'],check['port']),timeout=3):result['actual']='reachable'
        except (TimeoutError,ConnectionRefusedError,OSError):result['actual']='network_blocked'
    else:
        context=ssl.create_default_context(cafile='/etc/redhorizon-cluster/tls/ca.crt')
        context.verify_flags |= ssl.VERIFY_X509_STRICT
        if not check.get('anonymous'):
            prefix='/etc/redhorizon-cluster/tls/'+CONFIG['source']
            context.load_cert_chain(prefix+'.crt',prefix+'.key')
        conn=http.client.HTTPSConnection(result['privateIp'],check['port'],context=context,timeout=5)
        try:
            method=check.get('method','GET')
            conn.request(method,check['path'],body='{}' if method=='POST' else None,
                         headers={'Content-Type':'application/json'})
            response=conn.getresponse();result['actual']=response.status
            payload=response.read(65536)
            if response.status==200:
                body=json.loads(payload)
                result['buildId']=body.get('buildId');result['ok']=body.get('ok')
            result['serverCertificateVerified']=True
        except ssl.SSLCertVerificationError as error:
            result['actual']='invalid_server_certificate'
            result['verificationError']=error.verify_message
        except ssl.SSLError as error:
            result['actual']='tls_rejected';result['tlsReason']=error.reason
        except OSError:
            result['actual']='transport_error'
        finally:conn.close()
    result['passed']=result['actual']==check['expected']
    if check['expected']==200:result['passed']=result['passed'] and result.get('ok') is True
    results.append(result)
if CONFIG['source']=='rh-coordinator':
    listeners=subprocess.check_output(['ss','-ltnH','sport = :6379'],text=True)
    addresses=[line.split()[3] for line in listeners.splitlines()]
    results.append({'source':CONFIG['source'],'target':'Redis loopback','actual':addresses,
                    'passed':bool(addresses) and all(a in ['127.0.0.1:6379','[::1]:6379'] for a in addresses)})
print(json.dumps(results))
'''

def run(item):
    name, tests = item
    config = {'source': name, 'checks': tests, 'ips': {n: v['privateIp'] for n, v in nodes.items()}}
    source = 'CONFIG = ' + repr(config) + '\n' + REMOTE
    return json.loads(ssm(nodes[name]['instanceId'], "python3 - <<'RH_PRIVATE_CHECK'\n" + source + '\nRH_PRIVATE_CHECK', timeout=90))

with ThreadPoolExecutor(max_workers=5) as pool:
    results = [row for batch in pool.map(run, checks.items()) for row in batch]
report = {'at': datetime.now(timezone.utc).isoformat(), 'transport': 'SSM + private IPv4 with certificate validation',
          'publicDnsRequired': False, 'result': 'passed' if all(r['passed'] for r in results) else 'failed', 'checks': results}
path = Path('.cluster-local/private-network-checks.json')
path.write_text(json.dumps(report, indent=2))
for result in results:
    print(result['source'], '->', result['target'], result.get('port', ''), result['actual'], 'PASS' if result['passed'] else 'FAIL')
print('Report:', path)
if report['result'] != 'passed': raise SystemExit(1)
