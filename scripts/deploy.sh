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
# This script is PUBLISH-ONLY: build + push to Nexus. The on-VM rollout is a
# SEPARATE, on-demand step — the manual deploy workflow (.github/workflows/deploy.yml,
# workflow_dispatch with a `sha` input) SSHes to LXC 230, pulls the tag, and restarts
# the systemd unit. The unit's DATABASE_URL comes from the Vault-rendered env-file laid
# down once by the petedio-iac Ansible rollout (configure-poker-api.yml) — so neither
# this script nor the deploy workflow needs the DB secret. (PET-12 / PET-52 / PET-79.)
# -----------------------------------------------------------------------------
echo "==> Image published to Nexus. Roll it onto VM 230 via the deploy workflow (sha=${SHA})."
