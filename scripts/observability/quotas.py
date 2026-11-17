#!/usr/bin/env python3
"""Run on the broker after TLS ACL bootstrap; no credentials in arguments."""
import subprocess,sys
from pathlib import Path
kafka=Path(sys.argv[1]);config=sys.argv[2];broker=sys.argv[3]
for identity in ['rh-gateway','rh-game-01','rh-game-02','rh-game-03','rh-coordinator','rh-observability','rh-events','rh-panel-consumer']:
    quota='consumer_byte_rate=1048576,request_percentage=10' if identity=='rh-panel-consumer' else 'producer_byte_rate=262144,request_percentage=5'
    subprocess.run([str(kafka/'bin/kafka-configs.sh'),'--bootstrap-server',broker,'--command-config',config,'--alter','--entity-type','users','--entity-name','CN='+identity,'--add-config',quota],check=True,timeout=30)
