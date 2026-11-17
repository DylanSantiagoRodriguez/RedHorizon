#!/usr/bin/env python3
"""Create a private cluster CA and scoped certificates outside the repository."""
import argparse
import ipaddress
import os
from pathlib import Path
import secrets
import subprocess

ROOT = Path(os.environ.get('RH_KEY_ROOT', '/Users/dylanrodriguez/Documents/redhorizon/llaveredhorizon'))

def generate(destination, hosts):
    destination = Path(destination).resolve()
    if not destination.is_relative_to(ROOT.resolve()):
        raise ValueError('Private keys must remain under llaveredhorizon')
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    ROOT.chmod(0o700)
    destination.mkdir(mode=0o700, parents=True, exist_ok=False)
    os.umask(0o077)
    def run(*args):
        subprocess.run(['openssl', *args], cwd=destination, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    # Do not inherit platform OpenSSL defaults: macOS LibreSSL can otherwise
    # produce a v1 root and leaves without AKI, rejected by strict X.509 clients.
    ca_config = destination / 'ca.cnf'
    ca_config.write_text('[req]\ndistinguished_name=dn\nx509_extensions=v3_ca\nprompt=no\n[dn]\nCN=RedHorizon Cluster CA\n[v3_ca]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always\n')
    run('req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-keyout', 'ca.key', '-out', 'ca.crt', '-days', '365', '-sha256', '-config', str(ca_config))
    ca_config.unlink()
    for name, address in hosts.items():
        if name not in ['rh-gateway', 'rh-coordinator', 'rh-game-01', 'rh-game-02', 'rh-game-03']:
            raise ValueError('Unknown service identity')
        ipaddress.ip_address(address)
        ext = destination / f'{name}.ext'
        ext.write_text(f'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth,clientAuth\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always\nsubjectAltName=DNS:{name},IP:{address}\n')
        run('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', f'{name}.key', '-out', f'{name}.csr', '-subj', f'/CN={name}')
        run('x509', '-req', '-in', f'{name}.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-set_serial', str(secrets.randbits(128)), '-out', f'{name}.crt', '-days', '90', '-sha256', '-extfile', str(ext))
        (destination / f'{name}.csr').unlink(); ext.unlink()
    for path in destination.iterdir():
        path.chmod(0o600 if path.suffix == '.key' else 0o644)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory')
    parser.add_argument('--hosts', required=True, help='JSON file mapping fixed service names to private IPs')
    args = parser.parse_args()
    import json
    generate(args.directory, json.loads(Path(args.hosts).read_text()))
