#!/usr/bin/env bash
# Deploy Cloud Run sidecar from repo root (not triggered by Vercel/git push).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${GOFAST_GCP_PROJECT:-gofast-497201}"
REGION="${GOFAST_GCP_REGION:-us-east4}"
SERVICE="garmin-activity-detail-ingest"

if command -v mise >/dev/null 2>&1; then
  MISE_PYTHON="$(mise which python@3.12 2>/dev/null || true)"
  if [[ -z "$MISE_PYTHON" && -x "$HOME/.local/share/mise/installs/python/3.12.14/bin/python3" ]]; then
    MISE_PYTHON="$HOME/.local/share/mise/installs/python/3.12.14/bin/python3"
  fi
  if [[ -n "$MISE_PYTHON" ]]; then
    export CLOUDSDK_PYTHON="$MISE_PYTHON"
  fi
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
  echo "Or use GCP Console → Cloud Run → $SERVICE → Deploy from source"
  echo "Dockerfile: Dockerfile.garmin-activity-detail-ingest (repo root)"
  exit 1
fi

TAG="$(git rev-parse --short HEAD 2>/dev/null || echo latest)"
IMAGE="gcr.io/${PROJECT}/${SERVICE}:${TAG}"

echo "Building $IMAGE from Dockerfile.garmin-activity-detail-ingest..."
gcloud builds submit . \
  --config scripts/cloudbuild-garmin-activity-detail-ingest.yaml \
  --substitutions="_IMAGE=${IMAGE}" \
  --project "$PROJECT"

echo "Deploying $SERVICE to $REGION (project $PROJECT)..."
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project "$PROJECT" \
  --allow-unauthenticated

echo "Health check:"
curl -sf "https://${SERVICE}-288485670558.${REGION}.run.app/health" | head -c 500 || true
echo ""
