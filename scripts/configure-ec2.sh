#!/usr/bin/env bash
# Install/update trusted deployment infrastructure over the existing SSH access.
set -euo pipefail
cd "$(dirname "$0")/.."
deployment_host="${DEPLOY_HOST:-ubuntu@3.138.154.61}"
deployment_key="${DEPLOY_KEY:-../llaveredhorizon/redhorizon.pem}"
ssh_options=(-i "$deployment_key" -o BatchMode=yes -o ConnectTimeout=15)
remote_dir="$(ssh "${ssh_options[@]}" "$deployment_host" 'mktemp -d /tmp/redhorizon-setup.XXXXXXXX')"
[[ "$remote_dir" =~ ^/tmp/redhorizon-setup\.[a-zA-Z0-9]+$ ]]
scp "${ssh_options[@]}" deploy/ec2/* "$deployment_host:$remote_dir/"
ssh "${ssh_options[@]}" "$deployment_host" "sudo bash '$remote_dir/install.sh'"
ssh "${ssh_options[@]}" "$deployment_host" "rm -rf -- '$remote_dir'"
