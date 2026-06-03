#!/usr/bin/env bash
# Co-latro backend — build + push the image to Nexus, then roll out on the poker-api VM (230).
# Invoked by CI on push to main. Usage: ./scripts/deploy.sh <git-sha>
#
# Env (provided by CI):
#   NEXUS_REGISTRY  registry host (default docker.pdlab.dev)
#   NEXUS_USERNAME / NEXUS_PASSWORD   Nexus Docker creds (Actions secrets)
set -euo pipefail

SHA="${1:?usage: deploy.sh <git-sha>}"
REGISTRY="${NEXUS_REGISTRY:-docker.pdlab.dev}"
IMAGE="${REGISTRY}/co-latro-backend"

echo "==> Building ${IMAGE}:${SHA}"
docker build -t "${IMAGE}:${SHA}" -t "${IMAGE}:latest" .

echo "==> Pushing to Nexus (${REGISTRY})"
echo "${NEXUS_PASSWORD:?NEXUS_PASSWORD unset}" | docker login "${REGISTRY}" -u "${NEXUS_USERNAME:?NEXUS_USERNAME unset}" --password-stdin
docker push "${IMAGE}:${SHA}"
docker push "${IMAGE}:latest"

# -----------------------------------------------------------------------------
# TODO(PET-12, infra-side): roll the new image onto the poker-api VM (230).
# The VM wiring (SSH access, docker-compose/systemd unit, and DATABASE_URL sourced
# from Vault kv/poker/db) is owned by petedio-iac, not this repo. Once that lands,
# replace this guarded block with the real rollout. The container reaches Postgres
# at 192.168.50.231 via DATABASE_URL and runs migrations on boot (src/index.ts).
#
# Expected shape (pseudocode — DO NOT enable until infra provides the targets):
#   ssh "${POKER_VM_HOST}" \
#     "docker pull ${IMAGE}:${SHA} && \
#      docker tag ${IMAGE}:${SHA} co-latro-backend:current && \
#      systemctl restart co-latro-backend"   # unit injects DATABASE_URL from Vault-rendered env
# -----------------------------------------------------------------------------
if [[ -n "${POKER_VM_HOST:-}" ]]; then
  echo "ERROR: POKER_VM_HOST is set but the rollout step is not yet wired (PET-12 infra-side)." >&2
  echo "       Remove this guard and implement the SSH rollout once the VM target exists." >&2
  exit 1
fi

echo "==> Image published. VM rollout is infra-side (petedio-iac) — see TODO in this script."
