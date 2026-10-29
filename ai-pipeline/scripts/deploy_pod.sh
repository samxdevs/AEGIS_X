#!/usr/bin/env bash
#
# scripts/deploy_pod.sh — copy ONLY what the Jetson pod runs.
#
# The full repo is ~150 MB of training data, splits, Kaggle packages and docs the
# pod never reads. This pushes the runtime (~a few MB of code + configs) and,
# with --with-models, the ONNX/engine files.
#
# Never uses --delete: pod-local state (data/edge.db, captures, logs, the pod's
# own built engine) must survive a deploy.
#
# Usage:
#   scripts/deploy_pod.sh <pod-ip> [--with-models] [--dry-run] [--restart]
#   scripts/deploy_pod.sh 10.133.221.171 --restart
#
# Runbook: docs/NANO_DEPLOYMENT_RUNBOOK.md §2.4 (same destination and user).

set -euo pipefail

POD_HOST="${1:-}"
if [ -z "$POD_HOST" ] || [[ "$POD_HOST" == --* ]]; then
  echo "usage: $0 <pod-ip> [--with-models] [--dry-run] [--restart]" >&2
  echo "find the pod's IP on the hotspot: curl http://<ip>:8080/api/v1/health" >&2
  exit 2
fi
shift

POD_USER="${POD_USER:-nvidia}"
POD_DEST="${POD_DEST:-/home/nvidia/sih-smart-farming}"
WITH_MODELS=0
DRY=""
RESTART=0
for arg in "$@"; do
  case "$arg" in
    --with-models) WITH_MODELS=1 ;;
    --dry-run)     DRY="--dry-run" ;;
    --restart)     RESTART=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Runtime only. Training (train/, kaggle/, splits*/), dataset tooling and most
# docs stay on the laptop.
RUNTIME=(
  core
  edge
  gateway
  configs
  services
  firmware
  requirements-edge.txt
  scripts/build_trt_engine.sh
  scripts/setup_nano_services.sh
  scripts/install_pod_services.sh
  scripts/nano_smoke_test.py
  scripts/reset_edge_db.sh
  scripts/thermal_ref_setup.py
  scripts/fetch_satellite_ndvi.py
  scripts/mlx90640_dump_intermediates.py
  scripts/helpers
  docs/TEMPLATE_ID_REGISTRY.md
  docs/sources
)
if [ "$WITH_MODELS" = 1 ]; then
  # The engine is hardware-specific: prefer rebuilding it on the pod from the
  # ONNX (scripts/build_trt_engine.sh) over copying a laptop copy.
  RUNTIME+=(artifacts/onnx/model_a_sim.onnx artifacts/onnx/model_b.onnx)
fi

for p in "${RUNTIME[@]}"; do
  [ -e "$p" ] || { echo "missing in repo: $p (run from a full checkout)" >&2; exit 1; }
done

echo "[deploy_pod] ${POD_USER}@${POD_HOST}:${POD_DEST} ${DRY:+(dry run)}"
# -R keeps relative paths (scripts/x.sh lands in scripts/), so one rsync covers all.
rsync -azR $DRY --itemize-changes \
  --exclude '__pycache__' --exclude '*.pyc' --exclude '.DS_Store' \
  "${RUNTIME[@]}" "${POD_USER}@${POD_HOST}:${POD_DEST}/"

if [ "$RESTART" = 1 ] && [ -z "$DRY" ]; then
  echo "[deploy_pod] restarting aegis-gateway (sudo password may be asked)"
  ssh -t "${POD_USER}@${POD_HOST}" "sudo systemctl daemon-reload && sudo systemctl restart aegis-gateway && systemctl is-active aegis-gateway"
fi
echo "[deploy_pod] done. New scans pick up pipeline changes; the gateway needs --restart."
