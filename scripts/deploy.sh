#!/usr/bin/env bash
# Co-latro backend — build + push the image to the registry, then roll out on the poker-api VM (230).
# Invoked by CI on push to main. Usage: ./scripts/deploy.sh <git-sha>
#
# Env (provided by CI):
#   REGISTRY_HOST   registry host (default docker.pdlab.dev)
#   REGISTRY_USERNAME / REGISTRY_PASSWORD   registry creds (minted from Vault by CI)
set -euo pipefail

SHA="${1:?usage: deploy.sh <git-sha>}"
REGISTRY="${REGISTRY_HOST:-docker.pdlab.dev}"
IMAGE="${REGISTRY}/co-latro-backend"

echo "==> Building ${IMAGE}:${SHA}"
docker build -t "${IMAGE}:${SHA}" -t "${IMAGE}:latest" .

echo "==> Pushing to ${REGISTRY}"
echo "${REGISTRY_PASSWORD:?REGISTRY_PASSWORD unset}" | docker login "${REGISTRY}" -u "${REGISTRY_USERNAME:?REGISTRY_USERNAME unset}" --password-stdin
docker push "${IMAGE}:${SHA}"
docker push "${IMAGE}:latest"

# -----------------------------------------------------------------------------
# This script is PUBLISH-ONLY: build + push to the registry. The on-VM rollout is a
# SEPARATE, on-demand step — the manual deploy workflow (.github/workflows/deploy.yml,
# workflow_dispatch with a `sha` input) SSHes to LXC 230, pulls the tag, and restarts
# the systemd unit. The unit's DATABASE_URL comes from the Vault-rendered env-file laid
# down once by the petedio-iac Ansible rollout (configure-poker-api.yml) — so neither
# this script nor the deploy workflow needs the DB secret. (PET-12 / PET-52 / PET-79.)
# -----------------------------------------------------------------------------
echo "==> Image published to the registry. Roll it onto VM 230 via the deploy workflow (sha=${SHA})."
